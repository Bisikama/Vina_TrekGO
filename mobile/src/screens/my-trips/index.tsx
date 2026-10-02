import { Image } from 'expo-image';
import {
  type Href,
  useRouter,
} from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TripStatus =
  | 'upcoming'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

type TripFilter = 'all' | TripStatus;

type TripParticipant = {
  id: string;
  avatarUrl: string;
};

type TrekkerTrip = {
  id: string;
  trailId: string;
  name: string;
  location: string;
  dateLabel: string;
  timeLabel: string;
  status: TripStatus;
  statusLabel: string;
  imageUrl: string;
  leaderName: string;
  participantCount: number;
  capacity: number;
  progressLabel: string;
  participants: TripParticipant[];
};

type FilterOption = {
  id: TripFilter;
  label: string;
};

const filters: FilterOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'upcoming', label: 'Sắp tới' },
  { id: 'in-progress', label: 'Đang đi' },
  { id: 'completed', label: 'Hoàn thành' },
  { id: 'cancelled', label: 'Đã hủy' },
];

const demoTrips: TrekkerTrip[] = [
  {
    id: 'trip_fansipan_oct',
    trailId: 'trail_fansipan',
    name: 'Fansipan – Nóc nhà Đông Dương',
    location: 'Sa Pa, Lào Cai',
    dateLabel: '10 – 12 Thg 10, 2026',
    timeLabel: 'Khởi hành sau 10 ngày',
    status: 'upcoming',
    statusLabel: 'Sắp tới',
    imageUrl:
      'https://images.unsplash.com/photo-1606768666853-403c90a981ad?auto=format&fit=crop&w=1200&q=85',
    leaderName: 'Hoàng Nam',
    participantCount: 8,
    capacity: 12,
    progressLabel: 'Đã hoàn tất thanh toán',
    participants: [
      {
        id: 'p1',
        avatarUrl:
          'https://i.pravatar.cc/120?img=12',
      },
      {
        id: 'p2',
        avatarUrl:
          'https://i.pravatar.cc/120?img=32',
      },
      {
        id: 'p3',
        avatarUrl:
          'https://i.pravatar.cc/120?img=47',
      },
    ],
  },
  {
    id: 'trip_lao_than_live',
    trailId: 'trail_lao_than',
    name: 'Săn mây Lảo Thẩn',
    location: 'Y Tý, Lào Cai',
    dateLabel: '30 Thg 9 – 02 Thg 10, 2026',
    timeLabel: 'Ngày 1 / 3',
    status: 'in-progress',
    statusLabel: 'Đang diễn ra',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
    leaderName: 'Minh Quân',
    participantCount: 10,
    capacity: 10,
    progressLabel:
      'Đã check-in tại điểm tập trung',
    participants: [
      {
        id: 'p4',
        avatarUrl:
          'https://i.pravatar.cc/120?img=5',
      },
      {
        id: 'p5',
        avatarUrl:
          'https://i.pravatar.cc/120?img=15',
      },
      {
        id: 'p6',
        avatarUrl:
          'https://i.pravatar.cc/120?img=25',
      },
    ],
  },
  {
    id: 'trip_ta_nang_aug',
    trailId: 'ta-nang-phan-dung',
    name: 'Tà Năng – Phan Dũng',
    location: 'Lâm Đồng – Bình Thuận',
    dateLabel: '16 – 18 Thg 8, 2026',
    timeLabel: '3 ngày 2 đêm',
    status: 'completed',
    statusLabel: 'Hoàn thành',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
    leaderName: 'Thu Hà',
    participantCount: 12,
    capacity: 12,
    progressLabel:
      'Chờ bạn đánh giá chuyến đi',
    participants: [
      {
        id: 'p7',
        avatarUrl:
          'https://i.pravatar.cc/120?img=10',
      },
      {
        id: 'p8',
        avatarUrl:
          'https://i.pravatar.cc/120?img=20',
      },
      {
        id: 'p9',
        avatarUrl:
          'https://i.pravatar.cc/120?img=30',
      },
    ],
  },
  {
    id: 'trip_bach_moc_cancelled',
    trailId: 'trail_bach_moc',
    name: 'Bạch Mộc Lương Tử',
    location: 'Bát Xát, Lào Cai',
    dateLabel: '22 – 24 Thg 7, 2026',
    timeLabel: 'Đã hoàn tiền',
    status: 'cancelled',
    statusLabel: 'Đã hủy',
    imageUrl:
      'https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=1200&q=85',
    leaderName: 'Quốc Bảo',
    participantCount: 7,
    capacity: 10,
    progressLabel:
      'Hủy do điều kiện thời tiết',
    participants: [
      {
        id: 'p10',
        avatarUrl:
          'https://i.pravatar.cc/120?img=11',
      },
      {
        id: 'p11',
        avatarUrl:
          'https://i.pravatar.cc/120?img=21',
      },
      {
        id: 'p12',
        avatarUrl:
          'https://i.pravatar.cc/120?img=31',
      },
    ],
  },
];

