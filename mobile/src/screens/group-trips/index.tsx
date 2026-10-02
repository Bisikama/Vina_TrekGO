import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TripDifficulty =
  | 'Trung bình'
  | 'Thử thách'
  | 'Chuyên sâu';

type SortMode =
  | 'soonest'
  | 'lowest-price'
  | 'fewest-slots';

type GroupTrip = {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  difficulty: TripDifficulty;
  distance: string;
  elevation: string;
  leaderName: string;
  leaderAvatarUrl: string;
  leaderRating: string;
  leaderLevel: string;
  startAt: string;
  dateLabel: string;
  duration: string;
  joined: number;
  capacity: number;
  price: number;
  included: string;
  urgent?: boolean;
};

const demoTrips: GroupTrip[] = [
  {
    id: 'trip_ta_nang_group',
    name:
      'Chinh Phục Sống Lưng Khủng Long Tà Năng – Phan Dũng',
    location: 'Lâm Đồng — Bình Thuận',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
    difficulty: 'Thử thách',
    distance: '32 km đi bộ',
    elevation: 'Độ cao: 1.100m',
    leaderName: 'Trần Hoàng Nam',
    leaderAvatarUrl:
      'https://i.pravatar.cc/160?img=12',
    leaderRating: '4.9/5 (38 chuyến)',
    leaderLevel: 'VFRS L2 Leader',
    startAt: '2026-11-15',
    dateLabel: '15/11 - 17/11/2026',
    duration: '3N2Đ',
    joined: 11,
    capacity: 14,
    price: 3250000,
    included:
      'Porter, lều và bảo hiểm SAR',
    urgent: true,
  },
  {
    id: 'trip_lao_than_cloud',
    name:
      'Săn Mây Đỉnh Lảo Thẩn – Y Tý Mùa Lúa Vàng',
    location: 'Bát Xát, Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
    difficulty: 'Trung bình',
    distance: '16 km đường mòn',
    elevation: 'Độ cao: 2.860m',
    leaderName: 'Nguyễn Việt Cường',
    leaderAvatarUrl:
      'https://i.pravatar.cc/160?img=33',
    leaderRating: '5.0 (24 chuyến)',
    leaderLevel: 'VFRS L1 Leader',
    startAt: '2026-11-23',
    dateLabel: '23/11 - 24/11/2026',
    duration: '2N1Đ',
    joined: 6,
    capacity: 12,
    price: 2100000,
    included:
      'Xe đưa đón Sa Pa và lán gỗ',
  },
  {
    id: 'trip_ky_quan_san',
    name:
      'Chinh Phục Đỉnh Kỳ Quan San – Cột Mốc 3.046m',
    location: 'Lai Châu — Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85',
    difficulty: 'Chuyên sâu',
    distance: '30 km dốc gắt',
    elevation: 'Độ cao: 3.046m',
    leaderName: 'Lê Bảo Long',
    leaderAvatarUrl:
      'https://i.pravatar.cc/160?img=52',
    leaderRating: '4.9/5 (52 chuyến)',
    leaderLevel: 'VFRS L3 Master',
    startAt: '2026-12-05',
    dateLabel: '05/12 - 08/12/2026',
    duration: '4N3Đ',
    joined: 8,
    capacity: 10,
    price: 4500000,
    included:
      'Thiết bị an toàn và trạm tiếp nước',
    urgent: true,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    'vi-VN',
  ).format(value);
}

function difficultyColor(
  difficulty: TripDifficulty,
) {
  if (difficulty === 'Chuyên sâu') {
    return '#9F1239';
  }

  if (difficulty === 'Thử thách') {
    return '#B45309';
  }

  return '#166534';
}

type TripCardProps = {
  trip: GroupTrip;
  saved: boolean;
  onToggleSaved: () => void;
};

