import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";

interface RentalCartModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RentalCartModal({ visible, onClose }: RentalCartModalProps) {
  const router = useRouter();
  const { cart, setCartQuantity } = useApp();
  const { selectedTrip } = useRentalSelection();
  const totalDaily = cart.reduce(
    (sum, entry) => sum + entry.item.dailyRate * entry.quantity,
    0,
  );
  const totalDeposit = cart.reduce(
    (sum, entry) => sum + entry.item.deposit * entry.quantity,
    0,
  );

  function openTripSelection() {
    onClose();
    router.push("/rental-trip-select" as Href);
  }

  function continueCheckout() {
    if (!selectedTrip) {
      openTripSelection();
      return;
    }

    onClose();
    router.push("/rental-checkout" as Href);
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
          <View style={styles.dragHandle} />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.eyebrow}>TREKGO RENTAL</Text>
            <Text style={styles.title}>Giỏ thiết bị</Text>
            <Text style={styles.subtitle}>
              Phí cuối cùng chỉ được xác nhận bởi Quote của server.
            </Text>

            <View style={styles.tripCard}>
              <Ionicons
                name={selectedTrip ? "checkmark-circle" : "trail-sign-outline"}
                size={22}
                color={Colors.primaryDark}
              />
              <View style={styles.flexOne}>
                <Text style={styles.tripLabel}>
                  {selectedTrip ? "CHUYẾN ĐI ĐÃ CHỌN" : "CHƯA CHỌN CHUYẾN ĐI"}
                </Text>
                <Text style={styles.tripTitle} numberOfLines={1}>
                  {selectedTrip?.title ??
                    "Cần trip hợp lệ để kiểm tra availability"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.tripAction}
                onPress={openTripSelection}
              >
                <Text style={styles.tripActionText}>
                  {selectedTrip ? "Đổi" : "Chọn"}
                </Text>
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="bag-outline"
                  size={48}
                  color={Colors.onSurfaceMuted}
                />
                <Text style={styles.emptyTitle}>Giỏ thuê đang trống</Text>
                <Text style={styles.emptyDescription}>
                  Chọn thiết bị trong danh mục để tiếp tục.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.itemList}>
                  {cart.map(({ item, quantity }) => (
                    <View key={item.id} style={styles.itemRow}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.itemImage}
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <Ionicons
                            name="cube-outline"
                            size={24}
                            color={Colors.primaryDark}
                          />
                        </View>
                      )}
                      <View style={styles.flexOne}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemPrice}>
                          {item.dailyRate.toLocaleString("vi-VN")}đ/ngày ×{" "}
                          {quantity}
                        </Text>
                        <Text style={styles.itemDeposit}>
                          Cọc:{" "}
                          {(item.deposit * quantity).toLocaleString("vi-VN")}đ
                        </Text>
                      </View>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          accessibilityLabel="Giảm số lượng"
                          onPress={() => setCartQuantity(item, quantity - 1)}
                        >
                          <Ionicons
                            name={quantity === 1 ? "trash-outline" : "remove"}
                            size={15}
                            color={
                              quantity === 1 ? Colors.error : Colors.onSurface
                            }
                          />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          accessibilityLabel="Tăng số lượng"
                          disabled={quantity >= 20}
                          onPress={() =>
                            setCartQuantity(item, Math.min(20, quantity + 1))
                          }
                        >
                          <Ionicons
                            name="add"
                            size={15}
                            color={Colors.onSurface}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.summaryCard}>
                  <SummaryRow
                    label="Phí thuê mỗi ngày"
                    value={`${totalDaily.toLocaleString("vi-VN")}đ`}
                  />
                  <SummaryRow
                    label="Tiền cọc dự kiến"
                    value={`${totalDeposit.toLocaleString("vi-VN")}đ`}
                  />
                  <View style={styles.notice}>
                    <Ionicons
                      name="information-circle"
                      size={18}
                      color={Colors.primary}
                    />
                    <Text style={styles.noticeText}>
                      Không cộng tổng thanh toán ở đây vì số ngày tính phí và
                      availability phụ thuộc chuyến đi.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={continueCheckout}
                >
                  <Ionicons
                    name={selectedTrip ? "receipt-outline" : "trail-sign"}
                    size={20}
                    color={Colors.onPrimary}
                  />
                  <Text style={styles.primaryButtonText}>
                    {selectedTrip
                      ? "Kiểm tra tồn kho & báo giá"
                      : "Chọn chuyến đi"}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color={Colors.onPrimary}
                  />
                </TouchableOpacity>

                {selectedTrip && (
                  <View style={styles.nextStepCard}>
                    <Ionicons
                      name="layers-outline"
                      size={20}
                      color={Colors.warningDeep}
                    />
                    <Text style={styles.nextStepText}>
                      Tồn kho, số ngày thuê, phí và tiền cọc sẽ được API kiểm
                      tra lại trước khi tạo đơn. Quote không tự giữ thiết bị.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  container: {
    maxHeight: "92%",
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.surface,
    ...Shadows.hover,
  },
  content: { paddingBottom: 24 },
  flexOne: { flex: 1 },
  dragHandle: {
    width: 40,
    height: 4,
    marginBottom: 16,
    alignSelf: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 2,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  eyebrow: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 4,
    color: Colors.onSurface,
    fontSize: 23,
    fontWeight: "900",
  },
  subtitle: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 11 },
  tripCard: {
    marginTop: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryPale,
  },
  tripLabel: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  tripTitle: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "800",
  },
  tripAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.inkDeep,
  },
  tripActionText: {
    color: Colors.onPrimaryDark,
    fontSize: 10,
    fontWeight: "900",
  },
  emptyState: { paddingVertical: 45, alignItems: "center" },
  emptyTitle: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyDescription: {
    marginTop: 5,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  itemList: { marginTop: 16, gap: 10 },
  itemRow: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  itemImage: { width: 64, height: 64, borderRadius: Radius.md },
  itemImagePlaceholder: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  itemName: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  itemPrice: {
    marginTop: 4,
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "700",
  },
  itemDeposit: { marginTop: 2, color: Colors.onSurfaceVariant, fontSize: 9 },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  quantityButton: {
    width: 30,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    minWidth: 18,
    color: Colors.onSurface,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
  },
  summaryCard: {
    marginTop: 16,
    padding: 15,
    borderRadius: Radius.lg,
    backgroundColor: Colors.inkDeep,
  },
  summaryRow: {
    paddingVertical: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryLabel: { color: Colors.primaryNeutral, fontSize: 11 },
  summaryValue: {
    color: Colors.onPrimaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  notice: {
    marginTop: 9,
    padding: 10,
    flexDirection: "row",
    gap: 7,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  noticeText: {
    flex: 1,
    color: Colors.primaryNeutral,
    fontSize: 9,
    lineHeight: 14,
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  nextStepCard: {
    marginTop: 10,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.tertiaryContainer,
  },
  nextStepText: {
    flex: 1,
    color: Colors.onTertiaryContainer,
    fontSize: 9,
    lineHeight: 14,
  },
});
