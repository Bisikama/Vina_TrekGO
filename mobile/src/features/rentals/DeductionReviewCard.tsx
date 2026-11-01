import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius } from "@/constants/theme";
import {
  deductionReviewApi,
  evidenceIdsOf,
  getApiErrorReason,
  isUnknownOutcome,
  newIdempotencyKey,
  reviewReasonMessages,
  type EvidenceMedia,
  type PickedEvidence,
  type RentalAssessmentItem,
} from "@/features/rentals/deduction-review-api";
import type { RentalDepositItem } from "@/features/rentals/types";

const MAX_EVIDENCE_FILES = 10;

const money = (value: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

function remainingText(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Đã hết hạn";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${minutes} phút`;
}

function messageOf(error: unknown, fallback: string) {
  const code = getApiErrorReason(error);
  if (code && reviewReasonMessages[code]) return reviewReasonMessages[code];
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Khoản trừ cọc của một thiết bị: xem chứng cứ, hạn phản hồi, gửi phản đối (RB-API-609). */
export function DeductionReviewCard({
  orderId,
  item,
  currency,
  accessToken,
  onChanged,
}: {
  orderId: string;
  item: RentalDepositItem;
  currency?: string;
  accessToken?: string | null;
  onChanged: () => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [assessment, setAssessment] = useState<RentalAssessmentItem>();
  const [media, setMedia] = useState<EvidenceMedia[]>([]);
  const [mediaFailed, setMediaFailed] = useState(0);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<PickedEvidence[]>([]);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reviewKey = useRef<string | null>(null);
  const uploadedIds = useRef<Map<string, string>>(new Map());
  const expiredRefetched = useRef(false);

  const approved = item.approvedDeduction ?? 0;
  const assessmentId = item.assessmentId ?? null;
  const reasonCode = item.cannotSubmitReviewReason ?? null;
  const published = Boolean(item.exceptionCaseId && item.evidenceAccessibleAt);

  useEffect(() => {
    if (!item.reviewWindowEndsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [item.reviewWindowEndsAt]);

  useEffect(() => {
    if (!item.canSubmitReview || !item.reviewWindowEndsAt || expiredRefetched.current) return;
    if (new Date(item.reviewWindowEndsAt).getTime() <= now) {
      expiredRefetched.current = true;
      setFormOpen(false);
      void onChanged();
    }
  }, [item.canSubmitReview, item.reviewWindowEndsAt, now, onChanged]);

  if (approved <= 0 || !assessmentId) return null;

  async function loadEvidence() {
    if (!accessToken || !assessmentId) return;
    setEvidenceLoading(true);
    setError(undefined);
    try {
      const result = await deductionReviewApi.getAssessment(orderId, accessToken);
      const match = result.items.find((entry) => entry.inspectionId === assessmentId);
      setAssessment(match);
      const settled = await Promise.allSettled(
        evidenceIdsOf(match).map((id) => deductionReviewApi.getEvidenceMedia(id, accessToken)),
      );
      setMedia(settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : [])));
      setMediaFailed(settled.filter((entry) => entry.status === "rejected").length);
    } catch (loadError) {
      setError(messageOf(loadError, "Không tải được chứng cứ."));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function toggleEvidence() {
    const next = !evidenceOpen;
    setEvidenceOpen(next);
    if (next && !assessment) void loadEvidence();
  }

  async function runAction(name: "report" | "confirm") {
    if (!accessToken || !assessmentId) return;
    setBusy(name);
    setError(undefined);
    try {
      if (name === "report") {
        await deductionReviewApi.reportAccessProblem(orderId, assessmentId, accessToken);
        setNotice("Đã ghi nhận. TrekGo giữ nguyên khoản liên quan và sẽ khôi phục quyền xem chứng cứ cho bạn.");
      } else {
        await deductionReviewApi.confirmAccessRestored(orderId, assessmentId, accessToken);
        setNotice("Đã gửi xác nhận. Khi hệ thống kiểm tra xong, bạn có đủ 48 giờ mới để phản hồi.");
      }
      await onChanged();
    } catch (actionError) {
      setError(messageOf(actionError, "Thao tác chưa thể hoàn tất."));
    } finally {
      setBusy(undefined);
    }
  }

  async function pickFiles() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Cần quyền truy cập thư viện ảnh để đính kèm chứng cứ.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_EVIDENCE_FILES,
      quality: 0.8,
    });
    if (result.canceled) return;
    setFiles((current) => [...current, ...result.assets].slice(0, MAX_EVIDENCE_FILES));
    reviewKey.current = null;
  }

  async function submit() {
    if (!accessToken || !assessmentId) return;
    const text = reason.trim();
    if (text.length < 3) {
      setError("Lý do cần ít nhất 3 ký tự.");
      return;
    }
    setBusy("submit");
    setError(undefined);
    try {
      const evidenceIds: string[] = [];
      for (const file of files) {
        let id = uploadedIds.current.get(file.uri);
        if (!id) {
          id = await deductionReviewApi.uploadEvidence(file, accessToken);
          uploadedIds.current.set(file.uri, id);
        }
        evidenceIds.push(id);
      }
      if (!reviewKey.current) reviewKey.current = newIdempotencyKey("assessment-review");
      await deductionReviewApi.submitReview(
        orderId,
        { assessmentId, reason: text, evidenceIds },
        reviewKey.current,
        accessToken,
      );
      reviewKey.current = null;
      setFormOpen(false);
      setReason("");
      setFiles([]);
      setNotice(undefined); // khối trạng thái vàng phía trên đã báo "Admin đang xem xét"
      await onChanged();
    } catch (submitError) {
      if (isUnknownOutcome(submitError)) {
        setError("Mất kết nối khi gửi. Bấm “Gửi phản đối” lần nữa để thử lại an toàn.");
        return;
      }
      reviewKey.current = null;
      const code = getApiErrorReason(submitError);
      if (code === "REVIEW_ALREADY_SUBMITTED" || code === "USER_REVIEW_WINDOW_EXPIRED") setFormOpen(false);
      setError(messageOf(submitError, "Không gửi được phản đối."));
      await onChanged();
    } finally {
      setBusy(undefined);
    }
  }

  const status = (() => {
    if (item.reviewStatus === "SUBMITTED")
      return { warn: true, text: "Bạn đã gửi phản đối. Admin đang xem xét, khoản cọc được giữ tới khi có kết quả." };
    if (item.reviewStatus === "RESOLVED")
      return { warn: false, text: "Phản đối của bạn đã được Admin xử lý. Theo dõi kết quả hoàn cọc ở trên." };
    if (item.canSubmitReview && item.reviewWindowEndsAt)
      return {
        warn: false,
        text: `${remainingText(item.reviewWindowEndsAt, now)} để phản đối · hạn ${dateTime(item.reviewWindowEndsAt)}. Hết hạn mà không phản đối, khoản trừ sẽ được quyết toán.`,
      };
    if (reasonCode === "EVIDENCE_ACCESS_INTERRUPTED" && item.evidenceAccessCustomerConfirmationRequired)
      return { warn: true, text: "Bạn đã báo không xem được chứng cứ. Hãy mở lại chứng cứ; nếu xem được, bấm “Tôi đã xem được chứng cứ”." };
    if (reasonCode && reasonCode !== "NO_APPROVED_DEDUCTION" && reviewReasonMessages[reasonCode])
      return { warn: true, text: reviewReasonMessages[reasonCode] };
    return null;
  })();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>KHOẢN TRỪ CỌC ĐÃ DUYỆT</Text>
        <Text style={styles.amount}>{money(approved, currency)}</Text>
      </View>

      {status ? (
        <Text style={[styles.status, status.warn ? styles.statusWarn : styles.statusOk]}>{status.text}</Text>
      ) : null}

      <View style={styles.actions}>
        {published ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={toggleEvidence}>
            <Text style={styles.secondaryText}>{evidenceOpen ? "Ẩn chứng cứ" : "Xem chứng cứ"}</Text>
          </TouchableOpacity>
        ) : null}
        {item.canSubmitReview && !formOpen ? (
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => {
              setFormOpen(true);
              setNotice(undefined);
              setError(undefined);
            }}
          >
            <Text style={styles.dangerText}>Phản đối khoản trừ</Text>
          </TouchableOpacity>
        ) : null}
        {item.evidenceAccessCustomerConfirmationRequired ? (
          <TouchableOpacity
            style={[styles.primaryButton, busy === "confirm" && styles.disabled]}
            disabled={busy === "confirm"}
            onPress={() => void runAction("confirm")}
          >
            <Text style={styles.primaryText}>{busy === "confirm" ? "Đang gửi..." : "Tôi đã xem được chứng cứ"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {item.canSubmitReview ? (
        <TouchableOpacity disabled={busy === "report"} onPress={() => void runAction("report")}>
          <Text style={styles.link}>{busy === "report" ? "Đang gửi..." : "Tôi không xem được chứng cứ"}</Text>
        </TouchableOpacity>
      ) : null}

      {evidenceOpen ? (
        <View style={styles.box}>
          {evidenceLoading ? (
            <ActivityIndicator color={Colors.primaryDark} />
          ) : (
            <>
              {assessment?.findings?.map((finding, index) => (
                <Text key={`${finding.ruleId}-${index}`} style={styles.finding}>
                  • Lỗi ghi nhận × {finding.quantity}: {money(finding.amount, currency)}
                </Text>
              ))}
              <View style={styles.grid}>
                {media.map((entry) =>
                  entry.resourceType === "VIDEO" ? (
                    <TouchableOpacity key={entry.mediaId} style={styles.videoTile} onPress={() => void Linking.openURL(entry.url)}>
                      <Text style={styles.videoText}>▶ Mở video</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity key={entry.mediaId} onPress={() => void Linking.openURL(entry.url)}>
                      <Image source={{ uri: entry.url }} style={styles.thumb} />
                    </TouchableOpacity>
                  ),
                )}
              </View>
              {!media.length ? <Text style={styles.muted}>Chưa có tệp chứng cứ hiển thị được.</Text> : null}
              {mediaFailed > 0 ? (
                <Text style={styles.warnText}>
                  {mediaFailed} tệp chưa tải được. Nếu vẫn không xem được, bấm “Tôi không xem được chứng cứ”.
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {formOpen ? (
        <View style={styles.box}>
          <Text style={styles.label}>Lý do phản đối</Text>
          <TextInput
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              reviewKey.current = null;
            }}
            maxLength={3000}
            multiline
            placeholder="Ví dụ: Vết xước này đã có từ khi tôi nhận thiết bị."
            placeholderTextColor={Colors.onSurfaceMuted}
            style={styles.input}
          />
          <Text style={styles.counter}>{reason.trim().length}/3000</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickFiles()}>
            <Text style={styles.secondaryText}>
              Đính kèm ảnh/video ({files.length}/{MAX_EVIDENCE_FILES}, không bắt buộc)
            </Text>
          </TouchableOpacity>
          {files.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.fileName || `Tệp ${index + 1}`}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFiles((current) => current.filter((_, i) => i !== index));
                  reviewKey.current = null;
                }}
              >
                <Text style={styles.remove}>Bỏ</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.dangerButton, busy === "submit" && styles.disabled]}
              disabled={busy === "submit"}
              onPress={() => void submit()}
            >
              <Text style={styles.dangerText}>{busy === "submit" ? "Đang gửi..." : "Gửi phản đối"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} disabled={busy === "submit"} onPress={() => setFormOpen(false)}>
              <Text style={styles.secondaryText}>Huỷ</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8, padding: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: "#F3C4C1", backgroundColor: "#FFF8F7" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eyebrow: { color: "#8C1D18", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  amount: { color: "#8C1D18", fontSize: 15, fontWeight: "800" },
  status: { marginTop: 8, padding: 9, borderRadius: Radius.md, borderWidth: 1, fontSize: 11, lineHeight: 16 },
  statusOk: { borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale, color: Colors.primaryDark },
  statusWarn: { borderColor: "#F2D49B", backgroundColor: "#FFF6E0", color: "#7A4B00" },
  actions: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryButton: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, backgroundColor: Colors.surfaceContainerLowest, alignSelf: "flex-start" },
  secondaryText: { color: Colors.onSurface, fontSize: 11, fontWeight: "600" },
  dangerButton: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: "#B3261E" },
  dangerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  primaryButton: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  primaryText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  link: { marginTop: 8, color: Colors.onSurfaceVariant, fontSize: 11, textDecorationLine: "underline" },
  box: { marginTop: 10, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLowest },
  finding: { color: Colors.onSurface, fontSize: 11, lineHeight: 17 },
  grid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  thumb: { width: 84, height: 84, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  videoTile: { width: 84, height: 84, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.inkDeep },
  videoText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  muted: { marginTop: 6, color: Colors.onSurfaceVariant, fontSize: 11 },
  warnText: { marginTop: 6, color: "#7A4B00", fontSize: 11 },
  label: { color: Colors.onSurface, fontSize: 12, fontWeight: "700" },
  input: { marginTop: 6, minHeight: 90, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, color: Colors.onSurface, fontSize: 13, textAlignVertical: "top" },
  counter: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 9, textAlign: "right" },
  fileRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fileName: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 11 },
  remove: { color: "#B3261E", fontSize: 11, fontWeight: "700" },
  notice: { marginTop: 8, color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  error: { marginTop: 8, color: "#A32020", fontSize: 11, fontWeight: "600" },
});
