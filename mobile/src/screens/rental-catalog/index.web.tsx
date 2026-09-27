import { Image } from "expo-image";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useRentalCatalog } from "@/features/rentals/hooks/use-rental-catalog";
import type {
  RentalCatalogData,
  RentalCatalogItem,
} from "@/features/rentals/types/rental-catalog";

type RentalCatalogScreenProps = {
  bookingId: string;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSpecText(spec: Record<string, unknown>) {
  return Object.values(spec)
    .filter(
      (value): value is string | number =>
        typeof value === "string" ||
        typeof value === "number",
    )
    .slice(0, 3)
    .join(" · ");
}

function getEligibilityMessage(reason: string | null) {
  switch (reason) {
    case "RENTAL_CUTOFF_PASSED":
      return "Đã quá thời hạn đặt thiết bị cho chuyến này.";

    case "BOOKING_NOT_CONFIRMED":
      return "Booking cần được xác nhận trước khi thuê thiết bị.";

    case "TRIP_CANCELLED":
      return "Chuyến đi đã bị hủy nên không thể thuê thiết bị.";

    default:
      return "Booking hoặc chuyến đi chưa đủ điều kiện thuê thiết bị.";
  }
}

function StatePanel({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.statePage}>
      <View style={styles.stateCard}>
        <ThemedText style={styles.stateTitle}>
          {title}
        </ThemedText>

        <ThemedText style={styles.stateMessage}>
          {message}
        </ThemedText>

        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={styles.primaryButton}
          >
            <ThemedText style={styles.primaryButtonText}>
              Thử lại
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProductCard({
  item,
}: {
  item: RentalCatalogItem;
}) {
  const available = item.availableCount > 0;
  const specText = getSpecText(item.spec);

  return (
    <View style={styles.productCard}>
      <View style={styles.imageWrap}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.productImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <ThemedText style={styles.imageFallbackText}>
              TREK
            </ThemedText>
          </View>
        )}

        <View style={styles.categoryBadge}>
          <ThemedText style={styles.categoryBadgeText}>
            {item.category.name}
          </ThemedText>
        </View>

        <View
          style={[
            styles.stockBadge,
            !available && styles.stockBadgeEmpty,
          ]}
        >
          <ThemedText
            style={[
              styles.stockBadgeText,
              !available && styles.stockBadgeTextEmpty,
            ]}
          >
            {available
              ? `Còn ${item.availableCount}`
              : "Hết hàng"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.productBody}>
        {item.recommendation ? (
          <ThemedText style={styles.recommendedText}>
            ★ Phù hợp chuyến đi
          </ThemedText>
        ) : null}

        <ThemedText
          style={styles.productName}
          numberOfLines={2}
        >
          {item.name}
        </ThemedText>

        <ThemedText
          style={styles.productDescription}
          numberOfLines={2}
        >
          {item.description}
        </ThemedText>

        {specText ? (
          <ThemedText style={styles.specText}>
            {specText}
          </ThemedText>
        ) : null}

        <View style={styles.productDivider} />

        <View style={styles.priceRow}>
          <View>
            <ThemedText style={styles.price}>
              {formatMoney(
                item.dailyPrice,
                item.currency,
              )}
            </ThemedText>

            <ThemedText style={styles.priceUnit}>
              / ngày · Cọc{" "}
              {formatMoney(
                item.depositAmount,
                item.currency,
              )}
            </ThemedText>
          </View>

          <View
            style={[
              styles.viewButton,
              !available && styles.viewButtonDisabled,
            ]}
          >
            <ThemedText style={styles.viewButtonText}>
              {available ? "Xem thiết bị" : "Tạm hết"}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

function TripBanner({
  data,
}: {
  data: RentalCatalogData;
}) {
  const { trip, rentalCutoffAt } =
    data.eligibility;

  return (
    <View style={styles.tripBanner}>
      <View style={styles.tripIcon}>
        <ThemedText style={styles.tripIconText}>
          ▲
        </ThemedText>
      </View>

      <View style={styles.tripMain}>
        <ThemedText style={styles.tripLabel}>
          THIẾT BỊ CHO CHUYẾN ĐI
        </ThemedText>

        <ThemedText style={styles.tripName}>
          {trip.name}
        </ThemedText>
      </View>

      <View style={styles.tripMeta}>
        <ThemedText style={styles.tripMetaLabel}>
          Thời gian thuê
        </ThemedText>

        <ThemedText style={styles.tripMetaValue}>
          {formatDate(trip.startAt)} –{" "}
          {formatDate(trip.endAt)}
        </ThemedText>
      </View>

      <View style={styles.tripMeta}>
        <ThemedText style={styles.tripMetaLabel}>
          Hạn đặt thiết bị
        </ThemedText>

        <ThemedText style={styles.tripMetaValue}>
          {formatDate(rentalCutoffAt)}
        </ThemedText>
      </View>
    </View>
  );
}

export function RentalCatalogScreen({
  bookingId,
}: RentalCatalogScreenProps) {
  const { width } = useWindowDimensions();

  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    retry,
  } = useRentalCatalog(bookingId);

  const [query, setQuery] = useState("");

  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase("vi-VN");

    return data.items.filter((item) => {
      const inCategory =
        selectedCategoryId === null ||
        item.category.id === selectedCategoryId;

      const matchesQuery =
        !normalizedQuery ||
        `${item.name} ${item.description} ${item.category.name}`
          .toLocaleLowerCase("vi-VN")
          .includes(normalizedQuery);

      return inCategory && matchesQuery;
    });
  }, [
    data,
    query,
    selectedCategoryId,
  ]);

  if (isLoading) {
    return (
      <View style={styles.statePage}>
        <ActivityIndicator
          size="large"
          color="#125238"
        />

        <ThemedText style={styles.stateMessage}>
          Đang chuẩn bị danh mục thiết bị…
        </ThemedText>
      </View>
    );
  }

  if (error || !data) {
    return (
      <StatePanel
        title="Không tải được thiết bị"
        message={
          error?.message ??
          "Dữ liệu không hợp lệ."
        }
        onRetry={retry}
      />
    );
  }

  if (!data.eligibility.eligible) {
    return (
      <StatePanel
        title="Chưa thể thuê thiết bị"
        message={getEligibilityMessage(
          data.eligibility.reason,
        )}
      />
    );
  }

  const showSidebar = width >= 900;
  const showSummary = width >= 1160;

  const recommendedItems = data.items.filter(
    (item) => item.recommendation !== null,
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.breadcrumbRow}>
        <ThemedText style={styles.breadcrumbMuted}>
          Trang chủ / Thuê thiết bị /{" "}
        </ThemedText>

        <ThemedText style={styles.breadcrumbCurrent}>
          Danh mục thiết bị
        </ThemedText>
      </View>

      <TripBanner data={data} />

      <View style={styles.titleRow}>
        <View>
          <ThemedText style={styles.pageTitle}>
            Thuê thiết bị trekking
          </ThemedText>

          <ThemedText style={styles.pageSubtitle}>
            Thiết bị phù hợp, sẵn sàng theo đúng
            lịch trình của bạn.
          </ThemedText>
        </View>

        <Pressable
          onPress={refresh}
          disabled={isRefreshing}
          style={styles.refreshButton}
        >
          <ThemedText style={styles.refreshText}>
            {isRefreshing
              ? "Đang cập nhật…"
              : "↻ Cập nhật tồn kho"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.catalogLayout}>
        {showSidebar ? (
          <View style={styles.sidebar}>
            <ThemedText style={styles.panelTitle}>
              Bộ lọc
            </ThemedText>

            <ThemedText style={styles.filterHeading}>
              Danh mục
            </ThemedText>

            <Pressable
              onPress={() =>
                setSelectedCategoryId(null)
              }
              style={styles.filterOption}
            >
              <View
                style={[
                  styles.radio,
                  selectedCategoryId === null &&
                    styles.radioActive,
                ]}
              />

              <ThemedText
                style={[
                  styles.filterText,
                  selectedCategoryId === null &&
                    styles.filterTextActive,
                ]}
              >
                Tất cả thiết bị
              </ThemedText>

              <ThemedText style={styles.filterCount}>
                {data.items.length}
              </ThemedText>
            </Pressable>

            {data.categories.map((category) => {
              const count = data.items.filter(
                (item) =>
                  item.category.id === category.id,
              ).length;

              const active =
                selectedCategoryId === category.id;

              return (
                <Pressable
                  key={category.id}
                  onPress={() =>
                    setSelectedCategoryId(
                      category.id,
                    )
                  }
                  style={styles.filterOption}
                >
                  <View
                    style={[
                      styles.radio,
                      active && styles.radioActive,
                    ]}
                  />

                  <ThemedText
                    style={[
                      styles.filterText,
                      active &&
                        styles.filterTextActive,
                    ]}
                  >
                    {category.name}
                  </ThemedText>

                  <ThemedText
                    style={styles.filterCount}
                  >
                    {count}
                  </ThemedText>
                </Pressable>
              );
            })}

            <View style={styles.sidebarDivider} />

            <ThemedText style={styles.filterHeading}>
              Tình trạng
            </ThemedText>

            <View style={styles.availabilityNote}>
              <ThemedText
                style={styles.availabilityNoteText}
              >
                Tồn kho đã được kiểm tra theo ngày
                bắt đầu và kết thúc chuyến đi.
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.mainColumn}>
          <View style={styles.searchBox}>
            <ThemedText style={styles.searchIcon}>
              ⌕
            </ThemedText>

            <TextInput
              accessibilityLabel="Tìm thiết bị"
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm lều, balo, gậy trekking…"
              placeholderTextColor="#8a958f"
              style={styles.searchInput}
            />
          </View>

          {!showSidebar ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Pressable
                onPress={() =>
                  setSelectedCategoryId(null)
                }
                style={[
                  styles.chip,
                  selectedCategoryId === null &&
                    styles.chipActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    selectedCategoryId === null &&
                      styles.chipTextActive,
                  ]}
                >
                  Tất cả
                </ThemedText>
              </Pressable>

              {data.categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() =>
                    setSelectedCategoryId(
                      category.id,
                    )
                  }
                  style={[
                    styles.chip,
                    selectedCategoryId ===
                      category.id &&
                      styles.chipActive,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      selectedCategoryId ===
                        category.id &&
                        styles.chipTextActive,
                    ]}
                  >
                    {category.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.resultRow}>
            <ThemedText style={styles.resultText}>
              <ThemedText
                style={styles.resultCount}
              >
                {filteredItems.length}
              </ThemedText>{" "}
              thiết bị phù hợp
            </ThemedText>

            <ThemedText style={styles.sortText}>
              Sắp xếp: Gợi ý cho bạn
            </ThemedText>
          </View>

          {filteredItems.length ? (
            <View style={styles.productGrid}>
              {filteredItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.productCell,
                    width < 700 &&
                      styles.productCellSingle,
                  ]}
                >
                  <ProductCard item={item} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyTitle}>
                Không tìm thấy thiết bị
              </ThemedText>

              <ThemedText style={styles.emptyText}>
                Thử từ khóa khác hoặc chọn lại
                danh mục.
              </ThemedText>
            </View>
          )}
        </View>

        {showSummary ? (
          <View style={styles.summaryColumn}>
            <View style={styles.summaryCard}>
              <ThemedText style={styles.panelTitle}>
                Gợi ý cho chuyến đi
              </ThemedText>

              <ThemedText
                style={styles.summaryDescription}
              >
                Dựa trên cung đường và thời lượng
                chuyến.
              </ThemedText>

              <View style={styles.summaryDivider} />

              {recommendedItems.length ? (
                recommendedItems
                  .slice(0, 4)
                  .map((item) => (
                    <View
                      key={item.id}
                      style={
                        styles.recommendationItem
                      }
                    >
                      <View
                        style={
                          styles.recommendationDot
                        }
                      />

                      <View
                        style={
                          styles.recommendationCopy
                        }
                      >
                        <ThemedText
                          style={
                            styles.recommendationName
                          }
                        >
                          {item.name}
                        </ThemedText>

                        <ThemedText
                          style={
                            styles.recommendationReason
                          }
                          numberOfLines={2}
                        >
                          {item.recommendation?.reasons.join(
                            " · ",
                          )}
                        </ThemedText>
                      </View>
                    </View>
                  ))
              ) : (
                <ThemedText
                  style={styles.summaryDescription}
                >
                  Chưa có gợi ý riêng. Bạn có thể
                  xem toàn bộ thiết bị.
                </ThemedText>
              )}
            </View>

            <View style={styles.guideCard}>
              <ThemedText style={styles.guideTitle}>
                Cần hỗ trợ chọn đồ?
              </ThemedText>

              <ThemedText style={styles.guideText}>
                Kiểm tra mô tả và thông số trước
                khi chọn. Giỏ thuê và báo giá sẽ
                được hoàn thiện ở bước U03.
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.benefitBar}>
        <View style={styles.benefit}>
          <ThemedText style={styles.benefitIcon}>
            ✓
          </ThemedText>

          <View>
            <ThemedText style={styles.benefitTitle}>
              Thiết bị kiểm định
            </ThemedText>

            <ThemedText style={styles.benefitText}>
              Kiểm tra trước mỗi chuyến
            </ThemedText>
          </View>
        </View>

        <View style={styles.benefit}>
          <ThemedText style={styles.benefitIcon}>
            ↻
          </ThemedText>

          <View>
            <ThemedText style={styles.benefitTitle}>
              Tồn kho theo lịch
            </ThemedText>

            <ThemedText style={styles.benefitText}>
              Khớp ngày đi và ngày về
            </ThemedText>
          </View>
        </View>

        <View style={styles.benefit}>
          <ThemedText style={styles.benefitIcon}>
            ♢
          </ThemedText>

          <View>
            <ThemedText style={styles.benefitTitle}>
              Gợi ý phù hợp
            </ThemedText>

            <ThemedText style={styles.benefitText}>
              Theo đúng điều kiện chuyến
            </ThemedText>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8f9ff",
  },

  pageContent: {
    paddingTop: 124,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },

  breadcrumbRow: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    flexDirection: "row",
    marginBottom: 16,
  },

  breadcrumbMuted: {
    color: "#7b8881",
    fontSize: 12,
  },

  breadcrumbCurrent: {
    color: "#125238",
    fontSize: 12,
    fontWeight: "700",
  },

  tripBanner: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#eaf5ef",
    borderWidth: 1,
    borderColor: "#cee2d7",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  tripIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },

  tripIconText: {
    color: "#ffffff",
    fontSize: 20,
  },

  tripMain: {
    flex: 1,
  },

  tripLabel: {
    color: "#56806c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
  },

  tripName: {
    color: "#173d2d",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },

  tripMeta: {
    minWidth: 190,
    paddingLeft: 22,
    borderLeftWidth: 1,
    borderLeftColor: "#c7ddd2",
  },

  tripMetaLabel: {
    color: "#728078",
    fontSize: 11,
    marginBottom: 3,
  },

  tripMetaValue: {
    color: "#244936",
    fontSize: 13,
    fontWeight: "700",
  },

  titleRow: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    marginTop: 28,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  pageTitle: {
    color: "#183c2d",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  pageSubtitle: {
    color: "#718078",
    fontSize: 13,
    marginTop: 5,
  },

  refreshButton: {
    borderWidth: 1,
    borderColor: "#c8d5ce",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },

  refreshText: {
    color: "#125238",
    fontSize: 12,
    fontWeight: "700",
  },

  catalogLayout: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },

  sidebar: {
    width: 235,
    backgroundColor: "#ffffff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e0e7e3",
    padding: 18,
  },

  panelTitle: {
    color: "#213f32",
    fontSize: 16,
    fontWeight: "800",
  },

  filterHeading: {
    color: "#65736c",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 22,
    marginBottom: 9,
  },

  filterOption: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  radio: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#b8c5be",
    backgroundColor: "#ffffff",
  },

  radioActive: {
    borderWidth: 4,
    borderColor: "#125238",
  },

  filterText: {
    flex: 1,
    color: "#526058",
    fontSize: 12,
  },

  filterTextActive: {
    color: "#125238",
    fontWeight: "700",
  },

  filterCount: {
    color: "#9aa49f",
    fontSize: 11,
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: "#edf1ef",
    marginTop: 15,
  },

  availabilityNote: {
    backgroundColor: "#f2f7f4",
    borderRadius: 10,
    padding: 11,
  },

  availabilityNoteText: {
    color: "#587064",
    fontSize: 11,
    lineHeight: 16,
  },

  mainColumn: {
    flex: 1,
    minWidth: 0,
  },

  searchBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e0dc",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  searchIcon: {
    color: "#125238",
    fontSize: 22,
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: "#263a30",
    fontSize: 13,
  },

  chipRow: {
    gap: 8,
    paddingTop: 12,
  },

  chip: {
    borderWidth: 1,
    borderColor: "#d6ded9",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  chipActive: {
    backgroundColor: "#125238",
    borderColor: "#125238",
  },

  chipText: {
    color: "#59665f",
    fontSize: 11,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#ffffff",
  },

  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },

  resultText: {
    color: "#6f7b74",
    fontSize: 12,
  },

  resultCount: {
    color: "#183c2d",
    fontWeight: "800",
  },

  sortText: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "700",
  },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -7,
  },

  productCell: {
    width: "50%",
    paddingHorizontal: 7,
    marginBottom: 14,
  },

  productCellSingle: {
    width: "100%",
  },

  productCard: {
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e0e6e3",
  },

  imageWrap: {
    height: 185,
    backgroundColor: "#e8efeb",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbe8e1",
  },

  imageFallbackText: {
    color: "#648171",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 3,
  },

  categoryBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  categoryBadgeText: {
    color: "#315543",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  stockBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#e2f3e9",
  },

  stockBadgeEmpty: {
    backgroundColor: "#f4e4e1",
  },

  stockBadgeText: {
    color: "#26704c",
    fontSize: 9,
    fontWeight: "800",
  },

  stockBadgeTextEmpty: {
    color: "#9c4437",
  },

  productBody: {
    padding: 15,
  },

  recommendedText: {
    color: "#b66823",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 7,
  },

  productName: {
    color: "#203d30",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    minHeight: 40,
  },

  productDescription: {
    color: "#748078",
    fontSize: 11,
    lineHeight: 16,
    minHeight: 32,
    marginTop: 4,
  },

  specText: {
    color: "#52685d",
    fontSize: 10,
    marginTop: 8,
  },

  productDivider: {
    height: 1,
    backgroundColor: "#edf1ef",
    marginVertical: 12,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  price: {
    color: "#125238",
    fontSize: 16,
    fontWeight: "900",
  },

  priceUnit: {
    color: "#86918b",
    fontSize: 9,
    marginTop: 2,
  },

  viewButton: {
    backgroundColor: "#125238",
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  viewButtonDisabled: {
    backgroundColor: "#aeb8b2",
  },

  viewButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },

  summaryColumn: {
    width: 270,
    gap: 14,
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e0e7e3",
    padding: 18,
  },

  summaryDescription: {
    color: "#718078",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#e9eeeb",
    marginVertical: 14,
  },

  recommendationItem: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 14,
  },

  recommendationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#df7d2f",
    marginTop: 5,
  },

  recommendationCopy: {
    flex: 1,
  },

  recommendationName: {
    color: "#294438",
    fontSize: 11,
    fontWeight: "800",
  },

  recommendationReason: {
    color: "#7d8882",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
  },

  guideCard: {
    backgroundColor: "#125238",
    borderRadius: 15,
    padding: 18,
  },

  guideTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  guideText: {
    color: "#d7e9df",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },

  emptyCard: {
    alignItems: "center",
    padding: 50,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e7e3",
  },

  emptyTitle: {
    color: "#244234",
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    color: "#7b8780",
    fontSize: 12,
    marginTop: 6,
  },

  benefitBar: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    marginTop: 32,
    backgroundColor: "#edf4f0",
    borderRadius: 15,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 20,
  },

  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minWidth: 220,
  },

  benefitIcon: {
    color: "#125238",
    fontSize: 23,
    fontWeight: "900",
  },

  benefitTitle: {
    color: "#294438",
    fontSize: 12,
    fontWeight: "800",
  },

  benefitText: {
    color: "#7a8780",
    fontSize: 10,
    marginTop: 2,
  },

  statePage: {
    flex: 1,
    paddingTop: 145,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#f8f9ff",
  },

  stateCard: {
    width: "90%",
    maxWidth: 460,
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce5e0",
  },

  stateTitle: {
    color: "#203d30",
    fontSize: 20,
    fontWeight: "800",
  },

  stateMessage: {
    color: "#748078",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  primaryButton: {
    marginTop: 18,
    backgroundColor: "#125238",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
});