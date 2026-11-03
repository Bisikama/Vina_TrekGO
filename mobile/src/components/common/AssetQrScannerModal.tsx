import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ExpectedAsset = { assetCode: string; label: string };

type Props = {
  visible: boolean;
  expectedAssets: ExpectedAsset[];
  scannedAssetCodes: string[];
  onScanned: (assetCode: string) => void;
  onClose: () => void;
};

function normalizeAssetCode(raw: string) {
  const value = raw.trim();
  const prefixed = value.match(/^TREKGO:UNIT:(.+)$/i);
  return (prefixed?.[1] ?? value).trim();
}

export function AssetQrScannerModal({
  visible,
  expectedAssets,
  scannedAssetCodes,
  onScanned,
  onClose,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const expectedByCode = useMemo(
    () => new Map(expectedAssets.map((item) => [item.assetCode.toUpperCase(), item])),
    [expectedAssets],
  );

  const accept = (raw: string) => {
    if (locked) return;
    const normalized = normalizeAssetCode(raw);
    const expected = expectedByCode.get(normalized.toUpperCase());
    if (!expected) {
      setLocked(true);
      Alert.alert(
        "Mã thiết bị không hợp lệ",
        "QR không thuộc đơn thuê này. Hệ thống chỉ chấp nhận asset code đầy đủ, không chấp nhận mã 6 số rút gọn.",
        [{ text: "Quét lại", onPress: () => setLocked(false) }],
      );
      return;
    }
    if (scannedAssetCodes.includes(expected.assetCode)) {
      setLocked(true);
      Alert.alert("Đã quét mã này", `${expected.label} đã được ghi nhận.`, [
        { text: "Tiếp tục", onPress: () => setLocked(false) },
      ]);
      return;
    }
    onScanned(expected.assetCode);
    setManualCode("");
    setLocked(true);
    setTimeout(() => setLocked(false), 700);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => {
        setLocked(false);
        setManualCode("");
      }}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primaryDark} />
            <Text style={styles.muted}>Đang kiểm tra camera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={48} color={Colors.primaryDark} />
            <Text style={styles.title}>Cần quyền camera</Text>
            <TouchableOpacity style={styles.primary} onPress={requestPermission}>
              <Text style={styles.primaryText}>CẤP QUYỀN CAMERA</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={styles.link}>Đóng</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "code128"] }}
              onBarcodeScanned={locked ? undefined : ({ data }) => accept(data)}
            />
            <SafeAreaView style={styles.overlay}>
              <View style={styles.header}>
                <TouchableOpacity style={styles.circle} onPress={onClose}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>QUÉT QR THIẾT BỊ</Text>
                <View style={styles.circlePlaceholder} />
              </View>
              <View style={styles.target}>
                <Ionicons name="scan-outline" size={92} color="#9af06f" />
                <Text style={styles.scanHelp}>Quét QR có dạng TREKGO:UNIT:&lt;ASSET_CODE&gt;</Text>
              </View>
              <View style={styles.sheet}>
                <Text style={styles.progress}>{scannedAssetCodes.length}/{expectedAssets.length} thiết bị đã quét</Text>
                {expectedAssets.map((item) => (
                  <View key={item.assetCode} style={styles.assetRow}>
                    <Ionicons
                      name={scannedAssetCodes.includes(item.assetCode) ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={scannedAssetCodes.includes(item.assetCode) ? Colors.primaryDark : Colors.onSurfaceMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetLabel}>{item.label}</Text>
                      <Text style={styles.assetCode}>{item.assetCode}</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.manualRow}>
                  <TextInput
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="characters"
                    placeholder="Nhập asset code đầy đủ khi camera lỗi"
                    placeholderTextColor={Colors.onSurfaceMuted}
                    style={styles.input}
                  />
                  <TouchableOpacity disabled={!manualCode.trim()} style={styles.addButton} onPress={() => accept(manualCode)}>
                    <Text style={styles.addText}>Thêm</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.done} onPress={onClose}>
                  <Text style={styles.doneText}>XONG</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#081c15" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28, backgroundColor: Colors.surface },
  muted: { color: Colors.onSurfaceMuted },
  title: { color: Colors.ink, fontSize: 20, fontWeight: "700" },
  primary: { backgroundColor: Colors.primaryDark, borderRadius: Radius.sm, paddingHorizontal: 22, paddingVertical: 13 },
  primaryText: { color: "#fff", fontWeight: "700" },
  link: { color: Colors.primaryDark, fontWeight: "600" },
  overlay: { flex: 1, justifyContent: "space-between", backgroundColor: "rgba(0,0,0,.18)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  circlePlaceholder: { width: 42 },
  headerTitle: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  target: { alignItems: "center", gap: 14 },
  scanHelp: { color: "#fff", textAlign: "center", paddingHorizontal: 24, fontWeight: "600" },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: "46%" },
  progress: { color: Colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  assetRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 7 },
  assetLabel: { color: Colors.ink, fontWeight: "600" },
  assetCode: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  manualRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.sm, paddingHorizontal: 11, color: Colors.ink },
  addButton: { backgroundColor: Colors.primaryPale, borderRadius: Radius.sm, paddingHorizontal: 15, justifyContent: "center" },
  addText: { color: Colors.primaryDark, fontWeight: "700" },
  done: { backgroundColor: Colors.primaryDark, borderRadius: Radius.sm, padding: 13, alignItems: "center", marginTop: 12 },
  doneText: { color: "#fff", fontWeight: "800" },
});
