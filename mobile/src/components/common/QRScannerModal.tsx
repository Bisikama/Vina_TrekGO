import { Colors, Radius, Shadows } from "@/constants/theme";
import { parsePrivateTripInviteCode } from "@/utils/qrInviteParser";
import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess?: (inviteCode: string) => void;
  onManualInputPress?: () => void;
}

export function QRScannerModal({
  visible,
  onClose,
  onScanSuccess,
  onManualInputPress,
}: QRScannerModalProps) {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  // Xử lý chung khi trích xuất được text từ mã QR (dù từ camera hay từ ảnh tải lên)
  const processQrData = (rawData: string) => {
    if (!rawData) return;
    setScanned(true);

    const inviteCode = parsePrivateTripInviteCode(rawData);

    if (inviteCode) {
      onClose();
      if (onScanSuccess) {
        onScanSuccess(inviteCode);
      } else {
        // Điều hướng trực tiếp tới trang xem trước thư mời và tham gia Private Trip
        router.push({
          pathname: "/invite/[code]",
          params: { code: inviteCode },
        } as any);
      }
    } else {
      Alert.alert(
        "Mã QR không hợp lệ",
        "Mã QR không phải là mã mời Private Trip hợp lệ của TrekGo. Vui lòng quét mã QR hoặc tải ảnh mã mời được tạo từ TrekGo.",
        [
          {
            text: "Thử lại",
            onPress: () => setScanned(false),
          },
          {
            text: "Đóng",
            style: "cancel",
            onPress: onClose,
          },
        ],
      );
    }
  };

  // Xử lý khi nhận diện barcode/QR qua Camera trực tiếp
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data || pickingImage) return;
    processQrData(data);
  };

  // Xử lý chọn ảnh từ thư viện thiết bị và quét QR từ ảnh
  const handlePickImage = async () => {
    try {
      setPickingImage(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setPickingImage(false);
        return;
      }

      const selectedUri = res.assets[0].uri;

      // Quét QR code từ file ảnh đã chọn
      const scanFn = scanFromURLAsync || Camera.scanFromURLAsync;
      if (!scanFn) {
        Alert.alert("Thông báo", "Thiết bị không hỗ trợ tính năng quét QR từ ảnh.");
        setPickingImage(false);
        return;
      }

      const scannedResults = await scanFn(selectedUri, ["qr"]);

      if (!scannedResults || scannedResults.length === 0) {
        Alert.alert(
          "Không tìm thấy mã QR",
          "Không nhận diện được mã QR nào trong ảnh vừa chọn. Vui lòng thử lại với ảnh rõ nét hơn hoặc cắt gần mã QR.",
          [
            { text: "Chọn ảnh khác", onPress: handlePickImage },
            { text: "Đóng", style: "cancel" },
          ],
        );
        setPickingImage(false);
        return;
      }

      // Lấy kết quả mã QR đầu tiên tìm thấy
      const qrData = scannedResults[0].data;
      processQrData(qrData);
    } catch (err: any) {
      Alert.alert(
        "Lỗi đọc ảnh",
        err?.message || "Không thể phân tích mã QR từ ảnh đã chọn.",
      );
    } finally {
      setPickingImage(false);
    }
  };

  const handleModalShow = () => {
    setScanned(false);
    setTorchActive(false);
    setPickingImage(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={handleModalShow}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission ? (
          <SafeAreaView style={styles.permissionBox}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.permissionText}>Đang kiểm tra quyền máy ảnh...</Text>
          </SafeAreaView>
        ) : !permission.granted ? (
          <SafeAreaView style={styles.permissionBox}>
            <View style={styles.cameraIconCircle}>
              <Ionicons name="camera-outline" size={48} color={Colors.primaryDark} />
            </View>
            <Text style={styles.permissionTitle}>Cần quyền truy cập máy ảnh</Text>
            <Text style={styles.permissionDesc}>
              TrekGo cần quyền truy cập camera để quét mã QR mời tham gia Private Trip từ màn hình web của bạn bè.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
              activeOpacity={0.85}
            >
              <Text style={styles.permissionBtnText}>Cấp quyền Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Để sau</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <>
            {/* Camera Viewfinder */}
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torchActive}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Tactical HUD Overlay */}
            <SafeAreaView style={styles.overlay}>
              {/* Top Controls Bar */}
              <View style={styles.topBar}>
                <TouchableOpacity
                  style={styles.circleButton}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>

                <View style={styles.topCenterBadge}>
                  <Ionicons name="scan" size={16} color="#8cd867" />
                  <Text style={styles.topCenterText}>QUÉT MÃ PRIVATE TRIP</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.circleButton,
                    torchActive && styles.circleButtonActive,
                  ]}
                  onPress={() => setTorchActive((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={torchActive ? "flash" : "flash-off-outline"}
                    size={20}
                    color={torchActive ? "#0c2000" : "#ffffff"}
                  />
                </TouchableOpacity>
              </View>

              {/* Viewfinder Center Target */}
              <View style={styles.centerTargetArea}>
                <View style={styles.scanTargetBox}>
                  {/* Tactical Glowing Corners */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />

                  {/* Aiming Reticle Dot in Center or Picking Image Spinner */}
                  {pickingImage ? (
                    <View style={styles.analyzingBox}>
                      <ActivityIndicator size="large" color="#8cd867" />
                      <Text style={styles.analyzingText}>Đang đọc mã QR...</Text>
                    </View>
                  ) : (
                    <View style={styles.aimDot} />
                  )}
                </View>

                <Text style={styles.instructionText}>
                  {pickingImage
                    ? "Đang phân tích mã QR từ hình ảnh..."
                    : "Hướng camera vào mã QR hoặc tải ảnh mã QR từ thư viện"}
                </Text>
              </View>

              {/* Bottom Actions Bar */}
              <View style={styles.bottomBar}>
                <View style={styles.bottomActionsRow}>
                  {/* Nút Tải ảnh lên để quét */}
                  <TouchableOpacity
                    style={styles.galleryBtn}
                    onPress={handlePickImage}
                    disabled={pickingImage}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="images-outline" size={18} color="#ffffff" />
                    <Text style={styles.galleryBtnText}>Tải ảnh lên</Text>
                  </TouchableOpacity>

                  {/* Nút Nhập mã tay nếu có */}
                  {onManualInputPress ? (
                    <TouchableOpacity
                      style={styles.manualInputBtn}
                      onPress={() => {
                        onClose();
                        onManualInputPress();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="key-outline" size={18} color="#ffffff" />
                      <Text style={styles.manualInputBtnText}>
                        Nhập mã tay
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {scanned && !pickingImage && (
                  <TouchableOpacity
                    style={styles.rescanBtn}
                    onPress={() => setScanned(false)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={18} color="#0c2000" />
                    <Text style={styles.rescanBtnText}>Chạm để quét lại</Text>
                  </TouchableOpacity>
                )}
              </View>
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: Colors.surface,
  },
  cameraIconCircle: {
    width: 90,
    height: 90,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...Shadows.card,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.onSurface,
    textAlign: "center",
    marginBottom: 10,
  },
  permissionDesc: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionText: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    marginTop: 14,
  },
  permissionBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  cancelLink: {
    marginTop: 16,
    padding: 8,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  circleButtonActive: {
    backgroundColor: "#8cd867",
    borderColor: "#8cd867",
  },
  topCenterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(22, 51, 0, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "#8cd867",
  },
  topCenterText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#8cd867",
    letterSpacing: 0.8,
  },
  centerTargetArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanTargetBox: {
    width: 260,
    height: 260,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  aimDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: "#8cd867",
    opacity: 0.8,
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: "#8cd867",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 32,
    lineHeight: 18,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  analyzingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  analyzingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8cd867",
  },
  bottomBar: {
    alignItems: "center",
    paddingBottom: 28,
    gap: 12,
  },
  bottomActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(18, 82, 56, 0.85)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "#8cd867",
  },
  galleryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  manualInputBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  manualInputBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8cd867",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  rescanBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0c2000",
  },
});
