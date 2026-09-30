import { Image } from 'expo-image';

import {
  useRouter,
} from 'expo-router';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  Radius,
  Spacing,
} from '@/constants/theme';

import { useTrekkerHome } from '@/features/home/hooks/use-trekker-home';

import type { TrekkerHomeData } from '@/features/home/types/trekker-home';

import { useSession } from '@/features/session/providers/session-provider';
import { useTheme } from '@/hooks/use-theme';

function Header() {
  const theme = useTheme();
  const { session } = useSession();

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View
          style={[
            styles.brandMark,
            {
              backgroundColor:
                theme.primaryDark,
            },
          ]}
        >
          <Text style={styles.brandLetter}>
            V
          </Text>
        </View>

        <View>
          <ThemedText
            style={styles.brandName}
          >
            VINA_TREKGO
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Trekker Trang Chủ
          </ThemedText>
        </View>
      </View>

      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          onPress={() =>
            Alert.alert(
              'Thông báo',
              'Bạn chưa có thông báo mới.',
            )
          }
          style={({ pressed }) => [
            styles.notificationButton,
            {
              backgroundColor:
                theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.headerEmoji}>
            🔔
          </Text>

          <View
            style={[
              styles.notificationDot,
              {
                backgroundColor:
                  theme.danger,
              },
            ]}
          />
        </Pressable>

        <Image
          source={
            session?.user.avatarUrl
          }
          style={[
            styles.avatar,
            {
              borderColor:
                theme.primary,
            },
          ]}
          contentFit="cover"
        />
      </View>
    </View>
  );
}

function StatusRow({
  data,
}: {
  data: TrekkerHomeData;
}) {
  const theme = useTheme();
  const { session } = useSession();

  return (
    <View style={styles.statusRow}>
      <View
        style={[
          styles.statusChip,
          {
            backgroundColor:
              theme.primarySurface,
            borderColor:
              theme.primaryMuted,
          },
        ]}
      >
        <ThemedText
          type="smallBold"
          themeColor="primary"
        >
          ✓ VFRS LEVEL{' '}
          {session?.vfrsLevel ?? 1}
        </ThemedText>
      </View>

      <View
        style={[
          styles.statusChip,
          {
            backgroundColor:
              theme.tealSurface,
            borderColor: theme.teal,
          },
        ]}
      >
        <View
          style={[
            styles.liveDot,
            {
              backgroundColor:
                theme.teal,
            },
          ]}
        />

        <ThemedText
          type="smallBold"
          style={{
            color: theme.teal,
          }}
        >
          GPS {data.condition.gpsStatus}
        </ThemedText>
      </View>

      <ThemedText
        type="smallBold"
        style={styles.weather}
      >
        ⛅ {data.condition.temperature}°C
      </ThemedText>
    </View>
  );
}

function TripHero({
  trip,
}: {
  trip: TrekkerHomeData['upcomingTrip'];
}) {
  const theme = useTheme();

  return (
    <View style={styles.hero}>
      <Image
        source={trip.imageUrl}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      <View style={styles.heroOverlay} />

      <View style={styles.heroContent}>
        <View style={styles.heroBadges}>
          <View
            style={[
              styles.heroBadge,
              {
                backgroundColor:
                  theme.primary,
              },
            ]}
          >
            <ThemedText
              style={styles.badgeText}
            >
              ĐÃ XÁC NHẬN
            </ThemedText>
          </View>

          <View
            style={[
              styles.heroBadge,
              {
                backgroundColor:
                  theme.trailOrange,
              },
            ]}
          >
            <ThemedText
              style={styles.badgeText}
            >
              {trip.startsIn}
            </ThemedText>
          </View>
        </View>

        <View style={styles.heroInformation}>
          <ThemedText
            style={styles.heroEyebrow}
          >
            CHUYẾN SẮP TỚI · {trip.code}
          </ThemedText>

          <ThemedText
            style={styles.heroTitle}
          >
            {trip.name}
          </ThemedText>

          <ThemedText
            style={styles.heroMeta}
          >
            {trip.schedule}
          </ThemedText>

          <ThemedText
            style={styles.heroMeta}
          >
            Leader {trip.leaderName}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function PreparationCards({
  data,
}: {
  data: TrekkerHomeData;
}) {
  const theme = useTheme();

  const progress =
    data.equipment.completed /
    data.equipment.total;

  return (
    <View style={styles.cardRow}>
      <Pressable
        onPress={() =>
          Alert.alert(
            'Checklist thiết bị',
            `Đã chuẩn bị ${data.equipment.completed}/${data.equipment.total} hạng mục.`,
          )
        }
        style={({ pressed }) => [
          styles.infoCard,
          {
            backgroundColor:
              theme.surfaceElevated,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold">
          🎒 TRANG BỊ
        </ThemedText>

        <ThemedText
          style={styles.metric}
        >
          {data.equipment.completed}/
          {data.equipment.total}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Checklist đã sẵn sàng
        </ThemedText>

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
              styles.progressValue,
              {
                backgroundColor:
                  theme.warning,
                width: `${progress * 100}%`,
              },
            ]}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert(
            'Đơn thuê',
            `${data.rentalOrder.id}\n${data.rentalOrder.statusLabel}`,
          )
        }
        style={({ pressed }) => [
          styles.infoCard,
          {
            backgroundColor:
              theme.surfaceElevated,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold">
          📦 ĐƠN THUÊ
        </ThemedText>

        <ThemedText
          style={styles.rentalStatus}
        >
          {data.rentalOrder.statusLabel}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          {data.rentalOrder.itemCount}{' '}
          món thiết bị
        </ThemedText>

        <ThemedText
          type="smallBold"
          style={{
            color: theme.teal,
          }}
        >
          {data.rentalOrder.id}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function QuickActions() {
  const router = useRouter();
  const theme = useTheme();

  const actions = [
    {
      label: 'Bản đồ',
      icon: '🗺️',
      color: theme.tealSurface,
      onPress: () =>
        router.push('/explore'),
    },
    {
      label: 'Tìm Tour',
      icon: '🔎',
      color:
        theme.trailOrangeSurface,
      onPress: () =>
        router.push('/explore'),
    },
    {
  label: 'Thuê đồ',
  icon: '🎒',
  color: theme.primarySurface,
  onPress: () =>
    router.push('/rentals'),
},
    {
      label: 'Trạm SOS',
      icon: '🆘',
      color: theme.dangerSurface,
      onPress: () =>
        router.push('/sos'),
    },
  ] as const;

  return (
    <View style={styles.quickActions}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={
            action.label
          }
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.quickAction,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.quickIcon,
              {
                backgroundColor:
                  action.color,
              },
            ]}
          >
            <Text style={styles.quickEmoji}>
              {action.icon}
            </Text>
          </View>

          <ThemedText
            type="smallBold"
            style={styles.quickLabel}
          >
            {action.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function TrailSection({
  trails,
}: {
  trails: TrekkerHomeData['trails'];
}) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View>
          <ThemedText
            style={styles.sectionTitle}
          >
            Cung đường VFRS
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Đã được cộng đồng xác thực
          </ThemedText>
        </View>

        <Pressable
          onPress={() =>
            router.push('/explore')
          }
        >
          <ThemedText
            type="smallBold"
            themeColor="primary"
          >
            Xem tất cả
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.trailRow
        }
      >
        {trails.map((trail) => (
          <Pressable
            key={trail.id}
            onPress={() =>
              router.push('/explore')
            }
            style={({ pressed }) => [
              styles.trailCard,
              {
                backgroundColor:
                  theme.surfaceElevated,
                borderColor:
                  theme.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={trail.imageUrl}
              style={styles.trailImage}
              contentFit="cover"
            />

            <View
              style={[
                styles.verifiedBadge,
                {
                  backgroundColor:
                    theme.primary,
                },
              ]}
            >
              <ThemedText
                style={styles.verifiedText}
              >
                VFRS VERIFIED
              </ThemedText>
            </View>

            <View
              style={styles.trailContent}
            >
              <ThemedText
                style={styles.trailName}
                numberOfLines={1}
              >
                {trail.name}
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                {trail.location} ·{' '}
                {trail.duration}
              </ThemedText>

              <View
                style={styles.trailFooter}
              >
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      theme.trailOrange,
                  }}
                >
                  {trail.difficulty}
                </ThemedText>

                <ThemedText type="smallBold">
                  ⭐ {trail.rating}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function TrekkerHomeScreen() {
  const theme = useTheme();
  const { session } = useSession();

  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    retry,
  } = useTrekkerHome();

  if (isLoading) {
    return (
      <ThemedView style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={theme.primary}
        />

        <ThemedText themeColor="textSecondary">
          Đang chuẩn bị hành trình…
        </ThemedText>
      </ThemedView>
    );
  }

  if (!data) {
    return (
      <ThemedView style={styles.centerState}>
        <ThemedText
          style={styles.errorTitle}
        >
          Chưa tải được trang chủ
        </ThemedText>

        <ThemedText
          themeColor="textSecondary"
          style={styles.centerText}
        >
          {error?.message ??
            'Vui lòng thử lại.'}
        </ThemedText>

        <Pressable
          onPress={retry}
          style={[
            styles.retryButton,
            {
              backgroundColor:
                theme.primary,
            },
          ]}
        >
          <ThemedText
            style={styles.retryText}
          >
            Thử lại
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

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
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={
            styles.content
          }
        >
          <Header />

          <View style={styles.greeting}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Xin chào,
            </ThemedText>

            <ThemedText
              style={styles.greetingName}
            >
              {session?.user.displayName ??
                'Trekker'}{' '}
              👋
            </ThemedText>
          </View>

          <StatusRow data={data} />

          <TripHero
            trip={data.upcomingTrip}
          />

          <PreparationCards data={data} />

          <Pressable
            onPress={() =>
              Alert.alert(
                'Vé QR đã sẵn sàng',
                `Mã chuyến: ${data.upcomingTrip.id}`,
              )
            }
            style={({ pressed }) => [
              styles.ticketButton,
              {
                backgroundColor:
                  theme.primaryDark,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.ticketIcon}>
              ▣
            </Text>

            <View style={styles.ticketText}>
              <ThemedText
                style={styles.ticketTitle}
              >
                Mở vé QR chuyến đi
              </ThemedText>

              <ThemedText
                style={styles.ticketSubtitle}
              >
                Check-in nhanh tại điểm
                tập trung
              </ThemedText>
            </View>

            <Text style={styles.ticketArrow}>
              ›
            </Text>
          </Pressable>

          <QuickActions />

          <TrailSection
            trails={data.trails}
          />

          <Pressable
            onPress={() =>
              Alert.alert(
                'Vina TrekGo Leader',
                'Chương trình ứng tuyển Leader sẽ được triển khai ở cụm tiếp theo.',
              )
            }
            style={[
              styles.leaderBanner,
              {
                backgroundColor:
                  theme.trailOrangeSurface,
                borderColor:
                  theme.trailOrange,
              },
            ]}
          >
            <Text style={styles.leaderEmoji}>
              🧗
            </Text>

            <View style={styles.leaderText}>
              <ThemedText
                type="smallBold"
                style={{
                  color:
                    theme.trailOrange,
                }}
              >
                TRỞ THÀNH LEADER
              </ThemedText>

              <ThemedText
                style={styles.leaderTitle}
              >
                Dẫn lối những hành trình
                an toàn
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Xem điều kiện và chương
                trình đào tạo.
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={() =>
              routerUnavailable()
            }
            style={[
              styles.sosBanner,
              {
                backgroundColor:
                  theme.danger,
              },
            ]}
          >
            <View style={styles.sosTextBlock}>
              <ThemedText
                style={styles.sosTitle}
              >
                CẦN HỖ TRỢ KHẨN CẤP?
              </ThemedText>

              <ThemedText
                style={styles.sosDescription}
              >
                Mở Trung tâm điều phối SOS.
              </ThemedText>
            </View>

            <View style={styles.sosCircle}>
              <ThemedText
                style={styles.sosCircleText}
              >
                SOS
              </ThemedText>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function routerUnavailable() {
  Alert.alert(
    'Trung tâm SOS',
    'Màn SOS sẽ được nối route ngay trong cụm tiếp theo.',
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandLetter: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },

  brandName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerEmoji: {
    fontSize: 18,
  },

  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
  },

  greeting: {
    gap: 1,
    marginTop: Spacing.one,
  },

  greetingName: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },

  statusChip: {
    minHeight: 31,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  weather: {
    marginLeft: 'auto',
  },

  hero: {
    height: 270,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },

  heroOverlay: {
    position: 'absolute',
top: 0,
right: 0,
bottom: 0,
left: 0,
    backgroundColor:
      'rgba(5,19,12,0.48)',
  },

  heroContent: {
    flex: 1,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },

  heroBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  heroBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },

  heroInformation: {
    gap: 5,
  },

  heroEyebrow: {
    color: '#D8F3DC',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
  },

  heroMeta: {
    color: '#F4F7F5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },

  cardRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  infoCard: {
    flex: 1,
    minHeight: 158,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: 13,
    gap: 7,
  },

  metric: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
  },

  rentalStatus: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },

  progressTrack: {
    height: 7,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginTop: 'auto',
  },

  progressValue: {
    height: '100%',
    borderRadius: Radius.pill,
  },

  ticketButton: {
    minHeight: 70,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  ticketIcon: {
    color: '#FFFFFF',
    fontSize: 30,
  },

  ticketText: {
    flex: 1,
  },

  ticketTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },

  ticketSubtitle: {
    color: '#CDE6D4',
    fontSize: 12,
    lineHeight: 16,
  },

  ticketArrow: {
    color: '#FFFFFF',
    fontSize: 28,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },

  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickEmoji: {
    fontSize: 23,
  },

  quickLabel: {
    fontSize: 11,
    textAlign: 'center',
  },

  section: {
    gap: Spacing.three,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },

  trailRow: {
    gap: Spacing.three,
    paddingRight: Spacing.three,
  },

  trailCard: {
    width: 268,
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },

  trailImage: {
    width: '100%',
    height: 132,
  },

  verifiedBadge: {
    position: 'absolute',
    top: 105,
    left: 12,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  verifiedText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },

  trailContent: {
    padding: 12,
    gap: 5,
  },

  trailName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },

  trailFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },

  leaderBanner: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  leaderEmoji: {
    fontSize: 32,
  },

  leaderText: {
    flex: 1,
    gap: 2,
  },

  leaderTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },

  sosBanner: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sosTextBlock: {
    flex: 1,
  },

  sosTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },

  sosDescription: {
    color: '#FFE4E1',
    fontSize: 12,
    lineHeight: 17,
  },

  sosCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sosCircleText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '900',
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },

  errorTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },

  centerText: {
    textAlign: 'center',
  },

  retryButton: {
    minHeight: 48,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  pressed: {
    opacity: 0.72,
  },
});