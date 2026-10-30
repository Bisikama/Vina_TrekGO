import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,

  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RentalCartModal } from "@/components/RentalCartModal";
import { TopHeader } from "@/components/TopHeader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";
import {
  calculateProductDeposit,
  RentalAvailability,
  RentalCategory,
  RentalOrderSummary,
  RentalProduct,
  rentalProductSpecs,
} from "@/features/rentals/types";
import { EquipmentItem } from "@/types";

type RentalView = "CATALOG" | "ORDERS";
type RentalProductGroup = {
  key: string;
  name: string;
  variants: RentalProduct[];
};

const formatMoney = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

const CATEGORY_FALLBACK_IMAGES = {
  tent: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=82",
  backpack: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=82",
  footwear: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=82",
  camp: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=900&q=82",
} as const;

function productCardImage(product: RentalProduct) {
  if (product.imageUrl) return product.imageUrl;
  const category = product.category.name.toLocaleLowerCase("vi-VN");
  if (category.includes("lều") || category.includes("ngủ")) return CATEGORY_FALLBACK_IMAGES.tent;
  if (category.includes("balo") || category.includes("túi")) return CATEGORY_FALLBACK_IMAGES.backpack;
  if (category.includes("giày") || category.includes("gậy")) return CATEGORY_FALLBACK_IMAGES.footwear;
  return CATEGORY_FALLBACK_IMAGES.camp;
}

function productSize(product: RentalProduct) {
  if (product.spec && typeof product.spec === "object" && !Array.isArray(product.spec)) {
    const entries = Object.entries(product.spec as Record<string, unknown>);
    const match = entries.find(([key]) =>
      ["size", "kích cỡ", "kich co", "shoe size"].includes(key.trim().toLowerCase()),
    );
    if (match?.[1] !== null && match?.[1] !== undefined) return String(match[1]);
  }

  const nameMatch = product.name.match(/\bsize\s*([\d.]+|s|m|l|xl|xxl)\b/i);
  return nameMatch?.[1]?.toUpperCase();
}

