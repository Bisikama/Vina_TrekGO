import { readStoredAuth } from "@/features/auth/storage";
import { SyncOutboxItem } from "@/types";
import * as Network from "expo-network";
import { AppState, NativeEventSubscription } from "react-native";
import {
  mapDifficultyToBackend,
  personalTrailApi,
  RawGpsSampleDto,
} from "../api/personalTrailApi";
import { recordingDatabase } from "./recordingDatabase";

class PersonalTrailYield extends Error {}

function logSync(event: string, details: Record<string, unknown> = {}) {
  console.log(`[syncService] ${event}`, { at: new Date().toISOString(), ...details });
}
let syncRunSequence = 0;

let isSyncing = false;
let syncWaiters: (() => void)[] = [];
let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let networkSubscription: { remove: () => void } | null = null;
let wasOnline: boolean | null = null;

type SyncListener = () => void;
const syncListeners = new Set<SyncListener>();

function notifySyncCompleted() {
  syncListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn("[syncService] Listener error:", err);
    }
  });
}

const SAMPLE_BATCH_SIZE = 500;

async function uploadAllPendingSamples(
  clientRecordingId: string,
  serverRecordingId: string,
  accessToken: string,
): Promise<void> {
  let batches = 0;
  while (true) {
    const pending = await recordingDatabase.getUnsyncedSamples(
      clientRecordingId,
      SAMPLE_BATCH_SIZE,
    );

    if (pending.length === 0) {
      logSync("UPLOAD_DRAINED", { clientRecordingId, batches });
      return;
    }
    if (batches++ >= 2) {
      logSync("UPLOAD_YIELD", { clientRecordingId, sentBatches: 2, remainingAtLeast: pending.length,
        reason: "Đạt giới hạn 2 batch mỗi lượt; chờ lượt sau, không tăng số lần thất bại" });
      throw new PersonalTrailYield();
    }

    const samples: RawGpsSampleDto[] = pending.map((sample) => ({
      clientSampleId: sample.clientSampleId,
      latitude: sample.latitude,
      longitude: sample.longitude,
      recordedAt: sample.recordedAt,
      accuracyM: sample.accuracyM,
      altitudeM: sample.altitudeM,
      altitudeAccuracyM: sample.altitudeAccuracyM,
      speedMps: sample.speedMps,
      headingDeg: sample.headingDeg,
      segmentId: sample.segmentId,
      accepted: sample.accepted,
      rejectReason: sample.rejectReason || null,
    }));

    const batchStartedAt = Date.now();
    logSync("UPLOAD_REQUEST", { clientRecordingId, serverRecordingId, batch: batches, sampleCount: samples.length });
    const ack = await personalTrailApi.uploadRawSamples(
      serverRecordingId,
      { clientRecordingId, samples },
      accessToken,
    );

    if (!ack?.success || ack.data?.receivedCount !== samples.length ||
        ack.data.insertedCount + ack.data.duplicatedCount !== samples.length) {
      throw new Error("Backend không xác nhận lô dữ liệu GPS.");
    }

    await recordingDatabase.markSamplesSynced(
      clientRecordingId,
      pending.map((sample) => sample.clientSampleId),
    );
    logSync("UPLOAD_ACK_SAVED", { clientRecordingId, batch: batches, ...ack.data,
      elapsedMs: Date.now() - batchStartedAt });
  }
}

/**
 * Đảm bảo phiên ghi đã có serverRecordingId trên Backend.
 * Nếu chưa có (hoặc CREATE_RECORDING chưa chạy thành công trước đó),
 * tự động gọi startRecording để lấy serverRecordingId (Backend hỗ trợ Idempotency).
 */
async function ensureServerRecordingId(
  clientRecordingId: string,
  accessToken: string,
): Promise<string> {
  const recording = await recordingDatabase.getRecording(clientRecordingId);
  if (recording?.serverRecordingId) {
    return recording.serverRecordingId;
  }

  try {
    const startRes = await personalTrailApi.startRecording(
      {
        clientRecordingId,
        startedAt: recording?.startedAt || new Date().toISOString(),
      },
      accessToken,
    );
    if (startRes?.data?.serverRecordingId) {
      const serverId = startRes.data.serverRecordingId;
      await recordingDatabase.attachServerRecordingId(clientRecordingId, serverId);
      return serverId;
    }
  } catch (err) {
    console.warn(
      `[syncService] Không thể auto-start recording ${clientRecordingId}:`,
      err,
    );
    // Giữ nguyên ApiError (status/code/details) để retry và log đúng nguyên nhân.
    throw err;
  }

  // Không được dùng client ID thay cho server ID. Nếu start thất bại, các tác
  // vụ phụ thuộc phải chờ retry; nếu không backend sẽ nhận một recordingId sai.
  throw new Error(`Máy chủ không trả về ID cho phiên ghi ${clientRecordingId}.`);
}

