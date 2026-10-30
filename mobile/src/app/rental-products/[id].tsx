import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,

  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { rentalApi } from "@/features/rentals/api";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";
import {
  calculateProductDeposit,
  RentalProduct,
  rentalProductSpecs,
} from "@/features/rentals/types";
import { EquipmentItem } from "@/types";

const MAX_REQUEST_QUANTITY = 20;

function toCartItem(product: RentalProduct): EquipmentItem {
  return {
    id: product.id,
    name: product.name,
    category: "Accessories",
    dailyRate: product.dailyPrice,
    deposit: calculateProductDeposit(product),
    stock: 99,
    imageUrl: product.imageUrl ?? "",
    specs: rentalProductSpecs(product),
    description: product.description ?? "",
    rating: 0,
  };
}

export default function RentalProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cart, setCartQuantity } = useApp();
  const { selectedTrip } = useRentalSelection();
  const [product, setProduct] = useState<RentalProduct>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [activeImage, setActiveImage] = useState(0);

  const productId = Array.isArray(id) ? id[0] : id;
  const cartEntry = cart.find((entry) => entry.item.id === productId);
  const cartQuantity = cartEntry?.quantity ?? 0;
  const quantity = cartQuantity;
  const specs = useMemo(
    () => (product ? rentalProductSpecs(product) : []),
    [product],
  );

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      if (!productId) {
        setError("Thiếu mã sản phẩm.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);
      try {
        const result = await rentalApi.getProduct(productId);
        if (active) setProduct(result);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Không tải được chi tiết thiết bị.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={() => router.back()} cartCount={cart.length} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.stateText}>Đang tải thông tin thiết bị...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={() => router.back()} cartCount={cart.length} />
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="cube-outline"
              size={42}
              color={Colors.primaryDark}
            />
          </View>
          <Text style={styles.emptyTitle}>Không tải được thiết bị</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Quay lại danh mục</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const deposit = calculateProductDeposit(product);
  const dailySubtotal = product.dailyPrice * quantity;
  const depositSubtotal = deposit * quantity;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        onBack={() => router.back()}
        cartCount={cart.reduce((sum, entry) => sum + entry.quantity, 0)}
        onCart={() => router.push("/(tabs)/rental" as Href)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          {(product.imageUrls?.[activeImage] || product.imageUrl) ? (
            <Image source={{ uri: product.imageUrls?.[activeImage] || product.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="cube-outline" size={70} color={Colors.primaryDark} />
              <Text style={styles.heroPlaceholderText}>
                Ảnh thiết bị đang được cập nhật
              </Text>
            </View>
          )}
          <View style={styles.heroBottom}>
            <Text style={styles.category}>{product.category.name}</Text>
            <Text style={styles.productName}>{product.name}</Text>
            {product.sku ? <Text style={styles.sku}>SKU: {product.sku}</Text> : null}
          </View>
          {(product.imageUrls?.length ?? 0) > 1 && (
            <View style={styles.galleryCounter}>
              <Ionicons name="images-outline" size={13} color="#fff" />
              <Text style={styles.galleryCounterText}>{activeImage + 1}/{product.imageUrls!.length}</Text>
            </View>
          )}
        </View>

        {(product.imageUrls?.length ?? 0) > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {product.imageUrls!.map((url, index) => (
              <TouchableOpacity
                key={`${url}-${index}`}
                style={[styles.thumbnailButton, activeImage === index && styles.thumbnailButtonActive]}
                onPress={() => setActiveImage(index)}
              >
                <Image source={{ uri: url }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons name="trail-sign" size={21} color={Colors.primaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.tripLabel}>CHUYẾN ĐI DÙNG ĐỂ KIỂM TRA KHO</Text>
            <Text style={styles.tripTitle} numberOfLines={1}>
              {selectedTrip?.title ?? "Chưa chọn chuyến đi"}
            </Text>
            <Text style={styles.tripDescription}>
              {selectedTrip
                ? "Chuyến đã qua kiểm tra điều kiện thuê."
                : "Bạn vẫn có thể chọn sản phẩm và số lượng trước."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.tripAction}
            onPress={() => router.push("/rental-trip-select" as Href)}
          >
            <Text style={styles.tripActionText}>
              {selectedTrip ? "Đổi" : "Chọn"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceLabel}>GIÁ THUÊ</Text>
            <Text style={styles.dailyPrice}>
              {product.dailyPrice.toLocaleString("vi-VN")}đ
              <Text style={styles.perDay}> / ngày</Text>
            </Text>
          </View>
          <View style={styles.depositBox}>
            <Text style={styles.depositLabel}>Cọc dự kiến / món</Text>
            <Text style={styles.depositValue}>
              {deposit.toLocaleString("vi-VN")}đ
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Giới thiệu thiết bị</Text>
          <Text style={styles.description}>
            {product.description || "Sản phẩm chưa có mô tả."}
          </Text>
        </View>

        {specs.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Thông số thiết bị</Text>
            <View style={styles.specList}>
              {specs.map((spec) => (
                <View key={spec} style={styles.specRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={17}
                    color={Colors.primaryDark}
                  />
                  <Text style={styles.specText}>{spec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.quantityHeader}>
            <View>
              <Text style={styles.sectionTitle}>Số lượng cần thuê</Text>
              <Text style={styles.quantityHint}>
                Tồn kho thật sẽ kiểm tra sau khi chọn chuyến
              </Text>
            </View>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                disabled={quantity === 0}
                onPress={() =>
                  setCartQuantity(toCartItem(product), Math.max(0, quantity - 1))
                }
              >
                <Ionicons name="remove" size={18} color={Colors.onSurface} />
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                disabled={quantity === MAX_REQUEST_QUANTITY}
                onPress={() =>
                  setCartQuantity(
                    toCartItem(product),
                    Math.min(MAX_REQUEST_QUANTITY, quantity + 1),
                  )
                }
              >
                <Ionicons name="add" size={18} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Giá tham khảo</Text>
          <SummaryRow
            label="Phí thuê mỗi ngày"
            value={`${dailySubtotal.toLocaleString("vi-VN")}đ`}
          />
          <SummaryRow
            label="Tổng tiền cọc dự kiến"
            value={`${depositSubtotal.toLocaleString("vi-VN")}đ`}
          />
          <View style={styles.notice}>
            <Ionicons
              name="information-circle"
              size={19}
              color={Colors.primaryDark}
            />
            <Text style={styles.noticeText}>
              Charged days, availability, phí thuê và tiền cọc cuối cùng do
              server tính trong Quote sau khi chọn chuyến.
            </Text>
          </View>
        </View>

        {cartEntry && (
          <View style={styles.cartNotice}>
            <Ionicons name="bag-check" size={18} color={Colors.primaryDark} />
            <Text style={styles.cartNoticeText}>
              Giỏ hiện có {cartEntry.quantity} sản phẩm này.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>Đang chọn</Text>
          <Text style={styles.bottomValue}>{quantity} món</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, quantity > 0 && styles.addButtonSuccess]}
          onPress={() =>
            quantity === 0
              ? setCartQuantity(toCartItem(product), 1)
              : router.back()
          }
        >
          <Ionicons
            name={quantity > 0 ? "checkmark-circle" : "bag-add"}
            size={20}
            color={Colors.onPrimary}
          />
          <Text style={styles.addButtonText}>
            {quantity > 0 ? "Đã cập nhật giỏ thuê" : "Thêm 1 vào giỏ thuê"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  cartCount,
  onCart,
}: {
  onBack: () => void;
  cartCount: number;
  onCart?: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.headerEyebrow}>TREKGO GEAR</Text>
        <Text style={styles.headerTitle}>Chi tiết thiết bị</Text>
      </View>
      <TouchableOpacity style={styles.headerButton} onPress={onCart}>
        <Ionicons name="bag-outline" size={20} color={Colors.onSurface} />
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
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
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerText: { flex: 1 },
  headerEyebrow: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  headerTitle: {
    marginTop: 1,
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "700",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
  },
  cartBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyState: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  emptyTitle: {
    marginTop: 14,
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "700",
  },
  stateText: {
    marginTop: 8,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  primaryButtonText: { color: Colors.onPrimaryDark, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 130, gap: 14 },
  heroCard: {
    height: 310,
    overflow: "hidden",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerHigh,
    ...Shadows.hover,
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primaryPale,
  },
  heroPlaceholderText: { color: Colors.onSurfaceVariant, fontSize: 12 },
  heroBottom: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(14,15,12,0.80)",
  },
  galleryCounter: { position: "absolute", top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: Radius.full, backgroundColor: "rgba(14,15,12,0.72)" },
  galleryCounterText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  thumbnailRow: { gap: 8, paddingVertical: 1 },
  thumbnailButton: { width: 62, height: 62, overflow: "hidden", borderWidth: 2, borderColor: "transparent", borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  thumbnailButtonActive: { borderColor: Colors.primaryDark },
  thumbnailImage: { width: "100%", height: "100%" },
  category: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden",
    borderRadius: Radius.full,
    color: Colors.onPrimary,
    backgroundColor: Colors.primary,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  productName: {
    marginTop: 7,
    color: "#fff",
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 28,
  },
  sku: { marginTop: 3, color: Colors.primaryNeutral, fontSize: 10 },
  tripCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryPale,
  },
  tripIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  tripLabel: {
    color: Colors.primaryDark,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  tripTitle: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  tripDescription: { marginTop: 2, color: Colors.onSurfaceVariant, fontSize: 9 },
  tripAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.inkDeep,
  },
  tripActionText: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "700" },
  priceCard: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  priceLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dailyPrice: {
    marginTop: 3,
    color: Colors.primaryDark,
    fontSize: 22,
    fontWeight: "700",
  },
  perDay: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: "500" },
  depositBox: { alignItems: "flex-end" },
  depositLabel: { color: Colors.onSurfaceVariant, fontSize: 10 },
  depositValue: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
  },
  sectionCard: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionTitle: { color: Colors.onSurface, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  description: {
    marginTop: 8,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
  },
  specList: { marginTop: 10, gap: 9 },
  specRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  specText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  quantityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  quantityHint: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 9 },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    minWidth: 28,
    textAlign: "center",
    color: Colors.onSurface,
    fontWeight: "900",
  },
  summaryCard: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.inkDeep,
  },
  summaryTitle: {
    marginBottom: 10,
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  summaryRow: {
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryLabel: { color: Colors.primaryNeutral, fontSize: 11 },
  summaryValue: { color: Colors.onPrimaryDark, fontSize: 12, fontWeight: "800" },
  notice: {
    marginTop: 10,
    padding: 11,
    flexDirection: "row",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  noticeText: { flex: 1, color: Colors.primaryNeutral, fontSize: 10, lineHeight: 15 },
  cartNotice: {
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryPale,
  },
  cartNoticeText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  bottomSummary: { minWidth: 66 },
  bottomLabel: { color: Colors.onSurfaceMuted, fontSize: 9 },
  bottomValue: { color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  addButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  addButtonSuccess: { backgroundColor: Colors.secondary },
  addButtonText: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
});
