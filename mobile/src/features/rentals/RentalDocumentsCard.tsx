import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { rentalApi } from "@/features/rentals/api";
import type { RentalDocumentSummary, RentalDocumentVerification } from "@/features/rentals/types";
import { shortDocumentNo } from "@/features/rentals/display";

// Chứng từ của đơn thuê: biên bản bàn giao, phụ lục gia hạn, biên nhận trả đồ...
// Danh sách: GET /rental-orders/:id/documents; tải PDF: /rental-documents/:id/download (đường dẫn ký 10 phút);
// xác minh toàn vẹn: /rental-documents/:id/verification.

const TYPE_LABELS: Record<string, string> = {
  HANDOVER: "Biên bản bàn giao",
  EXTENSION_APPENDIX: "Phụ lục gia hạn",
  RETURN_RECEIPT: "Biên nhận trả đồ",
  SCHEDULE_NOTICE: "Thông báo lịch giao nhận",
  CORRECTION_NOTICE: "Thông báo đính chính",
};

const VERIFY_LABELS: Record<string, { text: string; color: string }> = {
  VERIFIED: { text: "Đã xác minh: nội dung và tệp PDF khớp bản gốc", color: "#047857" },
  SNAPSHOT_ONLY: { text: "Nội dung khớp bản gốc, tệp PDF chưa sẵn sàng để đối chiếu", color: "#b45309" },
  FAILED: { text: "Không khớp bản gốc, vui lòng liên hệ TrekGo", color: Colors.error },
};

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
};

export function RentalDocumentsCard({ orderId, accessToken }: { orderId: string; accessToken?: string | null }) {
  const [documents, setDocuments] = useState<RentalDocumentSummary[] | null>(null);
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [downloading, setDownloading] = useState<string>();
  const [verifying, setVerifying] = useState<string>();
  const [verifications, setVerifications] = useState<Record<string, RentalDocumentVerification>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(undefined);
    try {
      setDocuments(await rentalApi.listOrderDocuments(orderId, accessToken));
    } catch (requestError) {
      setError(errorText(requestError, "Không tải được chứng từ của đơn."));
      setDocuments([]);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(document: RentalDocumentSummary) {
    if (!accessToken) return;
    setActionError(undefined);
    setDownloading(document.id);
    try {
      const result = await rentalApi.getDocumentDownload(document.id, accessToken);
      await Linking.openURL(result.downloadUrl);
    } catch (requestError) {
      setActionError(errorText(requestError, "Chưa mở được chứng từ."));
    } finally {
      setDownloading(undefined);
    }
  }

  async function verify(document: RentalDocumentSummary) {
    if (!accessToken) return;
    setActionError(undefined);
    setVerifying(document.id);
    try {
      const result = await rentalApi.verifyDocument(document.id, accessToken);
      setVerifications((current) => ({ ...current, [document.id]: result }));
    } catch (requestError) {
      setActionError(errorText(requestError, "Chưa xác minh được chứng từ."));
    } finally {
      setVerifying(undefined);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.flexOne}>
          <Text style={styles.title}>Chứng từ</Text>
          <Text style={styles.subtitle}>Biên bản và biên nhận được tạo tự động theo từng bước của đơn</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => void load()}>
          <Ionicons name="refresh" size={17} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {documents === null ? (
        <ActivityIndicator style={styles.loader} color={Colors.primaryDark} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : documents.length === 0 ? (
        <Text style={styles.empty}>Chưa có chứng từ. Biên bản bàn giao sẽ có sau khi bạn nhận đồ.</Text>
      ) : (
        documents.map((document, index) => {
          const verification = verifications[document.id];
          const verifyLabel = verification ? VERIFY_LABELS[verification.verificationStatus] : undefined;
          return (
            <View key={document.id} style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.flexOne}>
                <Text style={styles.docName}>{TYPE_LABELS[document.type] ?? document.type}</Text>
                <Text style={styles.docMeta}>
                  Số {shortDocumentNo(document.documentNo, document.type)}
                  {document.issuedAt ? ` · ${formatDate(document.issuedAt)}` : ""}
                </Text>
                {document.renderStatus === "PENDING_RENDER" ? (
                  <Text style={[styles.docMeta, styles.pending]}>Đang tạo PDF</Text>
                ) : document.renderStatus === "RENDER_FAILED" ? (
                  <Text style={[styles.docMeta, styles.failed]}>Tạo PDF lỗi</Text>
                ) : null}
                {verifyLabel ? <Text style={[styles.docMeta, { color: verifyLabel.color }]}>{verifyLabel.text}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, verifying === document.id && styles.disabled]}
                  disabled={verifying === document.id}
                  onPress={() => void verify(document)}
                >
                  <Text style={styles.secondaryText}>{verifying === document.id ? "..." : "Xác minh"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, (!document.downloadReady || downloading === document.id) && styles.disabled]}
                  disabled={!document.downloadReady || downloading === document.id}
                  onPress={() => void download(document)}
                >
                  <Text style={styles.primaryText}>{downloading === document.id ? "Đang mở" : "Mở PDF"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  flexOne: { flex: 1 },
  title: { color: Colors.onSurface, fontSize: 17, fontWeight: "600" },
  subtitle: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15 },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  loader: { marginTop: 14 },
  empty: { marginTop: 14, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  errorText: { marginTop: 12, color: Colors.error, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  rowDivider: { paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHighest },
  docName: { color: Colors.onSurface, fontSize: 14, fontWeight: "600" },
  docMeta: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 15 },
  pending: { color: "#b45309" },
  failed: { color: Colors.error },
  actions: { gap: 6 },
  primaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: "center" },
  primaryText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "600" },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    alignItems: "center",
  },
  secondaryText: { color: Colors.onSurface, fontSize: 12, fontWeight: "500" },
  disabled: { opacity: 0.45 },
});
