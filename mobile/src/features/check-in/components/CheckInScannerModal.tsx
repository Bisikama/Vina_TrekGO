import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type ScanResultKind = "success" | "duplicate" | "error";

export interface ScanResult {
  kind: ScanResultKind;
  title: string;
  message?: string;
}

export interface CheckInScannerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Xử lý dữ liệu QR thô và trả về kết quả để hiển thị trên camera */
  onScan: (raw: string) => Promise<ScanResult> | ScanResult;
  checkedCount: number;
  totalCount: number;
  /** Chỉ dùng trong DEV: mô phỏng quét khi không có camera */
  onSimulate?: () => Promise<ScanResult | null> | ScanResult | null;
}

const SCAN_LOCK_MS = 1600;
const SAME_CODE_IGNORE_MS = 3500;

const RESULT_STYLE: Record<ScanResultKind, { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { bg: "rgba(22, 101, 52, 0.92)", border: "#9fe870", icon: "checkmark-circle", color: "#9fe870" },
  duplicate: { bg: "rgba(122, 91, 0, 0.92)", border: "#fed018", icon: "alert-circle", color: "#fed018" },
  error: { bg: "rgba(147, 0, 10, 0.92)", border: "#ff8a80", icon: "close-circle", color: "#ffb4ab" },
};