function productFamilyName(product: RentalProduct) {
  const size = productSize(product);
  if (!size) return product.name.trim();
  return product.name
    .replace(/\s*[-–—]?\s*size\s*([\d.]+|s|m|l|xl|xxl)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function groupRentalProducts(products: RentalProduct[]): RentalProductGroup[] {
  const groups = new Map<string, RentalProductGroup>();
  products.forEach((product) => {
    const familyName = productFamilyName(product);
    const key = `${product.category.id}:${familyName.toLocaleLowerCase("vi-VN")}`;
    const current = groups.get(key);
    if (current) current.variants.push(product);
    else groups.set(key, { key, name: familyName, variants: [product] });
  });
  return [...groups.values()];
}

function toCartItem(product: RentalProduct, stock = 0): EquipmentItem {
  return {
    id: product.id,
    name: product.name,
    category: "Accessories",
    dailyRate: product.dailyPrice,
    deposit: calculateProductDeposit(product),
    stock,
    imageUrl: product.imageUrl ?? "",
    specs: rentalProductSpecs(product),
    description: product.description ?? "",
    rating: 0,
  };
}

export default function RentalScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { cart, setCartQuantity } = useApp();
  const { selectedTrip } = useRentalSelection();
  const [view, setView] = useState<RentalView>("CATALOG");
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [catalogAvailability, setCatalogAvailability] = useState<Record<string, RentalAvailability>>({});
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [orders, setOrders] = useState<RentalOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState<string>();

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, current) => sum + current.quantity, 0),
    [cart],
  );
  const productGroups = useMemo(() => groupRentalProducts(products), [products]);

  const loadCatalog = useCallback(async (isRefresh = false) => {
    if (!accessToken || !selectedTrip) {
      setCategories([]);
      setProducts([]);
      setCatalogAvailability({});
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);

    try {
      const [categoryResult, productResult] = await Promise.all([
        rentalApi.listCategories(),
        rentalApi.listProducts({ search, categoryId: selectedCategoryId }),
      ]);
      setCategories(categoryResult.items);
      setProducts(productResult.items);
      const availabilityResults = await Promise.allSettled(
        productResult.items.map(async (product) => ({
          productId: product.id,
          availability: await rentalApi.getAvailability(
            { tripId: selectedTrip.id, productId: product.id },
            accessToken,
          ),
        })),
      );
      setCatalogAvailability(Object.fromEntries(
        availabilityResults.flatMap((result) => result.status === "fulfilled"
          ? [[result.value.productId, result.value.availability]]
          : []),
      ));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tải được danh mục thiết bị.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, search, selectedCategoryId, selectedTrip]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCatalog();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadCatalog]);

  function submitSearch() {
    setSearch(searchDraft.trim());
  }

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setOrders([]);
        setOrdersError("Phiên đăng nhập không hợp lệ.");
        return;
      }

      if (isRefresh) setOrdersRefreshing(true);
      else setOrdersLoading(true);
      setOrdersError(undefined);

      try {
        const result = await rentalApi.listOrders(accessToken, {
          page: 1,
          pageSize: 50,
        });
        setOrders(result.items);
      } catch (requestError) {
        setOrdersError(
          requestError instanceof Error
            ? requestError.message
            : "Không tải được đơn thuê.",
        );
      } finally {
        setOrdersLoading(false);
        setOrdersRefreshing(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (view !== "ORDERS") return;

    const timer = setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadOrders, view]);

  function renderQuickActions() {
    return (
      <View style={styles.quickTools}>
        <View style={styles.quickHeading}>
          <Text style={styles.quickHeadingTitle}>Phản hồi nhanh & Quản lý</Text>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => router.push("/wardrobe" as Href)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="bag-handle-outline" size={21} color={Colors.primaryDark} />
            </View>
            <Text style={styles.quickActionTitle}>Tủ đồ cá nhân</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => router.push("/rental-transactions" as Href)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="wallet-outline" size={21} color={Colors.primaryDark} />
            </View>
            <Text style={styles.quickActionTitle}>Lịch sử giao dịch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => router.push("/rental-reviews" as Href)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="star-outline" size={21} color={Colors.primaryDark} />
            </View>
            <Text style={styles.quickActionTitle}>Đánh giá thiết bị</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, view === "ORDERS" && styles.quickActionCardActive]}
            activeOpacity={0.85}
            onPress={() => setView("ORDERS")}
          >
            <View style={[styles.quickActionIcon, view === "ORDERS" && styles.quickActionIconActive]}>
              <Ionicons name="receipt-outline" size={21} color={Colors.primaryDark} />
            </View>
            <Text style={styles.quickActionTitle}>Đơn thuê của tôi</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderOrders() {
    if (ordersLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.stateDescription}>Đang cập nhật đơn thuê...</Text>
        </View>
      );
    }

    if (ordersError) {
      return (
        <StateCard
          icon="cloud-offline-outline"
          title="Chưa tải được đơn thuê"
          description={ordersError}
          actionLabel="Thử lại"
          onAction={() => void loadOrders()}
        />
      );
    }

    if (orders.length === 0) {
      return (
        <StateCard
          icon="receipt-outline"
          title="Chưa có đơn thuê"
          description="Đơn thuê được tạo cho chuyến đi sẽ xuất hiện tại đây."
          actionLabel="Chọn thiết bị"
          onAction={() => setView("CATALOG")}
        />
      );
    }

    return (
      <View style={styles.ordersList}>
        {orders.map((order) => {
          const status = rentalOrderStatus(order.status);
          return (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/rental-orders/${order.id}` as Href)}
            >
              <View style={styles.orderTopRow}>
                <View style={styles.orderIcon}>
                  <Ionicons
                    name="bag-check-outline"
                    size={20}
                    color={Colors.primaryDark}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.orderCode}>
                    {order.orderCode ? `ĐƠN THUÊ · ${order.orderCode}` : "ĐƠN THUÊ THIẾT BỊ"}
                  </Text>
                  <Text style={styles.orderTrip} numberOfLines={1}>
                    {order.trip?.title || "Chuyến đi của bạn"}
                  </Text>
                  <Text style={styles.orderTripMeta} numberOfLines={1}>
                    {order.trip?.type === "PRIVATE" ? "Chuyến riêng tư" : "Chuyến công khai"}
                    {order.trip?.startAt && order.trip?.endAt ? ` · ${formatTripWindow(order.trip.startAt, order.trip.endAt)}` : ""}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              </View>

              <View style={styles.orderDivider} />

              <View style={styles.orderBottomRow}>
                <View>
                  <Text style={styles.orderMetaLabel}>Tổng thanh toán</Text>
                  <Text style={styles.orderAmount}>
                    {formatCurrency(order.totalAmount, order.currency)}
                  </Text>
                </View>
                <View style={styles.orderOpen}>
                  <Text style={styles.orderOpenText}>Chi tiết</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.primaryDark}
                  />
                </View>
              </View>

              {order.exceptionStatus && order.exceptionStatus !== "NONE" && (
                <Text style={styles.exceptionText}>
                  {rentalExceptionLabel(order.exceptionStatus)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderCatalog() {
    return (
      <>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>LẬP KẾ HOẠCH THUÊ</Text>
          <Text style={styles.sectionHeadingTitle}>Tìm kiếm & Chọn ngày</Text>
          <Text style={styles.sectionHeadingHint}>Ngày thuê được đồng bộ theo lịch chuyến và điểm nhận hợp lệ.</Text>
        </View>
        <View style={styles.contextBanner}>
          <View style={styles.contextIcon}>
            <Ionicons name="bag-handle" size={20} color={Colors.primaryDark} />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.contextTitle}>THUÊ ĐỒ THEO CHUYẾN ĐI</Text>
            <Text style={styles.contextDescription}>
              Chọn chuyến trước để hệ thống chỉ hiển thị số lượng thiết bị phù
              hợp với đúng thời gian trekking của bạn.
            </Text>
            {selectedTrip && (
              <View style={styles.selectedTripRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.selectedTripText} numberOfLines={1}>{selectedTrip.title}</Text>
                  <Text style={styles.selectedTripMeta}>{selectedTrip.type === "PRIVATE" ? "Chuyến riêng tư" : "Chuyến công khai"} · {formatTripWindow(selectedTrip.startAt, selectedTrip.endAt)}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/rental-trip-select" as Href)}><Text style={styles.changeTripText}>Đổi chuyến</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {renderQuickActions()}

        {!selectedTrip ? (
          <StateCard
            icon="trail-sign-outline"
            title="Chọn chuyến đi trước"
            description="Thiết bị và số lượng còn trống được tính theo khung giờ của từng chuyến."
            actionLabel="Chọn chuyến đi"
            onAction={() => router.push("/rental-trip-select" as Href)}
          />
        ) : (
          <>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.onSurfaceMuted} />
            <TextInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              onSubmitEditing={submitSearch}
              placeholder="Tìm lều, balo, gậy trekking..."
              placeholderTextColor={Colors.onSurfaceMuted}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchDraft.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchDraft("");
                  setSearch("");
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.onSurfaceMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={submitSearch}>
            <Ionicons name="arrow-forward" size={19} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.catalogHeading}>
          <Text style={styles.sectionEyebrow}>BỘ LỌC & DANH MỤC</Text>
          <Text style={styles.catalogHeadingHint}>Chạm vào nhóm thiết bị để lọc nhanh.</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <CategoryPill
            label="Tất cả"
            active={!selectedCategoryId}
            onPress={() => setSelectedCategoryId(undefined)}
          />
          {categories.map((category) => (
            <CategoryPill
              key={category.id}
              label={category.name}
              active={selectedCategoryId === category.id}
              onPress={() => setSelectedCategoryId(category.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.productSectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>THIẾT BỊ TREKKING</Text>
            <Text style={styles.productSectionTitle}>Danh sách sản phẩm</Text>
          </View>
          <Text style={styles.productCount}>{productGroups.length} mẫu</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.stateDescription}>Đang kiểm tra thiết bị phù hợp...</Text>
          </View>
        ) : error ? (
          <StateCard
            icon="cloud-offline-outline"
            title="Chưa tải được thiết bị"
            description={error}
            actionLabel="Thử lại"
            onAction={() => void loadCatalog()}
          />
        ) : productGroups.length === 0 ? (
          <StateCard
            icon="search-outline"
            title="Không tìm thấy thiết bị"
            description="Thử đổi từ khóa hoặc chọn danh mục khác."
          />
        ) : (
          <View style={styles.productsGrid}>
            {productGroups.map((group) => {
              const selectedId = selectedVariantIds[group.key];
              const product =
                group.variants.find((variant) => variant.id === selectedId) ??
                group.variants[0];
              const cartEntry = cart.find(
                (entry) => entry.item.id === product.id,
              );
              const deposit = calculateProductDeposit(product);
              const availableCount = catalogAvailability[product.id]?.availableCount ?? 0;
              const cardImageUrl = productCardImage(product);
              const sizes = group.variants
                .map((variant) => ({ variant, size: productSize(variant) }))
                .filter((item): item is { variant: RentalProduct; size: string } => Boolean(item.size));

              return (
                <View key={group.key} style={styles.productCard}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push(`/rental-products/${product.id}` as Href)
                    }
                  >
                    <View style={styles.imageBox}>
                      <Image
                        source={{ uri: cardImageUrl }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                      {!product.imageUrl && (
                        <View style={styles.fallbackImageBadge}>
                          <Text style={styles.fallbackImageText}>Ảnh minh họa</Text>
                        </View>
                      )}
                      <View style={styles.availabilityBadge}>
                        <Ionicons
                          name="trail-sign-outline"
                          size={12}
                          color={Colors.primaryDark}
                        />
                        <Text style={styles.availabilityText}>
                          {availableCount > 0 ? `Còn ${availableCount}` : "Tạm hết"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.productBody}>
                    <Text style={styles.categoryTag}>{product.category.name}</Text>
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {group.name}
                    </Text>
                    {product.sku ? <Text style={styles.productSku}>SKU {product.sku}</Text> : null}
                    {sizes.length > 1 ? (
                      <View style={styles.variantBlock}>
                        <Text style={styles.variantLabel}>Chọn kích cỡ</Text>
                        <View style={styles.sizeRow}>
                          {sizes.map(({ variant, size }) => {
                            const selected = variant.id === product.id;
                            return (
                              <TouchableOpacity
                                key={variant.id}
                                style={[styles.sizeChip, selected && styles.sizeChipActive]}
                                onPress={() =>
                                  setSelectedVariantIds((current) => ({
                                    ...current,
                                    [group.key]: variant.id,
                                  }))
                                }
                              >
                                <Text style={[styles.sizeText, selected && styles.sizeTextActive]}>
                                  {size}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : productSize(product) ? (
                      <Text style={styles.singleVariant}>Kích cỡ: {productSize(product)}</Text>
                    ) : null}
                    <Text style={styles.dailyPrice}>
                      {formatMoney(product.dailyPrice)}{" "}
                      <Text style={styles.perDay}>/ngày</Text>
                    </Text>
                    <Text style={styles.depositPrice}>
                      Cọc dự kiến: {formatMoney(deposit)}
                    </Text>

                    {cartEntry ? (
                      <View style={styles.quantityControl}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          accessibilityLabel="Giảm số lượng"
                          onPress={() =>
                            setCartQuantity(
                              toCartItem(product, availableCount),
                              cartEntry.quantity - 1,
                            )
                          }
                        >
                          <Ionicons
                            name="remove"
                            size={17}
                            color={Colors.onPrimary}
                          />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>
                          {cartEntry.quantity}
                        </Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          accessibilityLabel="Tăng số lượng"
                          disabled={cartEntry.quantity >= availableCount}
                          onPress={() =>
                            setCartQuantity(
                              toCartItem(product, availableCount),
                              Math.min(availableCount, cartEntry.quantity + 1),
                            )
                          }
                        >
                          <Ionicons
                            name="add"
                            size={17}
                            color={Colors.onPrimary}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        disabled={availableCount < 1}
                        style={[styles.addButton, availableCount < 1 && styles.disabledButton]}
                        onPress={() => setCartQuantity(toCartItem(product, availableCount), 1)}
                      >
                        <Ionicons
                          name="add"
                          size={17}
                          color={Colors.onPrimary}
                        />
                        <Text style={styles.addButtonText}>{availableCount > 0 ? "Chọn thuê" : "Tạm hết"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
          </>
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Thuê thiết bị" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          view === "CATALOG" ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadCatalog(true)}
              tintColor={Colors.primaryDark}
            />
          ) : (
            <RefreshControl
              refreshing={ordersRefreshing}
              onRefresh={() => void loadOrders(true)}
              tintColor={Colors.primaryDark}
            />
          )
        }
        contentContainerStyle={styles.scrollContent}
      >
        {view === "CATALOG" ? renderCatalog() : (
          <>
            <View style={styles.ordersPageHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.sectionEyebrow}>QUẢN LÝ THIẾT BỊ ĐÃ ĐẶT</Text>
                <Text style={styles.ordersPageTitle}>Đơn thuê của tôi</Text>
              </View>
              <TouchableOpacity style={styles.backToCatalog} onPress={() => setView("CATALOG")}>
                <Ionicons name="grid-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.backToCatalogText}>Danh mục</Text>
              </TouchableOpacity>
            </View>
            {renderOrders()}
          </>
        )}
      </ScrollView>

      {view === "CATALOG" && cartTotalItems > 0 && (
        <View style={styles.floatingCart}>
          <View style={styles.cartCount}>
            <Text style={styles.cartCountText}>{cartTotalItems}</Text>
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.cartTitle}>{cartTotalItems} thiết bị đã chọn</Text>
            <Text style={styles.cartSubtitle}>
              Dành cho chuyến {selectedTrip?.title || "đã chọn"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => setCartModalVisible(true)}
          >
            <Text style={styles.cartButtonText}>Xem giỏ</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <RentalCartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
      />
    </SafeAreaView>
  );
}

function formatTripWindow(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function formatCurrency(value: number, currency = "VND") {
  return `${value.toLocaleString("vi-VN")} ${currency === "VND" ? "đ" : currency}`;
}

function rentalOrderStatus(status: string) {
  const statuses: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    PENDING_PAYMENT: { label: "Chờ thanh toán", color: "#8A5A00", bg: "#FFF1C2" },
    PAID: { label: "Đã thanh toán", color: "#226600", bg: "#E0F5D3" },
    PREPARING: { label: "Đang chuẩn bị", color: "#245F73", bg: "#DDF3F8" },
    READY_FOR_HANDOVER: { label: "Sẵn sàng nhận", color: "#226600", bg: "#DDF7CB" },
    ACTIVE: { label: "Đang sử dụng", color: "#174B00", bg: "#CFF3B8" },
    RETURN_PENDING: { label: "Chờ thu hồi", color: "#714C00", bg: "#FFF0BF" },
    RETURN_PROCESSING: { label: "Đang xử lý trả", color: "#714C00", bg: "#FFE5A6" },
    COMPLETED: { label: "Hoàn tất", color: "#35523A", bg: "#E5EEE3" },
    CANCELLED: { label: "Đã hủy", color: "#9E1A1A", bg: "#FFE0DE" },
    EXPIRED: { label: "Hết hạn", color: "#6C6460", bg: "#EEEAE7" },
  };

  return (
    statuses[status] ?? {
      label: status.replaceAll("_", " "),
      color: Colors.onSurfaceVariant,
      bg: Colors.surfaceContainer,
    }
  );
}

function rentalExceptionLabel(status: string) {
  const labels: Record<string, string> = {
    ACTION_REQUIRED: "Đơn cần được hỗ trợ xử lý",
    OVERDUE: "Đơn đã quá hạn trả thiết bị",
    PAYMENT_REVIEW: "Thanh toán đang chờ đối soát",
    REFUND_REVIEW: "Hoàn cọc đang chờ đối soát",
  };

  return labels[status] || "Đơn cần được kiểm tra";
}

function CategoryPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const normalized = label.toLocaleLowerCase("vi-VN");
  const icon: keyof typeof Ionicons.glyphMap =
    normalized === "tất cả"
      ? "apps-outline"
      : normalized.includes("lều")
        ? "home-outline"
        : normalized.includes("balo") || normalized.includes("túi")
          ? "bag-handle-outline"
          : normalized.includes("giày")
            ? "footsteps-outline"
            : normalized.includes("gậy")
              ? "walk-outline"
              : normalized.includes("đèn")
                ? "flashlight-outline"
                : normalized.includes("bếp") || normalized.includes("nấu")
                  ? "flame-outline"
                  : normalized.includes("áo") || normalized.includes("trang phục")
                    ? "shirt-outline"
                    : "compass-outline";
  return (
    <TouchableOpacity
      style={[styles.categoryPill, active && styles.categoryPillActive]}
      onPress={onPress}
    >
      <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
        <Ionicons name={icon} size={22} color={active ? Colors.onPrimary : Colors.primaryDark} />
      </View>
      <Text
        style={[
          styles.categoryPillText,
          active && styles.categoryPillTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={34} color={Colors.primaryDark} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.stateButton} onPress={onAction}>
          <Text style={styles.stateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  quickTools: { paddingTop: 4, paddingBottom: 6 },
  quickHeading: { paddingHorizontal: 16, paddingTop: 8 },
  quickHeadingTitle: { color: Colors.onSurface, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  quickActions: {
    paddingHorizontal: 16,
    paddingTop: 5,
    flexDirection: "row",
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 74,
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 7,
    borderRadius: Radius.md,
    backgroundColor: "transparent",
  },
  quickActionCardActive: { backgroundColor: Colors.primaryPale },
  quickActionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  quickActionIconActive: { backgroundColor: Colors.primary },
  quickActionTitle: {
    color: Colors.onSurface,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  ordersPageHeader: { marginHorizontal: 16, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  ordersPageTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  backToCatalog: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: Colors.primaryNeutral, borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  backToCatalogText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "700" },
  sectionHeading: { paddingHorizontal: 16, paddingTop: 16 },
  sectionEyebrow: { color: Colors.primaryDark, fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 0.8 },
  sectionHeadingTitle: { marginTop: 3, color: Colors.onSurface, fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.25 },
  sectionHeadingHint: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16 },
  productSectionHeader: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  productSectionTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2 },
  productCount: { color: Colors.onSurfaceMuted, fontSize: 10, lineHeight: 14 },
  catalogHeading: { paddingHorizontal: 16, paddingTop: 14 },
  catalogHeadingHint: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 10, lineHeight: 14 },
  contextBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    backgroundColor: Colors.primaryPale,
  },
  contextIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  contextTitle: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  contextDescription: {
    marginTop: 4,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedTripText: {
    marginTop: 6,
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedTripRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  selectedTripMeta: { marginTop: 2, color: Colors.onSurfaceVariant, fontSize: 10 },
  changeTripText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  searchRow: {
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  searchInput: { flex: 1, color: Colors.onSurface, fontSize: 13 },
  searchButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  categoryPill: {
    width: 84,
    minHeight: 88,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  categoryPillActive: { borderColor: Colors.inkDeep, backgroundColor: Colors.inkDeep },
  categoryIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  categoryIconActive: { backgroundColor: "rgba(159,232,112,0.18)" },
  categoryPillText: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryPillTextActive: { color: Colors.onPrimaryDark },
  centerState: { paddingVertical: 70, alignItems: "center", gap: 12 },
  ordersList: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  orderCard: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  orderTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  orderCode: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  orderTrip: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
  },
  orderTripMeta: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 9 },
  statusPill: {
    maxWidth: 118,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  orderDivider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: Colors.surfaceContainer,
  },
  orderBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderMetaLabel: { color: Colors.onSurfaceMuted, fontSize: 9 },
  orderAmount: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "600",
  },
  orderOpen: { flexDirection: "row", alignItems: "center", gap: 3 },
  orderOpenText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  exceptionText: {
    marginTop: 10,
    color: "#A32020",
    fontSize: 10,
    fontWeight: "600",
  },
  productsGrid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  productCard: {
    width: "48.2%",
    overflow: "hidden",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  imageBox: { height: 145, backgroundColor: Colors.surfaceContainerHigh },
  productImage: { width: "100%", height: "100%" },
  fallbackImageBadge: { position: "absolute", right: 7, top: 7, paddingHorizontal: 7, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: "rgba(255,255,255,0.9)" },
  fallbackImageText: { color: Colors.onSurfaceVariant, fontSize: 7, fontWeight: "600" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 12,
    backgroundColor: Colors.primaryPale,
  },
  imagePlaceholderText: {
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  availabilityBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.93)",
  },
  availabilityText: {
    color: Colors.primaryDark,
    fontSize: 8,
    fontWeight: "600",
  },
  productBody: { padding: 12 },
  categoryTag: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  productTitle: {
    minHeight: 38,
    marginTop: 5,
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    letterSpacing: -0.15,
  },
  productSku: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 9, lineHeight: 12, letterSpacing: 0.3 },
  variantBlock: { marginTop: 9 },
  variantLabel: { color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "600" },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  sizeChip: { minWidth: 30, alignItems: "center", borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#fff" },
  sizeChipActive: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  sizeText: { color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "600" },
  sizeTextActive: { color: Colors.primaryDark },
  singleVariant: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 9 },
  dailyPrice: {
    marginTop: 9,
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: "600",
  },
  perDay: { color: Colors.onSurfaceVariant, fontSize: 10, fontWeight: "500" },
  depositPrice: {
    marginTop: 3,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
  },
  addButton: {
    marginTop: 10,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  addButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "600" },
  disabledButton: { opacity: 0.45 },
  quantityControl: {
    marginTop: 12,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
  },
  quantityButton: {
    width: 44,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    minWidth: 28,
    color: Colors.onPrimaryDark,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  stateCard: {
    margin: 16,
    padding: 28,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  stateIcon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  stateTitle: {
    marginTop: 14,
    textAlign: "center",
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: "600",
  },
  stateDescription: {
    marginTop: 7,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
  },
  stateButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  stateButtonText: { color: Colors.onPrimaryDark, fontWeight: "600" },
  floatingCart: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.xl,
    backgroundColor: Colors.inkDeep,
    ...Shadows.tactical,
  },
  cartCount: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  cartCountText: { color: Colors.onPrimary, fontWeight: "600" },
  cartTitle: { color: Colors.onPrimaryDark, fontSize: 12, fontWeight: "600" },
  cartSubtitle: { marginTop: 2, color: Colors.primaryNeutral, fontSize: 9 },
  cartButton: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  cartButtonText: { color: Colors.onPrimary, fontSize: 11, fontWeight: "600" },
});
