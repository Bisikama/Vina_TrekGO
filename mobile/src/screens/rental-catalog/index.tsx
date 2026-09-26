import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { RentalProductCard } from '@/features/rentals/components/rental-product-card';
import type {
  RentalCatalogData,
  RentalCatalogItem,
} from '@/features/rentals/types/rental-catalog';
import { useRentalCatalog } from '@/features/rentals/hooks/use-rental-catalog';
import { useTheme } from '@/hooks/use-theme';

type RentalCatalogScreenProps = {
  bookingId: string;
};

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getEligibilityMessage(reason: string | null) {
  switch (reason) {
    case 'RENTAL_CUTOFF_PASSED':
      return 'Đã quá thời hạn đặt thiết bị cho chuyến này.';
    case 'BOOKING_NOT_CONFIRMED':
      return 'Booking cần được xác nhận trước khi thuê thiết bị.';
    case 'TRIP_CANCELLED':
      return 'Chuyến đi đã bị hủy nên không thể thuê thiết bị.';
    default:
      return 'Booking hoặc chuyến đi chưa đủ điều kiện thuê thiết bị.';
  }
}

function LoadingState() {
  const theme = useTheme();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        Đang chuẩn bị thiết bị cho chuyến đi…
      </ThemedText>
    </View>
  );
}

function MessageState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.centerState}>
      <ThemedText style={styles.stateTitle}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.stateMessage}>
        {message}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function TripCard({ data }: { data: RentalCatalogData }) {
  const theme = useTheme();
  const { trip, rentalCutoffAt } = data.eligibility;

  return (
    <View style={[styles.tripCard, { backgroundColor: theme.primary }]}>
      <ThemedText style={[styles.tripEyebrow, { color: theme.onPrimaryMuted }]}>
        CHUYẾN SẮP TỚI
      </ThemedText>
      <ThemedText style={[styles.tripName, { color: theme.onPrimary }]}>{trip.name}</ThemedText>
      <View style={styles.tripMetaRow}>
        <View style={styles.tripMetaItem}>
          <ThemedText style={[styles.tripMetaLabel, { color: theme.onPrimaryMuted }]}>
            Thời gian
          </ThemedText>
          <ThemedText style={[styles.tripMetaValue, { color: theme.onPrimary }]}>
            {formatDate(trip.startAt)} – {formatDate(trip.endAt)}
          </ThemedText>
        </View>
        <View style={[styles.tripDivider, { backgroundColor: theme.primaryDivider }]} />
        <View style={styles.tripMetaItem}>
          <ThemedText style={[styles.tripMetaLabel, { color: theme.onPrimaryMuted }]}>
            Đặt trước
          </ThemedText>
          <ThemedText style={[styles.tripMetaValue, { color: theme.onPrimary }]}>
            Trước {formatDate(rentalCutoffAt)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function RecommendationSection({ items }: { items: RentalCatalogItem[] }) {
  const theme = useTheme();
  if (items.length === 0) {
    return (
      <View style={[styles.infoPanel, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Chưa có gợi ý riêng cho chuyến này</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Bạn vẫn có thể xem toàn bộ thiết bị bên dưới.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recommendationRow}>
      {items.map((item) => (
        <ThemedView
          key={item.id}
          type="primarySurface"
          style={[styles.recommendationCard, { borderColor: theme.primaryMuted }]}>
          <ThemedText type="smallBold" themeColor="primary" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText type="small" numberOfLines={2}>
            {item.recommendation?.reasons.join(' · ')}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="success">
            {item.availableCount > 0
              ? `Còn ${item.availableCount} sản phẩm`
              : 'Đã hết trong lịch trình'}
          </ThemedText>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

function CatalogHeader({
  data,
  selectedCategoryId,
  onSelectCategory,
}: {
  data: RentalCatalogData;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}) {
  const theme = useTheme();
  const recommendations = data.items.filter((item) => item.recommendation !== null);

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.brandMarkText, { color: theme.onPrimary }]}>V</ThemedText>
        </View>
        <View>
          <ThemedText type="smallBold">Vina TrekGo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Sẵn sàng cho mọi hành trình
          </ThemedText>
        </View>
      </View>

      <View style={styles.headingBlock}>
        <ThemedText style={styles.pageTitle}>Thuê thiết bị</ThemedText>
        <ThemedText themeColor="textSecondary">
          Chọn những món cần thiết theo lịch trình của bạn.
        </ThemedText>
      </View>

      <TripCard data={data} />

      <View style={styles.sectionHeading}>
        <ThemedText style={styles.sectionTitle}>Gợi ý cho chuyến của bạn</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Dựa trên thời lượng và điều kiện cung đường
        </ThemedText>
      </View>
      <RecommendationSection items={recommendations} />

      <View style={styles.sectionHeading}>
        <ThemedText style={styles.sectionTitle}>Tất cả thiết bị</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Số lượng được kiểm tra theo thời gian chuyến
        </ThemedText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}>
        <CategoryChip
          label="Tất cả"
          selected={selectedCategoryId === null}
          onPress={() => onSelectCategory(null)}
        />
        {data.categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            selected={selectedCategoryId === category.id}
            onPress={() => onSelectCategory(category.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryChip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={selected ? { color: theme.onPrimary } : undefined} type="smallBold">
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function RentalCatalogScreen({ bookingId }: RentalCatalogScreenProps) {
  const theme = useTheme();
  const { data, error, isLoading, isRefreshing, refresh, retry } = useRentalCatalog(bookingId);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const visibleItems = useMemo(
    () =>
      data?.items.filter(
        (item) => selectedCategoryId === null || item.category.id === selectedCategoryId,
      ) ?? [],
    [data, selectedCategoryId],
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <LoadingState />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!data && error) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <MessageState title="Chưa tải được thiết bị" message={error.message} actionLabel="Thử lại" onAction={retry} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!data) return null;

  if (!data.eligibility.eligible) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <MessageState
            title="Chuyến chưa thể thuê thiết bị"
            message={getEligibilityMessage(data.eligibility.reason)}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RentalProductCard item={item} />}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          ListHeaderComponent={
            <CatalogHeader
              data={data}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyPanel, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">Không có thiết bị trong nhóm này</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Hãy chọn nhóm khác hoặc kéo xuống để tải lại.
              </ThemedText>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={theme.primary} />
          }
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
        {error && data ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại danh mục"
            onPress={refresh}
            style={[styles.nonBlockingError, { backgroundColor: theme.danger }]}>
            <ThemedText
              type="smallBold"
              style={[styles.nonBlockingErrorText, { color: theme.onDanger }]}
              numberOfLines={1}>
              Cập nhật thất bại · Chạm để thử lại
            </ThemedText>
          </Pressable>
        ) : null}
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
    alignItems: 'center',
  },
  list: {
    width: '100%',
  },
  listContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  headingBlock: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  pageTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  tripCard: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tripEyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  tripName: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  tripMetaItem: {
    flex: 1,
    gap: 2,
  },
  tripDivider: {
    width: StyleSheet.hairlineWidth,
  },
  tripMetaLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  tripMetaValue: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  sectionHeading: {
    gap: 2,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
  },
  recommendationRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  recommendationCard: {
    width: 226,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  infoPanel: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  categoryRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  itemSeparator: {
    height: Spacing.three,
  },
  emptyPanel: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  centerState: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
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
  primaryButton: {
    minHeight: 48,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
  nonBlockingError: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  nonBlockingErrorText: {
    textAlign: 'center',
  },
});
