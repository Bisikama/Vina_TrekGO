import { QRScannerModal } from "@/components/common/QRScannerModal";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

export default function ScanQRRoute() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(true);

  const handleClose = () => {
    setModalVisible(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <QRScannerModal
        visible={modalVisible}
        onClose={handleClose}
      />
    </View>
  );
}
