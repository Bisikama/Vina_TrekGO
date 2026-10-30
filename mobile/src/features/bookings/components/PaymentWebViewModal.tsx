import { Colors, Radius } from "@/constants/theme";
import { API_BASE_URL } from "@/lib/api-client";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

export interface PaymentCompleteResult {
  success: boolean;
  responseCode?: string;
  message?: string;
  rawUrl?: string;
}

export interface PaymentWebViewModalProps {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
  onPaymentComplete: (result: PaymentCompleteResult) => void;
}

export function PaymentWebViewModal({
  visible,
  url,
  title = "Thanh toán an toàn",
  onClose,
  onPaymentComplete,
}: PaymentWebViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);

  // Helper forward return URL to backend to let server verify hash and update status
  const forwardToBackendAndComplete = useCallback(
    async (
      success: boolean,
      responseCode: string,
      message: string,
      navUrl: string,
    ) => {
      try {
        // 1. Xử lý VNPAY callback: Chuyển tiếp query string sang webhook /api/v1/payments/webhooks/vnpay
        if (navUrl.includes("vnp_ResponseCode")) {
          const queryIndex = navUrl.indexOf("?");
          const queryString = queryIndex !== -1 ? navUrl.slice(queryIndex + 1) : "";
          const searchParams = new URLSearchParams(queryString);
          const vnpParams = new URLSearchParams();
          searchParams.forEach((val, key) => {
            if (key.startsWith("vnp_")) {
              vnpParams.set(key, val);
            }
          });

          if (vnpParams.toString().length > 0) {
            const vnpWebhookUrl = `${API_BASE_URL}/api/v1/payments/webhooks/vnpay?${vnpParams.toString()}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            await fetch(vnpWebhookUrl, { signal: controller.signal }).catch(() => {});
            clearTimeout(timer);
          }
        }
        // 2. Xử lý MoMo callback: Chuyển tiếp body sang /api/v1/payments/webhooks/momo
        else if (navUrl.includes("resultCode=") && navUrl.includes("signature=")) {
          const queryIndex = navUrl.indexOf("?");
          const queryString = queryIndex !== -1 ? navUrl.slice(queryIndex + 1) : "";
          const searchParams = new URLSearchParams(queryString);
          const momoPayload: Record<string, string> = {};
          searchParams.forEach((val, key) => {
            momoPayload[key] = val;
          });

          const momoWebhookUrl = `${API_BASE_URL}/api/v1/payments/webhooks/momo`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          await fetch(momoWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(momoPayload),
            signal: controller.signal,
          }).catch(() => {});
          clearTimeout(timer);
        }
        // 3. Fallback cho các return URL nội bộ khác
        else if (
          navUrl.includes("localhost:") ||
          navUrl.includes("127.0.0.1:") ||
          navUrl.includes("/payments/")
        ) {
          const isLocalhost =
            navUrl.includes("localhost:") ||
            navUrl.includes("127.0.0.1:") ||
            navUrl.includes("localhost/") ||
            navUrl.includes("127.0.0.1/");

          const backendEndpoint = isLocalhost
            ? navUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_BASE_URL)
            : navUrl;

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          await fetch(backendEndpoint, { signal: controller.signal }).catch(() => {});
          clearTimeout(timer);
        }
      } catch (err) {
        console.warn("[PaymentWebViewModal] Failed to forward callback to backend:", err);
      }

      onPaymentComplete({
        success,
        responseCode,
        message,
        rawUrl: navUrl,
      });
    },
    [onPaymentComplete],
  );

    // Check if URL indicates a payment result (VNPAY / MoMo / Return Callback)
  function handleUrlChange(navUrl: string): boolean {
    if (!navUrl) return true;

    // 0. Handle external app schemes (e.g. momo://, vnpay://, bank apps)
    if (!navUrl.startsWith("http://") && !navUrl.startsWith("https://")) {
      Linking.canOpenURL(navUrl)
        .then((supported) => {
          if (supported) {
            void Linking.openURL(navUrl);
          }
        })
        .catch(() => {});
      return false;
    }

    if (completedRef.current) return false;

    // 1. VNPAY detection
    if (navUrl.includes("vnp_ResponseCode")) {
      completedRef.current = true;
      const match = navUrl.match(/vnp_ResponseCode=([^&]+)/);
      const code = match ? match[1] : null;

      if (code === "00") {
        void forwardToBackendAndComplete(
          true,
          "00",
          "Thanh toán thành công!",
          navUrl,
        );
      } else {
        void forwardToBackendAndComplete(
          false,
          code || "FAILED",
          code === "24"
            ? "Bạn đã hủy giao dịch."
            : `Giao dịch không thành công (Mã lỗi: ${code}).`,
          navUrl,
        );
      }
      return false; // Stop loading return page inside webview
    }

    // 2. MoMo detection
    if (navUrl.includes("resultCode=")) {
      completedRef.current = true;
      const match = navUrl.match(/resultCode=([^&]+)/);
      const code = match ? match[1] : null;

      if (code === "0") {
        void forwardToBackendAndComplete(
          true,
          "0",
          "Thanh toán MoMo thành công!",
          navUrl,
        );
      } else {
        void forwardToBackendAndComplete(
          false,
          code || "FAILED",
          "Giao dịch MoMo không thành công.",
          navUrl,
        );
      }
      return false;
    }

    // 3. Catch generic return endpoints before ERR_CONNECTION_REFUSED
    if (
      navUrl.includes("localhost:") ||
      navUrl.includes("127.0.0.1:") ||
      navUrl.includes("/payment-success") ||
      navUrl.includes("/payments/return")
    ) {
      completedRef.current = true;
      void forwardToBackendAndComplete(
        true,
        "00",
        "Thanh toán thành công!",
        navUrl,
      );
      return false;
    }

    return true;
  }

  function handleClosePress() {
    Alert.alert(
      "Dừng thanh toán?",
      "Bạn có chắc muốn thoát giao dịch thanh toán này? Đơn đặt chỗ vẫn sẽ được giữ trong thời gian quy định.",
      [
        { text: "Tiếp tục thanh toán", style: "cancel" },
        {
          text: "Thoát",
          style: "destructive",
          onPress: () => {
            onClose();
          },
        },
      ],
    );
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClosePress}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClosePress}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Loading Progress Bar */}
        {loading ? (
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(15, progress * 100)}%` },
              ]}
            />
          </View>
        ) : null}

        {/* WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            source={{ uri: url }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
            onShouldStartLoadWithRequest={(request) => {
              return handleUrlChange(request.url);
            }}
            onNavigationStateChange={(navState: WebViewNavigation): void => {
              handleUrlChange(navState.url);
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.primaryDark} />
                <Text style={styles.loadingText}>Đang tải trang thanh toán...</Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarBg: {
    height: 3,
    backgroundColor: Colors.surfaceContainerLow,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primaryDark,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.mute,
    fontWeight: "600",
  },
});
