import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  PaymentWebViewModal,
  type PaymentCompleteResult,
} from "@/features/bookings/components";
import { useTrailAccess } from "../hooks/useTrailAccess";

export interface PurchaseTrailModalProps {
  visible: boolean;
  trailId: string;
  trailName: string;
  onClose: () => void;
  onAccessGranted: () => void;
}

export function PurchaseTrailModal({
  visible,
  trailId,
  trailName,
  onClose,
  onAccessGranted,
}: PurchaseTrailModalProps) {
  const {
    accessInfo,
    purchaseResult,
    activeSession,
    loading,
    error,
    checkAccess,
    purchaseAccess,
    reset,
  } = useTrailAccess();

  const [verifying, setVerifying] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const appStateRef = useRef<string>(AppState.currentState ?? "");

  // Check access whenever modal opens with trailId.
  // Reset is deferred to avoid a synchronous state cascade inside the effect.
  useEffect(() => {
    if (visible && trailId) {
      void checkAccess(trailId);
      return;
    }

    const resetTimer = setTimeout(() => {
      setShowWebView(false);
      setWebViewUrl(null);
      void reset();
    }, 0);

    return () => {
      clearTimeout(resetTimer);
    };
  }, [visible, trailId, checkAccess, reset]);

  // Listen to AppState: when returning to the app, auto-check payment status
  useEffect(() => {
    if (!visible || !trailId) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          (purchaseResult?.accessStatus === "PENDING_PAYMENT" || activeSession)
        ) {
          void handleSilentVerification();
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [visible, trailId, purchaseResult, activeSession]);

  async function handleSilentVerification() {
    try {
      const res = await checkAccess(trailId);
      if (res.hasAccess) {
        Alert.alert(
          "Thanh toán thành công!",
          `Đã xác nhận thanh toán qua VNPAY. Quyền sử dụng cung đường "${trailName}" đã được kích hoạt vĩnh viễn!`,
          [
            {
              text: "Bắt đầu sử dụng",
              onPress: () => {
                setShowWebView(false);
                onAccessGranted();
                onClose();
              },
            },
          ],
        );
      }
    } catch {
      // Silent check failed
    }
  }

  async function handlePurchaseVNPAY() {
    try {
      // Contract: POST /api/v1/trails/{trailId}/purchase
      // Strict body: { paymentMethod: "REDIRECT", gateway: "vnpay" }
      const res = await purchaseAccess(trailId, {
        paymentMethod: "REDIRECT",
        gateway: "vnpay",
      });

      const checkoutUrl = res.checkout?.url || res.checkout?.paymentUrl;

      if (res.accessStatus === "ACTIVE") {
        Alert.alert(
          "Thành công",
          `Cung đường "${trailName}" đã được mở khóa và thêm vào danh sách của bạn!`,
          [
            {
              text: "Tiếp tục",
              onPress: () => {
                onAccessGranted();
                onClose();
              },
            },
          ],
        );
      } else if (res.accessStatus === "PENDING_PAYMENT" && checkoutUrl) {
        // Open directly inside TrekGo app via in-app WebView
        setWebViewUrl(checkoutUrl);
        setShowWebView(true);
      }
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (
        errMsg.includes("unresolved") ||
        err?.code === "PAYMENT_ATTEMPT_IN_PROGRESS" ||
        err?.status === 409
      ) {
        Alert.alert(
          "Giao dịch đang chờ xử lý",
          "Hệ thống đang có một phiên thanh toán trước đó chưa kết thúc. Bạn có thể kiểm tra kết quả giao dịch hoặc mở lại trang thanh toán.",
          [
            {
              text: "Kiểm tra giao dịch",
              onPress: () => void handleVerifyPayment(false),
            },
            {
              text: "Làm mới phiên",
              style: "destructive",
              onPress: () => {
                void reset(trailId);
              },
            },
            { text: "Đóng", style: "cancel" },
          ],
        );
      } else {
        Alert.alert(
          "Lỗi thanh toán",
          errMsg || "Không thể khởi tạo thanh toán VNPAY cho cung đường.",
        );
      }
    }
  }

  async function handleWebViewPaymentComplete(result: PaymentCompleteResult) {
    setShowWebView(false);
    if (result.success) {
      await handleVerifyPayment(true);
    } else {
      if (result.responseCode !== "24") {
        Alert.alert(
          "Kết quả thanh toán",
          result.message || "Giao dịch VNPAY chưa thành công.",
        );
      }
    }
  }

  async function handleVerifyPayment(isAuto = false) {
    setVerifying(true);
    try {
      let res = await checkAccess(trailId);
      if (!res.hasAccess && isAuto) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 1000));
          res = await checkAccess(trailId);
          if (res.hasAccess) break;
        }
      }
      if (res.hasAccess) {
        Alert.alert(
          "Thanh toán thành công!",
          `Đã xác nhận thanh toán qua VNPAY. Quyền sử dụng cung đường "${trailName}" đã được kích hoạt vĩnh viễn!`,
          [
            {
              text: "Tiếp tục tạo chuyến",
              onPress: () => {
                setShowWebView(false);
                onAccessGranted();
                onClose();
              },
            },
          ],
        );
      } else if (!isAuto) {
        Alert.alert(
          "Chưa nhận được thanh toán",
          "Hệ thống chưa ghi nhận giao dịch thành công từ VNPAY. Nếu bạn vừa thanh toán xong, vui lòng đợi vài giây và bấm kiểm tra lại.",
        );
      }
    } catch (err: any) {
      if (!isAuto) {
        Alert.alert("Lỗi", err?.message || "Không thể kiểm tra giao dịch.");
      }
    } finally {
      setVerifying(false);
    }
  }

  function handleCancelSession() {
    Alert.alert(
      "Hủy phiên thanh toán",
      "Bạn có chắc chắn muốn hủy phiên thanh toán hiện tại và bắt đầu lại không?",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Hủy phiên",
          style: "destructive",
          onPress: () => {
            reset(trailId);
          },
        },
      ],
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <View style={styles.headerIconWrapper}>
                <Ionicons name="card-outline" size={18} color={Colors.primaryDark} />
              </View>
              <Text style={styles.headerTitle}>Mở khóa Cung đường Hệ thống</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Trail Info Header Card */}
            <View style={styles.trailCard}>
              <View style={styles.trailCardHeader}>
                <View style={styles.trailBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" />
                  <Text style={styles.trailBadgeText}>Cung đường hệ thống</Text>
                </View>
              </View>
              <Text style={styles.trailName}>{trailName}</Text>
              <Text style={styles.trailSub}>
                Cung đường được TrekGo khảo sát chuẩn xác với dữ liệu trạm dừng và độ cao an toàn.
              </Text>
            </View>

            {loading && !purchaseResult ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.primaryDark} />
                <Text style={styles.loadingText}>
                  Đang kiểm tra quyền truy cập cung đường...
                </Text>
              </View>
            ) : accessInfo?.hasAccess ? (
              /* State: User already owns the trail */
              <View style={styles.ownedBox}>
                <View style={styles.ownedIconWrapper}>
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color="#059669"
                  />
                </View>
                <Text style={styles.ownedTitle}>Đã sở hữu quyền sử dụng</Text>
                <Text style={styles.ownedSub}>
                  Bạn đã có bản quyền sử dụng cung đường này để tạo chuyến đi riêng hoặc khám phá mọi lúc.
                </Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    onAccessGranted();
                    onClose();
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Chọn cung đường này</Text>
                </TouchableOpacity>
              </View>
            ) : (purchaseResult?.accessStatus === "PENDING_PAYMENT" || (Boolean(activeSession?.checkoutUrl) && !accessInfo?.hasAccess)) ? (
              /* State: Pending VNPAY payment session */
              <View style={styles.paymentSection}>
                <View style={styles.pendingBadge}>
                  <ActivityIndicator size="small" color="#D97706" />
                  <Text style={styles.pendingBadgeText}>Đang chờ thanh toán VNPAY</Text>
                </View>

                {/* Amount display */}
                <View style={styles.priceTag}>
                  <Text style={styles.priceLabel}>Số tiền thanh toán:</Text>
                  <Text style={styles.priceAmount}>
                    {purchaseResult?.amount
                      ? `${Number(purchaseResult.amount).toLocaleString("vi-VN")} ${purchaseResult.currency || "VND"}`
                      : "Theo quy định hệ thống"}
                  </Text>
                </View>

                {/* Details summary */}
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cổng thanh toán</Text>
                    <Text style={styles.summaryValue}>VNPAY Payment Gateway</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Phương thức</Text>
                    <Text style={styles.summaryValue}>Chuyển hướng (REDIRECT)</Text>
                  </View>
                  {purchaseResult?.paymentId ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Mã giao dịch</Text>
                      <Text style={[styles.summaryValue, styles.codeText]}>
                        {purchaseResult.paymentId.slice(0, 18)}...
                      </Text>
                    </View>
                  ) : null}
                  {(purchaseResult?.checkout?.expiresAt || activeSession?.expiresAt) ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Hết hạn lúc</Text>
                      <Text style={styles.summaryValue}>
                        {new Date(
                          purchaseResult?.checkout?.expiresAt || activeSession?.expiresAt || "",
                        ).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Instructions */}
                <View style={styles.noticeBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#0284C7" />
                  <Text style={styles.noticeText}>
                    Cổng VNPAY đã sẵn sàng. Bạn có thể thanh toán trực tiếp ngay trong ứng dụng mà không cần thoát ra ngoài.
                  </Text>
                </View>

                {/* Primary in-app payment button */}
                {(purchaseResult?.checkout?.url || purchaseResult?.checkout?.paymentUrl || activeSession?.checkoutUrl) ? (
                  <TouchableOpacity
                    style={styles.openUrlBtn}
                    onPress={() => {
                      const url =
                        purchaseResult?.checkout?.url ||
                        purchaseResult?.checkout?.paymentUrl ||
                        activeSession?.checkoutUrl;
                      if (url) {
                        setWebViewUrl(url);
                        setShowWebView(true);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.openUrlBtnText}>
                      Thanh toán VNPAY ngay trong ứng dụng
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Verification CTA */}
                <TouchableOpacity
                  style={[styles.verifyBtn, verifying && styles.btnDisabled]}
                  onPress={() => handleVerifyPayment(false)}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="refresh-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.verifyBtnText}>
                        Kiểm tra kết quả giao dịch
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Fallback open in external browser button */}
                {(purchaseResult?.checkout?.url || purchaseResult?.checkout?.paymentUrl || activeSession?.checkoutUrl) ? (
                  <TouchableOpacity
                    style={styles.externalBrowserBtn}
                    onPress={() => {
                      const url =
                        purchaseResult?.checkout?.url ||
                        purchaseResult?.checkout?.paymentUrl ||
                        activeSession?.checkoutUrl;
                      if (url) {
                        void Linking.openURL(url);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="open-outline" size={14} color={Colors.primaryDark} />
                    <Text style={styles.externalBrowserBtnText}>
                      Hoặc mở qua trình duyệt ngoài
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Cancel session button */}
                <TouchableOpacity
                  style={styles.cancelSessionBtn}
                  onPress={handleCancelSession}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelSessionBtnText}>
                    Hủy phiên / Đổi phương thức khác
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* State: Ready to purchase via VNPAY */
              <View style={styles.buySection}>
                {/* Feature highlight */}
                <View style={styles.benefitsCard}>
                  <Text style={styles.benefitsTitle}>Quyền lợi khi mở khóa cung đường:</Text>
                  <View style={styles.benefitItem}>
                    <Ionicons name="map-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.benefitText}>
                      Toàn quyền sử dụng lộ trình chuẩn hóa để tạo Private Trip.
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="pin-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.benefitText}>
                      Hệ thống trạm dừng và tọa độ GPS an toàn được định vị sẵn.
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="infinite-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.benefitText}>
                      Mở khóa 1 lần — Sở hữu và tổ chức chuyến đi vĩnh viễn.
                    </Text>
                  </View>
                </View>

                {/* Gateway selection (VNPAY) */}
                <View style={styles.gatewaySection}>
                  <Text style={styles.sectionLabel}>Cổng thanh toán điện tử:</Text>
                  <View style={styles.vnpayGatewayCard}>
                    <View style={styles.vnpayIconBox}>
                      <Ionicons name="card" size={24} color="#005BAA" />
                    </View>
                    <View style={styles.vnpayDetails}>
                      <View style={styles.vnpayTitleRow}>
                        <Text style={styles.vnpayTitle}>Cổng thanh toán VNPAY</Text>
                        <View style={styles.vnpayTag}>
                          <Text style={styles.vnpayTagText}>Chính thức</Text>
                        </View>
                      </View>
                      <Text style={styles.vnpaySub}>
                        Hỗ trợ VNPAY-QR, 40+ Ngân hàng nội địa & Thẻ Visa/Mastercard
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Purchase Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handlePurchaseVNPAY}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>
                        Thanh toán qua VNPAY trong ứng dụng
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>

      {/* In-app secure Payment WebView Modal */}
      {showWebView && webViewUrl ? (
        <PaymentWebViewModal
          visible={showWebView}
          url={webViewUrl}
          title={`Thanh toán VNPAY - ${trailName}`}
          onClose={() => setShowWebView(false)}
          onPaymentComplete={handleWebViewPaymentComplete}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  container: {
    maxHeight: "88%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 16,
    ...Shadows.hover,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  trailCard: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    gap: 6,
  },
  trailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  trailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: "#D1FAE5",
  },
  trailBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  trailName: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
    marginTop: 2,
  },
  trailSub: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  ownedBox: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  ownedIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  ownedTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  ownedSub: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  buySection: {
    gap: 16,
  },
  benefitsCard: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    gap: 10,
  },
  benefitsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 2,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 17,
  },
  gatewaySection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  vnpayGatewayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: "#005BAA",
    backgroundColor: "#F0F9FF",
  },
  vnpayIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  vnpayDetails: {
    flex: 1,
    gap: 2,
  },
  vnpayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vnpayTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#005BAA",
  },
  vnpayTag: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: "#BAE6FD",
  },
  vnpayTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#0369A1",
  },
  vnpaySub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 15,
  },
  paymentSection: {
    gap: 14,
    alignItems: "center",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: "#FEF3C7",
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  priceTag: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  summaryBox: {
    width: "100%",
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 11,
  },
  noticeBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: "#0369A1",
    lineHeight: 17,
  },
  openUrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: "#005BAA",
    ...Shadows.card,
  },
  openUrlBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  verifyBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  externalBrowserBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  externalBrowserBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primaryDark,
    textDecorationLine: "underline",
  },
  cancelSessionBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelSessionBtnText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textDecorationLine: "underline",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    textAlign: "center",
    marginTop: 4,
  },
});