function getStatusIcon(
  status: TripStatus,
): SymbolViewProps['name'] {
  if (status === 'in-progress') {
    return {
      ios: 'location.fill',
      android: 'near_me',
      web: 'near_me',
    };
  }

  if (status === 'completed') {
    return {
      ios: 'checkmark.circle.fill',
      android: 'check_circle',
      web: 'check_circle',
    };
  }

  if (status === 'cancelled') {
    return {
      ios: 'xmark.circle.fill',
      android: 'cancel',
      web: 'cancel',
    };
  }

  return {
    ios: 'calendar',
    android: 'calendar_month',
    web: 'calendar_month',
  };
}

type HeaderProps = {
  search: string;
  onChangeSearch: (value: string) => void;
};

function Header({
  search,
  onChangeSearch,
}: HeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <View style={styles.flexOne}>
          <ThemedText
            style={styles.eyebrow}
            themeColor="primary"
          >
            HÀNH TRÌNH CỦA BẠN
          </ThemedText>

          <ThemedText style={styles.title}>
            Chuyến đi của tôi
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Theo dõi lịch trình, chuẩn bị và lịch sử
            trekking.
          </ThemedText>
        </View>

        <View
          style={[
            styles.headerBadge,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <AppSymbol
            name={{
              ios: 'figure.hiking',
              android: 'hiking',
              web: 'hiking',
            }}
            color={theme.primary}
            size={25}
          />
        </View>
      </View>

      <View
        style={[
          styles.searchBox,
          {
            backgroundColor:
              theme.surfaceElevated,
            borderColor: theme.border,
          },
        ]}
      >
        <AppSymbol
          name={{
            ios: 'magnifyingglass',
            android: 'search',
            web: 'search',
          }}
          color={theme.textSecondary}
          size={20}
        />

        <TextInput
          accessibilityLabel="Tìm chuyến đi"
          placeholder="Tìm theo tên hoặc địa điểm"
          placeholderTextColor={
            theme.textSecondary
          }
          value={search}
          onChangeText={onChangeSearch}
          style={[
            styles.searchInput,
            { color: theme.text },
          ]}
        />

        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa tìm kiếm"
            hitSlop={10}
            onPress={() => onChangeSearch('')}
          >
            <AppSymbol
              name={{
                ios: 'xmark.circle.fill',
                android: 'cancel',
                web: 'cancel',
              }}
              color={theme.textSecondary}
              size={19}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type FilterBarProps = {
  selected: TripFilter;
  onSelect: (filter: TripFilter) => void;
};

function FilterBar({
  selected,
  onSelect,
}: FilterBarProps) {
  const theme = useTheme();

  return (
    <FlatList
      horizontal
      data={filters}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        styles.filterContent
      }
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => {
        const active = item.id === selected;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected: active,
            }}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.filterChip,
              {
                backgroundColor: active
                  ? theme.primary
                  : theme.surfaceElevated,
                borderColor: active
                  ? theme.primary
                  : theme.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{
                color: active
                  ? theme.onPrimary
                  : theme.textSecondary,
              }}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      }}
    />
  );
}

