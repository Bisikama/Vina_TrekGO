import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';

import { useRentalProductDetail } from '@/features/rentals/hooks/use-rental-product-detail';
import { useTheme } from '@/hooks/use-theme';
import { ApiClientError } from '@/services/api-client';

type RentalProductDetailScreenProps = {
  productId: string;
  bookingId: string;
};

const currencyFormatter =
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const dateTimeFormatter =
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const specLabels:
  Record<string, string> = {
    capacityPeople: 'Sức chứa',
    weightKg: 'Khối lượng',
    season: 'Mùa sử dụng',
    size: 'Kích thước',
    material: 'Chất liệu',
    waterproof: 'Chống nước',
  };

function formatSpecValue(
  key: string,
  value: unknown,
) {
  if (
    key === 'capacityPeople' &&
    typeof value === 'number'
  ) {
    return `${value} người`;
  }

  if (
    key === 'weightKg' &&
    typeof value === 'number'
  ) {
    return `${value} kg`;
  }

  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }

  return String(value).replaceAll(
    '_',
    ' ',
  );
}

function Header() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại danh mục thiết bị"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          {
            backgroundColor:
              theme.backgroundElement,
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText
          style={styles.backIcon}
        >
          ‹
        </ThemedText>
      </Pressable>

      <View style={styles.topBarText}>
        <ThemedText type="smallBold">
          Chi tiết thiết bị
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Vina TrekGo Rental
        </ThemedText>
      </View>
    </View>
  );
}