export const syncService = {
  /**
   * Bắt đầu tiến trình tự động đồng bộ ngầm khi thiết bị online trở lại:
   * 1. Quét ngay lập tức khi gọi.
   * 2. Lắng nghe AppState: mỗi khi app chuyển sang 'active' (mở lại app), quét ngay.
   * 3. Định kỳ chạy mỗi intervalMs (mặc định 15s) để bắt ngay thời điểm có mạng lại.
   */
  startAutoSync(intervalMs = 15_000): void {
    if (!syncTimer) {
      this.processSyncOutbox().catch(console.warn);

      syncTimer = setInterval(() => {
        this.processSyncOutbox().catch(console.warn);
      }, intervalMs);
    }

    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          this.processSyncOutbox().catch(console.warn);
        }
      });
    }

    if (!networkSubscription) {
      Network.getNetworkStateAsync()
        .then((state) => {
          wasOnline =
            state.isConnected === true && state.isInternetReachable !== false;
        })
        .catch(console.warn);

      networkSubscription = Network.addNetworkStateListener((state) => {
        const isOnline =
          state.isConnected === true && state.isInternetReachable !== false;
        const connectionWasRestored = isOnline && wasOnline === false;
        wasOnline = isOnline;

        if (connectionWasRestored) {
          this.processSyncOutbox().catch(console.warn);
        }
      });
    }
  },

  /**
   * Dừng dịch vụ tự động đồng bộ ngầm
   */
  stopAutoSync(): void {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
    if (networkSubscription) {
      networkSubscription.remove();
      networkSubscription = null;
      wasOnline = null;
    }
  },

  /**
   * Chờ lượt sync hiện tại, reset FAILED về PENDING và đẩy lại ngay lập tức.
   */
  async forceRetryAll(): Promise<{ attempted: number; remaining: number }> {
    const before = await recordingDatabase.getAllOutboxItems();
    // Chờ tiến trình hiện tại kết thúc để không reset item đang SYNCING.
    await this.processSyncOutbox();
    await recordingDatabase.resetAllPendingOutbox();
    await this.processSyncOutbox();
    // Nếu một auto-sync chen vào giữa hai await, lượt này bảo đảm quét lại item vừa reset.
    await this.processSyncOutbox();
    const after = await recordingDatabase.getAllOutboxItems();
    return {
      attempted: before.filter((item) => item.state !== "SYNCED").length,
      remaining: after.filter((item) => item.state !== "SYNCED").length,
    };
  },

  /**
   * Kích hoạt xử lý hàng đợi Outbox đồng bộ ngầm lên Backend
   */
  async processSyncOutbox(): Promise<void> {
    if (isSyncing) {
      logSync("RUN_WAIT", { waitingCalls: syncWaiters.length + 1, reason: "Một lượt sync đang chạy" });
      await new Promise<void>((resolve) => syncWaiters.push(resolve));
      return;
    }
    isSyncing = true;
    const runId = ++syncRunSequence;

    try {
      const auth = await readStoredAuth();
      if (!auth?.accessToken) {
        logSync("RUN_SKIP", { runId, reason: "Chưa đăng nhập" });
        // Chưa đăng nhập -> Tạm dừng sync outbox
        return;
      }
      const accessToken = auth.accessToken;

      const pendingItems = await recordingDatabase.getPendingOutbox(auth.user.id);
      if (pendingItems.length === 0) return;

      console.log(
        `[syncService] Bắt đầu đồng bộ outbox: tìm thấy ${pendingItems.length} tác vụ đang chờ xử lý...`,
      );
      logSync("RUN_ITEMS", { runId, items: pendingItems.map(item => ({ id: item.id,
        operation: item.operation, clientRecordingId: item.clientRecordingId, attemptCount: item.attemptCount })) });

      const blockedRecordings = new Set<string>();
      for (const item of pendingItems) {
        if (blockedRecordings.has(item.clientRecordingId)) continue;
        const completed = await this.syncItem(item, accessToken);
        // Outbox có thứ tự phụ thuộc. Không gửi BATCH/FINISH khi CREATE trước đó lỗi.
        if (!completed) blockedRecordings.add(item.clientRecordingId);
      }
    } catch (err) {
      console.warn("[syncService] Lỗi khi xử lý sync outbox:", err);
    } finally {
      isSyncing = false;
      const waiters = syncWaiters;
      syncWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  },

  /**
   * Xử lý từng tác vụ đồng bộ cụ thể
   */
  async syncItem(
    item: SyncOutboxItem,
    accessToken: string,
  ): Promise<boolean> {
    const itemStartedAt = Date.now();
    const itemLog = { itemId: item.id, operation: item.operation, clientRecordingId: item.clientRecordingId };
    try {
      const auth = await readStoredAuth();
      const recording = await recordingDatabase.getRecording(item.clientRecordingId);
      if (!auth || auth.accessToken !== accessToken || recording?.ownerId !== auth.user.id) {
        logSync("ITEM_SKIP", { ...itemLog, reason: !auth ? "Chưa đăng nhập" :
          auth.accessToken !== accessToken ? "Token đã thay đổi" : "Không có recording hoặc khác chủ sở hữu" });
        return false;
      }
      logSync("ITEM_START", { ...itemLog, attemptCount: item.attemptCount, localStatus: recording.status });
      await recordingDatabase.updateOutboxItem(item.id, "SYNCING");
      const payload = JSON.parse(item.payloadJson);
      let completedServerTrailId: string | null = null;

      switch (item.operation) {
        case "CREATE_RECORDING": {
          const res = await personalTrailApi.startRecording(
            {
              clientRecordingId: item.clientRecordingId,
              startedAt: payload.startedAt,
            },
            accessToken,
          );

          if (res?.data?.serverRecordingId) {
            await recordingDatabase.attachServerRecordingId(item.clientRecordingId, res.data.serverRecordingId);
          } else {
            throw new Error("Máy chủ không trả về serverRecordingId.");
          }
          break;
        }

        case "BATCH_POINTS": {
          const serverId = await ensureServerRecordingId(
            item.clientRecordingId,
            accessToken,
          );

          await uploadAllPendingSamples(
            item.clientRecordingId,
            serverId,
            accessToken,
          );
          break;
        }

        case "UPDATE_STATUS": {
          const serverId = await ensureServerRecordingId(
            item.clientRecordingId,
            accessToken,
          );

          await personalTrailApi.updateRecordingStatus(
            serverId,
            {
              clientRecordingId: item.clientRecordingId,
              status: payload.status,
              timestamp: payload.timestamp || new Date().toISOString(),
              currentSegmentId: payload.currentSegmentId,
            },
            accessToken,
          );
          break;
        }

        case "FINISH_RECORDING":
        case "CREATE_TRAIL": {
          const serverId = await ensureServerRecordingId(
            item.clientRecordingId,
            accessToken,
          );

          // A previous finish may have committed even if its response was lost.
          const status = await personalTrailApi.getRecordingStatus(serverId, accessToken);
          if (status.data?.status === "READY" && status.data.serverPersonalTrailId) {
            completedServerTrailId = status.data.serverPersonalTrailId;
            await recordingDatabase.updateRecordingStatus(item.clientRecordingId, "READY", {
              serverPersonalTrailId: completedServerTrailId,
              lastSyncedAt: new Date().toISOString(),
            });
            break;
          }

          // Không cho phép hoàn tất trên backend khi thiết bị vẫn còn mẫu GPS chưa gửi.
          await uploadAllPendingSamples(
            item.clientRecordingId,
            serverId,
            accessToken,
          );

          const res = await personalTrailApi.finishRecording(
            serverId,
            {
              clientRecordingId: item.clientRecordingId,
              endedAt: payload.endedAt || recording.endedAt || item.createdAt,
              checkpoints: payload.checkpoints || [],
              trailMetadata: {
                title:
                  payload.title ||
                  payload.trailMetadata?.title ||
                  "Cung đường cá nhân",
                description:
                  payload.description ||
                  payload.trailMetadata?.description ||
                  "",
                region:
                  payload.region || payload.trailMetadata?.region || "Lâm Đồng",
                difficulty: mapDifficultyToBackend(
                  payload.difficulty ||
                    payload.trailMetadata?.difficulty ||
                    "Trung bình",
                ),
                terrainType:
                  payload.terrainType ||
                  payload.trailMetadata?.terrainType ||
                  "Rừng & Đồi dốc",
                visibility:
                  payload.visibility ||
                  payload.trailMetadata?.visibility ||
                  "PRIVATE",
              },
              provisionalTelemetry: payload.provisionalTelemetry || {
                distanceKm: Number(payload.distanceKm || 0),
                elevationGainM: Number(payload.elevationGainM || 0),
                duration: payload.duration || "0 phút",
                elapsedSeconds: Number(payload.elapsedSeconds || 0),
              },
            },
            accessToken,
          );

          if (!res?.success || res.data?.status !== "READY" || !res.data.serverPersonalTrailId) {
            throw new Error("Máy chủ chưa xác nhận READY. Giữ dữ liệu để đối soát.");
          }
          if (res.data.serverPersonalTrailId) {
            const serverPersonalTrailId = res.data.serverPersonalTrailId;
            completedServerTrailId = serverPersonalTrailId;
            await recordingDatabase.updateRecordingStatus(
              item.clientRecordingId,
              "READY",
              {
                serverPersonalTrailId,
                lastSyncedAt: new Date().toISOString(),
              },
            );

          }
          break;
        }
      }

      // Đánh dấu hoàn tất
      await recordingDatabase.updateOutboxItem(item.id, "SYNCED");

      if (completedServerTrailId) {
        console.log("[syncService] Đã đồng bộ hoàn tất Personal Trail", {
          trailName: payload.title || payload.trailMetadata?.title || "Cung đường cá nhân",
          clientRecordingId: item.clientRecordingId,
          serverPersonalTrailId: completedServerTrailId,
        });
        notifySyncCompleted();
      }

      console.log(
        `[syncService] Đã đồng bộ thành công tác vụ ${item.operation} (id: ${item.id})`,
      );
      return true;
    } catch (error: any) {
      if (error instanceof PersonalTrailYield) {
        logSync("ITEM_PENDING", { ...itemLog, reason: "UPLOAD_YIELD", attemptCount: item.attemptCount });
        await recordingDatabase.updateOutboxItem(item.id, "PENDING", { nextRetryAt: null });
        return false;
      }
      console.warn(
        `[syncService] Lỗi ${item.operation} của outbox item ${item.id}:`,
        {
          message: error?.message,
          status: error?.status,
          code: error?.code,
          details: error?.details,
          cause: error?.cause,
        },
      );

      // Nếu lỗi 401 thì không tăng attempt vô ích
      if (error?.status === 401) {
        await recordingDatabase.updateOutboxItem(item.id, "PENDING", {
          nextRetryAt: new Date(Date.now() + 15_000).toISOString(),
        });
        return false;
      }

      // Non-retryable errors require reconciliation or a deliberate manual retry.
      if (error?.retryable === false || [400, 403, 404].includes(error?.status) ||
          (error?.status === 409 && error?.retryable !== true)) {
        if (error?.code === "PERSONAL_TRAIL_TRANSACTION_UNAVAILABLE" ||
            error?.code === "RECORDING_ALREADY_FINISHED") {
          const recording = await recordingDatabase.getRecording(item.clientRecordingId);
          if (recording?.serverRecordingId) {
            try {
              const status = await personalTrailApi.getRecordingStatus(recording.serverRecordingId, accessToken);
              if (status.data?.status === "READY" && status.data.serverPersonalTrailId) {
                await recordingDatabase.updateRecordingStatus(item.clientRecordingId, "READY", {
                  serverPersonalTrailId: status.data.serverPersonalTrailId,
                  lastSyncedAt: new Date().toISOString(),
                });
                await recordingDatabase.updateOutboxItem(item.id, "SYNCED");
                notifySyncCompleted();
                return true;
              }
            } catch { /* Preserve the operation when reconciliation is unavailable. */ }
          }
        }
        await recordingDatabase.updateOutboxItem(item.id, "FAILED", { nextRetryAt: null });
        logSync("ITEM_BLOCKED", { ...itemLog, code: error?.code, reason: "Lỗi không tự retry; cần kiểm tra hoặc thử lại thủ công" });
        return false;
      }



      // Tính thời gian Exponential Backoff có Jitter
      const nextAttempt = (item.attemptCount || 0) + 1;
      const baseDelay = Math.min(300_000, 2 ** (nextAttempt - 1) * 1000);
      const jitter = Math.random() * 1000;
      const nextRetryAt = new Date(
        Date.now() + baseDelay + jitter,
      ).toISOString();

      await recordingDatabase.updateOutboxItem(item.id, "FAILED", {
        attemptCount: nextAttempt,
        nextRetryAt: nextAttempt < 3 ? nextRetryAt : null,
      });
      logSync("ITEM_RETRY_STATE", { ...itemLog, attemptCount: nextAttempt,
        nextRetryAt: nextAttempt < 3 ? nextRetryAt : null,
        automaticRetryStopped: nextAttempt >= 3, code: error?.code, status: error?.status });
      return false;
    } finally {
      logSync("ITEM_END", { ...itemLog, elapsedMs: Date.now() - itemStartedAt });
    }
  },

  /**
   * Đăng ký lắng nghe sự kiện đồng bộ hoàn tất (để UI tự động reload)
   */
  onSyncCompleted(listener: SyncListener) {
    syncListeners.add(listener);
    return () => syncListeners.delete(listener);
  },

  notifySyncCompleted,
};