function TripCard({
  trip,
  saved,
  onToggleSaved,
}: TripCardProps) {
  const router = useRouter();
  const theme = useTheme();

  const remaining =
    trip.capacity - trip.joined;

  const progress =
    trip.joined / trip.capacity;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            theme.surfaceElevated,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={trip.imageUrl}
          contentFit="cover"
          style={styles.tripImage}
        />

        <View
          style={[
            styles.difficultyBadge,
            {
              backgroundColor:
                difficultyColor(
                  trip.difficulty,
                ),
            },
          ]}
        >
          <ThemedText style={styles.badgeText}>
            VFRS ·{' '}
            {trip.difficulty.toUpperCase()}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? 'Bỏ lưu chuyến đi'
              : 'Lưu chuyến đi'
          }
          onPress={onToggleSaved}
          style={({ pressed }) => [
            styles.saveButton,
            saved &&
              styles.saveButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <AppSymbol
            name={{
              ios: saved
                ? 'bookmark.fill'
                : 'bookmark',
              android: saved
                ? 'bookmark'
                : 'bookmark_border',
              web: saved
                ? 'bookmark'
                : 'bookmark_border',
            }}
            color="#FFFFFF"
            size={21}
          />
        </Pressable>

        <View style={styles.imageMetrics}>
          <View style={styles.metricBadge}>
            <ThemedText
              style={styles.metricText}
            >
              🥾 {trip.distance}
            </ThemedText>
          </View>

          <View style={styles.metricBadge}>
            <ThemedText
              style={styles.metricText}
            >
              ↕ {trip.elevation}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <ThemedText style={styles.tripName}>
          {trip.name}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.location}
        >
          📍 {trip.location}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem hồ sơ ${trip.leaderName}`}
          onPress={() =>
            Alert.alert(
              'Hồ sơ Leader',
              `${trip.leaderName}\n${trip.leaderRating}\n${trip.leaderLevel}`,
            )
          }
          style={[
            styles.leaderRow,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <Image
            source={trip.leaderAvatarUrl}
            contentFit="cover"
            style={styles.leaderAvatar}
          />

          <View style={styles.flexOne}>
            <View
              style={styles.leaderNameRow}
            >
              <ThemedText
                style={styles.leaderName}
                numberOfLines={1}
              >
                {trip.leaderName}
              </ThemedText>

              <ThemedText
                style={styles.verified}
              >
                ✓
              </ThemedText>
            </View>

            <ThemedText
              style={styles.leaderMeta}
              themeColor="textSecondary"
            >
              ★ {trip.leaderRating}
              {'   '}
              {trip.leaderLevel}
            </ThemedText>
          </View>

          <ThemedText
            style={styles.chevron}
          >
            ›
          </ThemedText>
        </Pressable>

        <View style={styles.scheduleRow}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            🗓 Lịch trình dự kiến
          </ThemedText>

          <ThemedText
            style={styles.scheduleValue}
          >
            {trip.dateLabel}{' '}
            ({trip.duration})
          </ThemedText>
        </View>

        <View
          style={styles.capacityLabels}
        >
          <ThemedText
            style={[
              styles.remainingText,
              trip.urgent && {
                color: theme.danger,
              },
            ]}
          >
            {trip.urgent
              ? `⚠ Chỉ còn ${remaining}/${trip.capacity} chỗ trống!`
              : `♟ Còn ${remaining}/${trip.capacity} chỗ trống`}
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Đã ghép: {trip.joined} thành viên
          </ThemedText>
        </View>

        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  progress * 100,
                  100,
                )}%`,
                backgroundColor:
                  trip.urgent
                    ? theme.danger
                    : theme.primary,
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.divider,
            {
              backgroundColor:
                theme.border,
            },
          ]}
        />

        <View style={styles.footerRow}>
          <View style={styles.priceBlock}>
            <ThemedText
              style={styles.priceCaption}
              themeColor="textSecondary"
            >
              Chi phí trọn gói
            </ThemedText>

            <View style={styles.priceRow}>
              <ThemedText
                style={[
                  styles.price,
                  {
                    color:
                      theme.primary,
                  },
                ]}
              >
                {formatCurrency(
                  trip.price,
                )}
                đ
              </ThemedText>

              <ThemedText
                style={styles.perPerson}
                themeColor="textSecondary"
              >
                /người
              </ThemedText>
            </View>

            <ThemedText
              style={styles.included}
              themeColor="textSecondary"
              numberOfLines={1}
            >
              Bao gồm {trip.included}
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem chi tiết ${trip.name}`}
            onPress={() =>
              router.push({
                pathname: '/trips/[id]',
                params: {
                  id: trip.id,
                },
              })
            }
            style={({ pressed }) => [
              styles.detailButton,
              {
                backgroundColor:
                  theme.primaryDark,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={
                styles.detailButtonText
              }
            >
              CHI TIẾT →
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function GroupTripsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [search, setSearch] =
    useState('');

  const [
    destination,
    setDestination,
  ] = useState('Tất cả');

  const [sortMode, setSortMode] =
    useState<SortMode>('soonest');

  const [
    savedTripIds,
    setSavedTripIds,
  ] = useState<string[]>([]);

  const visibleTrips = useMemo(() => {
    const keyword = search
      .trim()
      .toLocaleLowerCase('vi');

    const filtered = demoTrips.filter(
      (trip) => {
        const matchesSearch =
          keyword.length === 0 ||
          `${trip.name} ${trip.location}`
            .toLocaleLowerCase('vi')
            .includes(keyword);

        const matchesDestination =
          destination === 'Tất cả' ||
          trip.location.includes(
            destination,
          );

        return (
          matchesSearch &&
          matchesDestination
        );
      },
    );

    return [...filtered].sort(
      (first, second) => {
        if (
          sortMode ===
          'lowest-price'
        ) {
          return (
            first.price -
            second.price
          );
        }

        if (
          sortMode ===
          'fewest-slots'
        ) {
          const firstRemaining =
            first.capacity -
            first.joined;

          const secondRemaining =
            second.capacity -
            second.joined;

          return (
            firstRemaining -
            secondRemaining
          );
        }

        return (
          new Date(
            first.startAt,
          ).getTime() -
          new Date(
            second.startAt,
          ).getTime()
        );
      },
    );
  }, [
    destination,
    search,
    sortMode,
  ]);

  const sortLabel =
    sortMode === 'lowest-price'
      ? 'Giá thấp nhất'
      : sortMode === 'fewest-slots'
        ? 'Sắp hết chỗ'
        : 'Khởi hành gần nhất';

  function openSortMenu() {
    Alert.alert(
      'Sắp xếp chuyến đi',
      'Chọn cách hiển thị danh sách.',
      [
        {
          text:
            'Khởi hành gần nhất',
          onPress: () =>
            setSortMode(
              'soonest',
            ),
        },
        {
          text: 'Giá thấp nhất',
          onPress: () =>
            setSortMode(
              'lowest-price',
            ),
        },
        {
          text: 'Sắp hết chỗ',
          onPress: () =>
            setSortMode(
              'fewest-slots',
            ),
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ],
    );
  }

  function toggleSaved(
    tripId: string,
    tripName: string,
  ) {
    const alreadySaved =
      savedTripIds.includes(tripId);

    setSavedTripIds((current) =>
      alreadySaved
        ? current.filter(
            (id) => id !== tripId,
          )
        : [...current, tripId],
    );

    Alert.alert(
      alreadySaved
        ? 'Đã bỏ lưu'
        : 'Đã lưu chuyến đi',
      alreadySaved
        ? `Đã bỏ “${tripName}” khỏi danh sách đã lưu.`
        : `Đã thêm “${tripName}” vào danh sách đã lưu.`,
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={[
            styles.topBar,
            {
              backgroundColor:
                theme.surfaceElevated,
              borderBottomColor:
                theme.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={12}
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <AppSymbol
              name={{
                ios: 'chevron.left',
                android:
                  'arrow_back',
                web: 'arrow_back',
              }}
              color={theme.text}
              size={23}
            />
          </Pressable>

          <ThemedText
            style={styles.headerTitle}
          >
            Chuyến đi
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Các chuyến đã lưu"
            onPress={() =>
              Alert.alert(
                'Chuyến đã lưu',
                savedTripIds.length >
                  0
                  ? `Bạn đang lưu ${savedTripIds.length} chuyến đi.`
                  : 'Bạn chưa lưu chuyến đi nào.',
              )
            }
            style={({ pressed }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <AppSymbol
              name={{
                ios:
                  'bookmark.fill',
                android:
                  'bookmark',
                web: 'bookmark',
              }}
              color={
                savedTripIds.length >
                0
                  ? '#F4A261'
                  : theme.text
              }
              size={21}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor:
                  theme.surfaceElevated,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios:
                  'magnifyingglass',
                android: 'search',
                web: 'search',
              }}
              color={
                theme.textSecondary
              }
              size={20}
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm tên đỉnh núi, cung đường hoặc địa điểm"
              placeholderTextColor={
                theme.textSecondary
              }
              style={[
                styles.searchInput,
                {
                  color:
                    theme.text,
                },
              ]}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở bộ lọc"
              onPress={() =>
                Alert.alert(
                  'Bộ lọc',
                  'Các bộ lọc khu vực đang nằm ngay phía dưới.',
                )
              }
              hitSlop={8}
            >
              <AppSymbol
                name={{
                  ios:
                    'slider.horizontal.3',
                  android: 'tune',
                  web: 'tune',
                }}
                color={theme.primary}
                size={21}
              />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filterRow
            }
          >
            {[
              'Tất cả',
              'Lào Cai',
              'Lâm Đồng',
              'Lai Châu',
            ].map((item) => {
              const selected =
                destination === item;

              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected,
                  }}
                  onPress={() =>
                    setDestination(
                      item,
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.filterChip,
                    {
                      backgroundColor:
                        selected
                          ? theme.primary
                          : theme.surfaceElevated,
                      borderColor:
                        selected
                          ? theme.primary
                          : theme.border,
                    },
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.filterText,
                      selected &&
                        styles.filterTextSelected,
                    ]}
                  >
                    {item ===
                    'Tất cả'
                      ? 'Khu vực: Tất cả'
                      : item}
                  </ThemedText>
                </Pressable>
              );
            })}

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  'Khởi hành',
                  'Đang chọn tháng 11 và tháng 12/2026.',
                )
              }
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    theme.primary,
                  borderColor:
                    theme.primary,
                },
              ]}
            >
              <ThemedText
                style={
                  styles.filterTextSelected
                }
              >
                🗓 Cuối năm 2026
              </ThemedText>
            </Pressable>
          </ScrollView>

          <View style={styles.resultRow}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Tìm thấy{' '}
              <ThemedText
                style={
                  styles.resultCount
                }
              >
                {visibleTrips.length}
              </ThemedText>{' '}
              chuyến đi khả dụng
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sắp xếp chuyến đi"
              onPress={openSortMenu}
            >
              <ThemedText
                type="small"
                style={{
                  color:
                    theme.primary,
                }}
              >
                ⇅ {sortLabel}
              </ThemedText>
            </Pressable>
          </View>

          {visibleTrips.map(
            (trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                saved={savedTripIds.includes(
                  trip.id,
                )}
                onToggleSaved={() =>
                  toggleSaved(
                    trip.id,
                    trip.name,
                  )
                }
              />
            ),
          )}

          {visibleTrips.length ===
          0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor:
                    theme.surfaceElevated,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <ThemedText
                style={styles.emptyIcon}
              >
                🥾
              </ThemedText>

              <ThemedText
                style={
                  styles.emptyTitle
                }
              >
                Chưa tìm thấy chuyến phù hợp
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={
                  styles.emptyDescription
                }
              >
                Hãy thử đổi khu vực hoặc từ khóa tìm kiếm.
              </ThemedText>
            </View>
          ) : null}

          <View
            style={[
              styles.safetyCard,
              {
                backgroundColor:
                  theme.primarySurface,
              },
            ]}
          >
            <View
              style={[
                styles.safetyIcon,
                {
                  backgroundColor:
                    theme.surfaceElevated,
                },
              ]}
            >
              <ThemedText
                style={
                  styles.safetyEmoji
                }
              >
                🛡
              </ThemedText>
            </View>

            <View style={styles.flexOne}>
              <ThemedText
                style={
                  styles.safetyTitle
                }
              >
                Cam Kết Ghép Đoàn An Toàn VFRS
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={
                  styles.safetyDescription
                }
              >
                Các chuyến thương mại đều được dẫn dắt bởi
                Mountain Leader sở hữu chứng chỉ VFRS hợp
                chuẩn, trang bị GPS định vị vệ tinh và bảo
                hiểm cứu hộ trực thăng.
              </ThemedText>
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

  flexOne: {
    flex: 1,
  },

  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal:
      Spacing.three,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },

  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },

  scrollContent: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom:
      Spacing.five,
  },

  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal:
      Spacing.three,
    borderWidth: 1,
    borderRadius:
      Radius.large,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
  },

  filterRow: {
    gap: Spacing.two,
    paddingRight:
      Spacing.three,
  },

  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal:
      Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },

  filterTextSelected: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: Spacing.two,
  },

  resultCount: {
    fontWeight: '900',
  },

  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius:
      Radius.large,
  },

  imageContainer: {
    height: 205,
    position: 'relative',
  },

  tripImage: {
    width: '100%',
    height: '100%',
  },

  difficultyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius:
      Radius.medium,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius:
      Radius.medium,
    backgroundColor:
      'rgba(8, 28, 21, 0.72)',
  },

  saveButtonActive: {
    backgroundColor: '#F4A261',
  },

  imageMetrics: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    gap: Spacing.two,
  },

  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius:
      Radius.medium,
    backgroundColor:
      'rgba(255,255,255,0.92)',
  },

  metricText: {
    color: '#17231B',
    fontSize: 10,
    fontWeight: '800',
  },

  cardBody: {
    gap: Spacing.two,
    padding: Spacing.three,
  },

  tripName: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },

  location: {
    marginTop: -4,
  },

  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius:
      Radius.medium,
  },

  leaderAvatar: {
    width: 42,
    height: 42,
    borderRadius:
      Radius.medium,
  },

  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  leaderName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
  },

  verified: {
    color: '#2A9D8F',
    fontSize: 15,
    fontWeight: '900',
  },

  leaderMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },

  chevron: {
    fontSize: 25,
    fontWeight: '500',
  },

  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: Spacing.two,
  },

  scheduleValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '800',
  },

  capacityLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: Spacing.two,
  },

  remainingText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
  },

  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: Radius.pill,
  },

  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },

  divider: {
    height:
      StyleSheet.hairlineWidth,
    marginVertical: 2,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  priceBlock: {
    flex: 1,
  },

  priceCaption: {
    fontSize: 10,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },

  price: {
    fontSize: 20,
    fontWeight: '900',
  },

  perPerson: {
    fontSize: 10,
  },

  included: {
    marginTop: 2,
    fontSize: 9,
  },

  detailButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal:
      Spacing.three,
    borderRadius:
      Radius.medium,
  },

  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderWidth: 1,
    borderRadius:
      Radius.large,
  },

  emptyIcon: {
    fontSize: 34,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },

  emptyDescription: {
    textAlign: 'center',
  },

  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius:
      Radius.large,
  },

  safetyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius:
      Radius.medium,
  },

  safetyEmoji: {
    fontSize: 22,
  },

  safetyTitle: {
    fontSize: 13,
    fontWeight: '900',
  },

  safetyDescription: {
    marginTop: 4,
    lineHeight: 17,
  },

  pressed: {
    opacity: 0.72,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },
});