function ParticipantStack({
  trip,
}: {
  trip: TrekkerTrip;
}) {
  const theme = useTheme();

  const remaining = Math.max(
    0,
    trip.participantCount -
      trip.participants.length,
  );

  return (
    <View style={styles.participantRow}>
      <View style={styles.avatarStack}>
        {trip.participants.map(
          (participant, index) => (
            <Image
              key={participant.id}
              source={{
                uri: participant.avatarUrl,
              }}
              style={[
                styles.avatar,
                {
                  borderColor:
                    theme.surfaceElevated,
                  marginLeft:
                    index === 0 ? 0 : -9,
                },
              ]}
            />
          ),
        )}

        {remaining > 0 ? (
          <View
            style={[
              styles.avatarMore,
              {
                backgroundColor:
                  theme.backgroundElement,
                borderColor:
                  theme.surfaceElevated,
              },
            ]}
          >
            <ThemedText
              style={styles.avatarMoreText}
            >
              +{remaining}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText
        type="small"
        themeColor="textSecondary"
      >
        {trip.participantCount}/{trip.capacity}{' '}
        thành viên
      </ThemedText>
    </View>
  );
}

function TripCard({
  trip,
}: {
  trip: TrekkerTrip;
}) {
  const router = useRouter();
  const theme = useTheme();

  const statusTone =
    trip.status === 'cancelled'
      ? {
          background: theme.dangerSurface,
          color: theme.danger,
        }
      : trip.status === 'completed'
        ? {
            background: theme.successSurface,
            color: theme.success,
          }
        : trip.status === 'in-progress'
          ? {
              background: theme.tealSurface,
              color: theme.teal,
            }
          : {
              background:
                theme.warningSurface,
              color: theme.warning,
            };

 function handlePrimaryAction() {
  if (trip.status === 'upcoming') {
    router.push({
      pathname: '/trips/[id]',
      params: {
        id: trip.id,
      },
    });

    return;
  }

  if (trip.status === 'in-progress') {
    router.push({
      pathname: '/trails/[id]',
      params: {
        id: trip.trailId,
      },
    });

    return;
  }

 if (trip.status === 'completed') {
  router.push({
    pathname: '/trips/[id]/review',
    params: {
      id: trip.id,
    },
  } as unknown as Href);

  return;
}

  Alert.alert(
    'Chi tiết hoàn tiền',
    'Hoàn tiền thành công • 2.450.000 ₫ • 25/07/2026',
  );
}

  const actionLabel =
    trip.status === 'in-progress'
      ? 'Mở bản đồ hành trình'
      : trip.status === 'completed'
        ? 'Đánh giá chuyến đi'
        : trip.status === 'cancelled'
          ? 'Xem hoàn tiền'
         : 'Xem chi tiết chuyến đi';

  return (
    <ThemedView
      type="surfaceElevated"
      style={[
        styles.card,
        {
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: trip.imageUrl }}
          contentFit="cover"
          style={styles.heroImage}
        />

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                statusTone.background,
            },
          ]}
        >
          <AppSymbol
            name={getStatusIcon(trip.status)}
            color={statusTone.color}
            size={15}
          />

          <ThemedText
            type="smallBold"
            style={{
              color: statusTone.color,
            }}
          >
            {trip.statusLabel}
          </ThemedText>
        </View>
      </View>

      <View style={styles.cardBody}>
        <ThemedText style={styles.tripName}>
          {trip.name}
        </ThemedText>

        <View style={styles.metaRow}>
          <AppSymbol
            name={{
              ios: 'mappin.and.ellipse',
              android: 'location_on',
              web: 'location_on',
            }}
            color={theme.trailOrange}
            size={17}
          />

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.metaText}
          >
            {trip.location}
          </ThemedText>
        </View>

        <View style={styles.metaRow}>
          <AppSymbol
            name={{
              ios: 'calendar',
              android: 'calendar_month',
              web: 'calendar_month',
            }}
            color={theme.textSecondary}
            size={17}
          />

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.metaText}
          >
            {trip.dateLabel} • {trip.timeLabel}
          </ThemedText>
        </View>

        <View
          style={[
            styles.infoPanel,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <View style={styles.leaderRow}>
            <View
              style={[
                styles.leaderIcon,
                {
                  backgroundColor:
                    theme.primarySurface,
                },
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'person.fill',
                  android: 'person',
                  web: 'person',
                }}
                color={theme.primary}
                size={17}
              />
            </View>

            <View style={styles.flexOne}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Mountain Leader
              </ThemedText>

              <ThemedText type="smallBold">
                {trip.leaderName}
              </ThemedText>
            </View>

            <AppSymbol
              name={{
                ios: 'checkmark.seal.fill',
                android: 'verified',
                web: 'verified',
              }}
              color={theme.teal}
              size={19}
            />
          </View>

          <View
            style={[
              styles.divider,
              {
                backgroundColor: theme.border,
              },
            ]}
          />

          <ParticipantStack trip={trip} />
        </View>

        <View style={styles.progressRow}>
          <AppSymbol
            name={{
              ios: 'checkmark.circle',
              android: 'task_alt',
              web: 'task_alt',
            }}
            color={statusTone.color}
            size={18}
          />

          <ThemedText
            type="smallBold"
            style={[
              styles.flexOne,
              {
                color: statusTone.color,
              },
            ]}
          >
            {trip.progressLabel}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${trip.name}`}
          onPress={handlePrimaryAction}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor:
                trip.status === 'in-progress'
                  ? theme.teal
                  : theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{
              color: theme.onPrimary,
            }}
          >
            {actionLabel}
          </ThemedText>

          <AppSymbol
            name={{
              ios: 'chevron.right',
              android: 'chevron_right',
              web: 'chevron_right',
            }}
            color={theme.onPrimary}
            size={18}
          />
        </Pressable>
      </View>
    </ThemedView>
  );
}

function EmptyTrips({
  hasSearch,
}: {
  hasSearch: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor:
              theme.primarySurface,
          },
        ]}
      >
        <AppSymbol
          name={{
            ios: 'map.fill',
            android: 'map',
            web: 'map',
          }}
          color={theme.primary}
          size={32}
        />
      </View>

      <ThemedText style={styles.emptyTitle}>
        {hasSearch
          ? 'Không tìm thấy chuyến đi'
          : 'Chưa có chuyến ở mục này'}
      </ThemedText>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.emptyDescription}
      >
        {hasSearch
          ? 'Thử tìm bằng tên cung đường hoặc địa điểm khác.'
          : 'Các hành trình phù hợp sẽ xuất hiện tại đây.'}
      </ThemedText>
    </View>
  );
}

export function MyTripsScreen() {
  const theme = useTheme();

  const [filter, setFilter] =
    useState<TripFilter>('all');

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] =
    useState(false);

  const visibleTrips = useMemo(() => {
    const keyword = search
      .trim()
      .toLocaleLowerCase('vi');

    return demoTrips.filter((trip) => {
      const matchesFilter =
        filter === 'all' ||
        trip.status === filter;

      const matchesSearch =
        keyword.length === 0 ||
        `${trip.name} ${trip.location}`
          .toLocaleLowerCase('vi')
          .includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  function refresh() {
    setRefreshing(true);

    setTimeout(() => {
      setRefreshing(false);
    }, 650);
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <FlatList
        data={visibleTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard trip={item} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          visibleTrips.length === 0 &&
            styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <Header
              search={search}
              onChangeSearch={setSearch}
            />

            <FilterBar
              selected={filter}
              onSelect={setFilter}
            />

            <View style={styles.resultRow}>
              <ThemedText type="smallBold">
                {visibleTrips.length} chuyến đi
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Kéo xuống để làm mới
              </ThemedText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyTrips
            hasSearch={
              search.trim().length > 0
            }
          />
        }
        ItemSeparatorComponent={() => (
          <View style={styles.cardSeparator} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom:
      BottomTabInset + Spacing.five,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  headerTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    lineHeight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
  },
  headerBadge: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 48,
  },
  filterContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  filterChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: 1,
    marginHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  cardSeparator: {
    height: Spacing.three,
  },
  heroWrap: {
    height: 178,
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    flexDirection: 'row',
    gap: 5,
    left: Spacing.three,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: Spacing.three,
  },
  cardBody: {
    gap: 10,
    padding: Spacing.three,
  },
  tripName: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metaText: {
    flex: 1,
  },
  infoPanel: {
    borderRadius: Radius.medium,
    gap: 10,
    marginTop: 2,
    padding: 12,
  },
  leaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  leaderIcon: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  flexOne: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  participantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avatarStack: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: 31,
    width: 31,
  },
  avatarMore: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: 31,
    justifyContent: 'center',
    marginLeft: -9,
    width: 31,
  },
  avatarMoreText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 64,
    justifyContent: 'center',
    marginBottom: Spacing.three,
    width: 64,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  emptyDescription: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
});