export function CheckInScannerModal({
  visible,
  onClose,
  onScan,
  checkedCount,
  totalCount,
  onSimulate,
}: CheckInScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const lockedRef = useRef(false);
  const lastCodeRef = useRef<{ data: string; at: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanLine = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, scanLine]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const showResult = (r: ScanResult) => {
    setResult(r);
    resultAnim.setValue(0);
    Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(resultAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setResult(null),
      );
    }, 2600);
  };

  const handleBarcode = async ({ data }: { data: string }) => {
    if (!data || lockedRef.current) return;
    const now = Date.now();
    const last = lastCodeRef.current;
    if (last && last.data === data && now - last.at < SAME_CODE_IGNORE_MS) return;

    lockedRef.current = true;
    lastCodeRef.current = { data, at: now };
    try {
      const res = await Promise.resolve(onScan(data));
      showResult(res);
    } catch (err: any) {
      showResult({
        kind: "error",
        title: "Lỗi kết nối",
        message: err?.message || "Không thể thực hiện điểm danh.",
      });
    } finally {
      setTimeout(() => {
        lockedRef.current = false;
      }, SCAN_LOCK_MS);
    }
  };

  const handleSimulate = async () => {
    if (!onSimulate) return;
    try {
      const r = await Promise.resolve(onSimulate());
      if (r) showResult(r);
    } catch (err: any) {
      showResult({
        kind: "error",
        title: "Lỗi kết nối",
        message: err?.message || "Không thể thực hiện mô phỏng.",
      });
    }
  };

  const handlePickImage = async () => {
    try {
      setIsPicking(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsPicking(false);
        return;
      }

      const imageUri = res.assets[0].uri;
      const scanResults = await scanFromURLAsync(imageUri, ["qr"]);

      if (scanResults && scanResults.length > 0 && scanResults[0]?.data) {
        const raw = scanResults[0].data;
        const scanRes = await Promise.resolve(onScan(raw));
        showResult(scanRes);
      } else {
        showResult({
          kind: "error",
          title: "Không tìm thấy mã QR",
          message: "Ảnh bạn chọn không có mã QR rõ nét hoặc không thuộc hệ thống TrekGo.",
        });
      }
    } catch (err: any) {
      showResult({
        kind: "error",
        title: "Lỗi đọc ảnh",
        message: err?.message || "Không thể quét mã QR từ ảnh đã chọn.",
      });
    } finally {
      setIsPicking(false);
    }
  };

  const handleShow = () => {
    setTorch(false);
    setResult(null);
    lockedRef.current = false;
    lastCodeRef.current = null;
    setIsPicking(false);
  };

  const progress = totalCount > 0 ? checkedCount / totalCount : 0;
  const rs = result ? RESULT_STYLE[result.kind] : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={handleShow}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission ? (
          <SafeAreaView style={styles.permissionBox}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
          </SafeAreaView>
        ) : !permission.granted ? (
          <SafeAreaView style={styles.permissionBox}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={44} color={Colors.inkDeep} />
            </View>
            <Text style={styles.permTitle}>Cần quyền truy cập camera</Text>
            <Text style={styles.permDesc}>
              Cho phép TrekGo dùng camera để quét mã QR điểm danh của thành viên đoàn.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.permBtnText}>Cấp quyền Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permGalleryBtn}
              onPress={handlePickImage}
              disabled={isPicking}
              activeOpacity={0.85}
            >
              {isPicking ? (
                <ActivityIndicator size="small" color="#0c2000" />
              ) : (
                <>
                  <Ionicons name="images-outline" size={18} color="#0c2000" />
                  <Text style={styles.permGalleryBtnText}>Tải ảnh QR từ thư viện ảnh</Text>
                </>
              )}
            </TouchableOpacity>

            {onSimulate ? (
              <TouchableOpacity style={styles.permLink} onPress={handleSimulate}>
                <Text style={styles.permLinkText}>Mô phỏng quét (DEV)</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.permLink} onPress={onClose}>
              <Text style={styles.permLinkText}>Đóng</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleBarcode}
            />

            <SafeAreaView style={styles.overlay}>
              {/* Top bar */}
              <View style={styles.topBar}>
                <TouchableOpacity style={styles.circleBtn} onPress={onClose} activeOpacity={0.8}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>

                <View style={styles.counterPill}>
                  <Ionicons name="people" size={14} color="#9fe870" />
                  <Text style={styles.counterText}>
                    {checkedCount}
                    <Text style={styles.counterTotal}> / {totalCount}</Text>
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={handlePickImage}
                    disabled={isPicking}
                    activeOpacity={0.8}
                    accessibilityLabel="Chọn ảnh QR từ thư viện"
                  >
                    {isPicking ? (
                      <ActivityIndicator size="small" color={LIME} />
                    ) : (
                      <Ionicons name="images-outline" size={20} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.circleBtn, torch && styles.circleBtnActive]}
                    onPress={() => setTorch((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={torch ? "flash" : "flash-off-outline"}
                      size={20}
                      color={torch ? "#0c2000" : "#ffffff"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>

              {/* Viewfinder */}
              <View style={styles.center}>
                <View
                  style={[
                    styles.target,
                    rs ? { borderColor: rs.border, borderWidth: 2 } : null,
                  ]}
                >
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [
                          {
                            translateY: scanLine.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 252],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.instruction}>
                  Đưa mã QR điểm danh của thành viên vào khung.{"\n"}Camera sẽ tự quét liên tục.
                </Text>
              </View>

              {/* Bottom: result + actions */}
              <View style={styles.bottom}>
                {result && rs ? (
                  <Animated.View
                    style={[
                      styles.resultCard,
                      { backgroundColor: rs.bg, borderColor: rs.border },
                      {
                        opacity: resultAnim,
                        transform: [
                          {
                            translateY: resultAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [30, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name={rs.icon} size={30} color={rs.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{result.title}</Text>
                      {result.message ? (
                        <Text style={styles.resultMsg}>{result.message}</Text>
                      ) : null}
                    </View>
                  </Animated.View>
                ) : (
                  <View style={styles.idleHint}>
                    <View style={styles.liveDot} />
                    <Text style={styles.idleHintText}>Đang chờ mã QR...</Text>
                  </View>
                )}

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={handlePickImage}
                    disabled={isPicking}
                    activeOpacity={0.85}
                  >
                    {isPicking ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={16} color="#ffffff" />
                        <Text style={styles.ghostBtnText}>Tải ảnh QR</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {onSimulate ? (
                    <TouchableOpacity style={styles.ghostBtn} onPress={handleSimulate} activeOpacity={0.85}>
                      <Ionicons name="flask-outline" size={16} color="#ffffff" />
                      <Text style={styles.ghostBtnText}>Mô phỏng (DEV)</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
                    <Ionicons name="list" size={16} color="#0c2000" />
                    <Text style={styles.doneBtnText}>Danh sách</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

const LIME = "#9fe870";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  permissionBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: Colors.surface,
  },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...Shadows.card,
  },
  permTitle: { fontSize: 20, fontWeight: "900", color: Colors.onSurface, textAlign: "center" },
  permDesc: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
  },
  permBtn: {
    backgroundColor: Colors.inkDeep,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  permBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  permGalleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: LIME,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: 12,
  },
  permGalleryBtnText: { color: "#0c2000", fontWeight: "800", fontSize: 14 },
  permLink: { marginTop: 14, padding: 6 },
  permLinkText: { color: Colors.onSurfaceVariant, fontWeight: "700", fontSize: 13 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  circleBtnActive: { backgroundColor: LIME, borderColor: LIME },
  counterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: "rgba(22,51,0,0.85)",
    borderWidth: 1,
    borderColor: LIME,
  },
  counterText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  counterTotal: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 4,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: LIME, borderRadius: 2 },
  center: { alignItems: "center" },
  target: {
    width: 260,
    height: 260,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  corner: { position: "absolute", width: 30, height: 30, borderColor: LIME, zIndex: 2 },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: Radius.lg },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: Radius.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: Radius.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: Radius.lg },
  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: LIME,
    shadowColor: LIME,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  instruction: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 18,
    lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottom: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  resultTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  resultMsg: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2, lineHeight: 17 },
  idleHint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME },
  idleHintText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  actionsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  ghostBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: LIME,
  },
  doneBtnText: { color: "#0c2000", fontSize: 13, fontWeight: "800" },
});