function MessageState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.centerState}>
      <ThemedText
        style={styles.stateTitle}
      >
        {title}
      </ThemedText>

      <ThemedText
        themeColor="textSecondary"
        style={styles.stateMessage}
      >
        {message}
      </ThemedText>

      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor:
                theme.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{
              color: theme.onPrimary,
            }}
          >
            Thử lại
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function QuantitySelector({
  value,
  maximum,
  onChange,
}: {
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.quantityRow}>
      <View style={styles.quantityLabel}>
        <ThemedText type="smallBold">
          Số lượng
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Tối đa {maximum} theo tồn kho
          hiện tại
        </ThemedText>
      </View>

      <View
        style={[
          styles.stepper,
          {
            borderColor: theme.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Giảm số lượng"
          disabled={value <= 1}
          onPress={() =>
            onChange(value - 1)
          }
          style={({ pressed }) => [
            styles.stepperButton,
            value <= 1 &&
              styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            style={styles.stepperText}
          >
            −
          </ThemedText>
        </Pressable>

        <ThemedText
          style={styles.quantityValue}
        >
          {value}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tăng số lượng"
          disabled={value >= maximum}
          onPress={() =>
            onChange(value + 1)
          }
          style={({ pressed }) => [
            styles.stepperButton,
            value >= maximum &&
              styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            style={styles.stepperText}
          >
            +
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function RentalProductDetailScreen({
  productId,
  bookingId,
}: RentalProductDetailScreenProps) {
  const theme = useTheme();

  const { width } =
    useWindowDimensions();

  const wide = width >= 760;

  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    retry,
  } = useRentalProductDetail(
    productId,
    bookingId,
  );

  const [quantity, setQuantity] =
    useState(1);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(0);

  const specs = useMemo(
    () =>
      Object.entries(
        data?.product.spec ?? {},
      ).filter(([, value]) =>
        [
          'string',
          'number',
          'boolean',
        ].includes(typeof value),
      ),
    [data?.product.spec],
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView
          style={styles.safeArea}
        >
          <Header />

          <View style={styles.centerState}>
            <ActivityIndicator
              size="large"
              color={theme.primary}
            />

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Đang tải thông tin thiết bị…
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!data && error) {
    const notFound =
      error instanceof ApiClientError &&
      error.status === 404;

    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView
          style={styles.safeArea}
        >
          <Header />

          <MessageState
            title={
              notFound
                ? 'Không tìm thấy thiết bị'
                : 'Chưa tải được chi tiết'
            }
            message={
              notFound
                ? 'Sản phẩm có thể đã ngừng hoạt động hoặc không tồn tại.'
                : error.message
            }
            onRetry={
              notFound
                ? undefined
                : retry
            }
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!data) {
    return null;
  }

  const {
    product,
    availability,
    recommendation,
    tripSummary,
  } = data;

  const soldOut =
    availability.availableCount === 0;

  const safeQuantity = soldOut
    ? 1
    : Math.min(
        quantity,
        availability.availableCount,
      );

  const mainImage =
    product.imageUrls[selectedImage] ??
    null;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
          'left',
          'right',
        ]}
      >
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <Header />

          <View
            style={[
              styles.hero,
              wide && styles.heroWide,
            ]}
          >
            <View
              style={[
                styles.gallery,
                wide &&
                  styles.galleryWide,
              ]}
            >
              <View
                style={[
                  styles.imageFrame,
                  {
                    backgroundColor:
                      theme.primarySurface,
                  },
                ]}
              >
                {mainImage ? (
                  <Image
                    source={mainImage}
                    style={styles.image}
                    contentFit="contain"
                    transition={180}
                  />
                ) : (
                  <ThemedText
                    themeColor="textSecondary"
                  >
                    Chưa có ảnh sản phẩm
                  </ThemedText>
                )}
              </View>

              {product.imageUrls.length >
              1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                >
                  <View
                    style={
                      styles.thumbnailRow
                    }
                  >
                    {product.imageUrls.map(
                      (
                        imageUrl,
                        index,
                      ) => (
                        <Pressable
                          key={`${imageUrl}-${index}`}
                          onPress={() =>
                            setSelectedImage(
                              index,
                            )
                          }
                          style={[
                            styles.thumbnail,
                            {
                              backgroundColor:
                                theme.primarySurface,

                              borderColor:
                                index ===
                                selectedImage
                                  ? theme.primary
                                  : theme.border,
                            },
                          ]}
                        >
                          <Image
                            source={imageUrl}
                            style={
                              styles.thumbnailImage
                            }
                            contentFit="contain"
                          />
                        </Pressable>
                      ),
                    )}
                  </View>
                </ScrollView>
              ) : null}
            </View>

            <View
              style={[
                styles.productInfo,
                wide &&
                  styles.productInfoWide,
              ]}
            >
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor:
                        theme.primarySurface,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor="primary"
                  >
                    {product.category.name.toUpperCase()}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.stockBadge,
                    {
                      backgroundColor:
                        soldOut
                          ? theme.dangerSurface
                          : theme.successSurface,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor={
                      soldOut
                        ? 'danger'
                        : 'success'
                    }
                  >
                    {soldOut
                      ? 'Hết hàng'
                      : `Còn ${availability.availableCount}`}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.titleBlock}>
                <ThemedText
                  style={styles.productName}
                >
                  {product.name}
                </ThemedText>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Mã sản phẩm:{' '}
                  {product.sku}
                </ThemedText>
              </View>

              <ThemedText
                themeColor="textSecondary"
                style={styles.description}
              >
                {product.description}
              </ThemedText>

              <View
                style={[
                  styles.pricePanel,
                  {
                    backgroundColor:
                      theme.backgroundElement,
                  },
                ]}
              >
                <View>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                  >
                    Giá thuê
                  </ThemedText>

                  <ThemedText
                    style={[
                      styles.price,
                      {
                        color:
                          theme.primary,
                      },
                    ]}
                  >
                    {currencyFormatter.format(
                      product.dailyPrice,
                    )}

                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                    >
                      /ngày
                    </ThemedText>
                  </ThemedText>
                </View>

                <View
                  style={styles.depositBlock}
                >
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                  >
                    Tiền cọc
                  </ThemedText>

                  <ThemedText type="smallBold">
                    {currencyFormatter.format(
                      product.depositPolicy
                        .amount,
                    )}
                  </ThemedText>
                </View>
              </View>

              {!soldOut ? (
                <>
                  <QuantitySelector
                    value={safeQuantity}
                    maximum={
                      availability.availableCount
                    }
                    onChange={setQuantity}
                  />

                  <View
                    style={[
                      styles.selectionSummary,
                      {
                        backgroundColor:
                          theme.primary,
                      },
                    ]}
                  >
                    <View>
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            theme.onPrimaryMuted,
                        }}
                      >
                        Đã chọn{' '}
                        {safeQuantity} thiết bị
                      </ThemedText>

                      <ThemedText
                        style={[
                          styles.selectionTotal,
                          {
                            color:
                              theme.onPrimary,
                          },
                        ]}
                      >
                        {currencyFormatter.format(
                          product.dailyPrice *
                            safeQuantity,
                        )}

                        <ThemedText
                          type="small"
                          style={{
                            color:
                              theme.onPrimaryMuted,
                          }}
                        >
                          /ngày
                        </ThemedText>
                      </ThemedText>
                    </View>

                    <ThemedText
                      type="small"
                      style={{
                        color:
                          theme.onPrimaryMuted,
                      }}
                    >
                      Báo giá chính xác ở giỏ
                      thuê
                    </ThemedText>
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.soldOutPanel,
                    {
                      backgroundColor:
                        theme.dangerSurface,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    themeColor="danger"
                  >
                    Thiết bị đã hết trong thời
                    gian chuyến này
                  </ThemedText>

                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                  >
                    Kéo xuống để cập nhật lại
                    tồn kho hoặc chọn sản phẩm
                    khác.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View
            style={[
              styles.detailGrid,
              wide &&
                styles.detailGridWide,
            ]}
          >
            <ThemedView
              type="surfaceElevated"
              style={[
                styles.panel,
                {
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <ThemedText
                style={styles.panelTitle}
              >
                Thông số thiết bị
              </ThemedText>

              {specs.length ? (
                specs.map(
                  ([key, value]) => (
                    <View
                      key={key}
                      style={[
                        styles.specRow,
                        {
                          borderBottomColor:
                            theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                      >
                        {specLabels[key] ??
                          key.replace(
                            /([a-z])([A-Z])/g,
                            '$1 $2',
                          )}
                      </ThemedText>

                      <ThemedText type="smallBold">
                        {formatSpecValue(
                          key,
                          value,
                        )}
                      </ThemedText>
                    </View>
                  ),
                )
              ) : (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Chưa có thông số chi tiết.
                </ThemedText>
              )}
            </ThemedView>

            <View style={styles.sidePanels}>
              <ThemedView
                type="surfaceElevated"
                style={[
                  styles.panel,
                  {
                    borderColor:
                      theme.border,
                  },
                ]}
              >
                <ThemedText
                  style={styles.panelTitle}
                >
                  Thời gian giữ thiết bị
                </ThemedText>

                <View style={styles.windowRow}>
                  <View
                    style={styles.windowItem}
                  >
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                    >
                      Từ
                    </ThemedText>

                    <ThemedText type="smallBold">
                      {dateTimeFormatter.format(
                        new Date(
                          availability
                            .rentalWindow
                            .occupiedFrom,
                        ),
                      )}
                    </ThemedText>
                  </View>

                  <View
                    style={styles.windowItem}
                  >
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                    >
                      Đến
                    </ThemedText>

                    <ThemedText type="smallBold">
                      {dateTimeFormatter.format(
                        new Date(
                          availability
                            .rentalWindow
                            .occupiedUntil,
                        ),
                      )}
                    </ThemedText>
                  </View>
                </View>
              </ThemedView>

              <View
                style={[
                  styles.recommendationPanel,
                  {
                    backgroundColor:
                      theme.primarySurface,
                  },
                ]}
              >
                <ThemedText
                  style={styles.panelTitle}
                >
                  {recommendation
                    ? 'Phù hợp với chuyến của bạn'
                    : 'Thông tin chuyến đi'}
                </ThemedText>

                <ThemedText type="smallBold">
                  {tripSummary.name}
                </ThemedText>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  {tripSummary.durationDays}{' '}
                  ngày ·{' '}
                  {tripSummary.difficulty.replaceAll(
                    '_',
                    ' ',
                  )}
                  {tripSummary.weatherSummary
                    ? ` · ${tripSummary.weatherSummary}`
                    : ''}
                </ThemedText>

                {recommendation?.reasons.map(
                  (reason) => (
                    <View
                      key={reason}
                      style={styles.reasonRow}
                    >
                      <View
                        style={[
                          styles.reasonDot,
                          {
                            backgroundColor:
                              theme.primary,
                          },
                        ]}
                      />

                      <ThemedText
                        type="small"
                        style={
                          styles.reasonText
                        }
                      >
                        {reason}
                      </ThemedText>
                    </View>
                  ),
                )}

                {!recommendation ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                  >
                    Chưa có gợi ý riêng cho sản
                    phẩm này. Bạn vẫn có thể
                    chọn theo nhu cầu.
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom:
      Spacing.six + Spacing.five,
    gap: Spacing.four,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '400',
  },

  topBarText: {
    gap: 1,
  },

  hero: {
    gap: Spacing.four,
  },

  heroWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  gallery: {
    gap: Spacing.two,
  },

  galleryWide: {
    width: '48%',
  },

  imageFrame: {
    width: '100%',
    aspectRatio: 1.14,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  image: {
    width: '88%',
    height: '88%',
  },

  thumbnailRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  thumbnail: {
    width: 68,
    height: 68,
    borderWidth: 2,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  thumbnailImage: {
    width: '88%',
    height: '88%',
  },

  productInfo: {
    gap: Spacing.three,
  },

  productInfoWide: {
    flex: 1,
  },

  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },

  categoryBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },

  stockBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },

  titleBlock: {
    gap: Spacing.one,
  },

  productName: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
  },

  pricePanel: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },

  price: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },

  depositBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },

  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  quantityLabel: {
    flex: 1,
    gap: 2,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
  },

  stepperButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepperText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '600',
  },

  quantityValue: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },

  selectionSummary: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  selectionTotal: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
  },

  soldOutPanel: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },

  detailGrid: {
    gap: Spacing.three,
  },

  detailGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  panel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  panelTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },

  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
  },

  sidePanels: {
    flex: 1,
    gap: Spacing.three,
  },

  windowRow: {
    gap: Spacing.two,
  },

  windowItem: {
    gap: 2,
  },

  recommendationPanel: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  reasonDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  reasonText: {
    flex: 1,
  },

  centerState: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },

  stateTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },

  stateMessage: {
    textAlign: 'center',
  },

  retryButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },

  disabled: {
    opacity: 0.35,
  },

  pressed: {
    opacity: 0.7,
  },
});