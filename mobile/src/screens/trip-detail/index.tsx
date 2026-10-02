import { Image } from 'expo-image';
import {
  type Href,
  useRouter,
} from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
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

type TripDetailScreenProps = {
  tripId: string;
};

type ItineraryDay = {
  id: string;
  day: string;
  date: string;
  route: string;
  distance: string;
  elevation: string;
  schedule: {
    time: string;
    title: string;
    note: string;
  }[];
};

const itinerary: ItineraryDay[] = [
  {
    id: 'day-1',
    day: 'N1',
    date: '18/11',
    route: 'Trạm Tôn → Lán 2.800 m',
    distance: '7,5 km',
    elevation: '+900 m',
    schedule: [
      {
        time: '05:30',
        title:
          'Tập trung tại Trạm Kiểm lâm Tôn Đức',
        note:
          'Kiểm tra trang bị, phổ biến an toàn và chia nhóm.',
      },
      {
        time: '07:00',
        title: 'Bắt đầu trekking',
        note:
          'Di chuyển qua rừng trúc và suối nhỏ.',
      },
    ],
  },
  {
    id: 'day-2',
    day: 'N2',
    date: '19/11',
    route:
      'Sống Lưng Trâu → Đỉnh Fansipan',
    distance: '6,0 km',
    elevation: '+1.343 m',
    schedule: [
      {
        time: '04:30',
        title:
          'Thức giấc, ăn sáng bên mây bình minh',
        note:
          'Đèn pin đội đầu và áo ấm phải luôn sẵn sàng.',
      },
      {
        time: '07:00',
        title:
          'Chạm chóp inox 3.143 m',
        note:
          'Nghỉ 20 phút, chụp hình và kiểm tra sức khỏe.',
      },
      {
        time: '14:00',
        title:
          'Hạ sơn về lán 2.200 m',
        note:
          'Đoạn dốc cao cần bám dây và giữ khoảng cách an toàn.',
      },
    ],
  },
  {
    id: 'day-3',
    day: 'N3',
    date: '20/11',
    route:
      'Lán 2.200 m → Sa Pa → TP.HCM',
    distance: '7,0 km',
    elevation: '-1.400 m',
    schedule: [
      {
        time: '06:30',
        title:
          'Thu dọn lán và xuống núi',
        note:
          'Không để lại rác trên cung đường.',
      },
      {
        time: '14:30',
        title: 'Về đến Sa Pa',
        note:
          'Nhận hành lý, tổng kết hành trình và di chuyển về điểm trả.',
      },
    ],
  },
];

type SymbolName =
  Parameters<typeof AppSymbol>[0]['name'];

type IconButtonProps = {
  label: string;
  icon: SymbolName;
  onPress: () => void;
};

function IconButton({
  label,
  icon,
  onPress,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor:
            theme.surfaceElevated,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <AppSymbol
        name={icon}
        color={theme.text}
        size={20}
      />
    </Pressable>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  note: string;
  icon: SymbolName;
};

function MetricCard({
  label,
  value,
  note,
  icon,
}: MetricCardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="surfaceElevated"
      style={[
        styles.metricCard,
        {
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.metricHeader}>
        <ThemedText
          style={styles.metricLabel}
          themeColor="textSecondary"
        >
          {label}
        </ThemedText>

        <AppSymbol
          name={icon}
          color={theme.primary}
          size={17}
        />
      </View>

      <ThemedText style={styles.metricValue}>
        {value}
      </ThemedText>

      <ThemedText
        style={styles.metricNote}
        themeColor="textSecondary"
      >
        {note}
      </ThemedText>
    </ThemedView>
  );
}

function LeaderCard() {
  const theme = useTheme();

  return (
    <ThemedView
      type="surfaceElevated"
      style={[
        styles.sectionCard,
        {
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.sectionHeadingRow}>
        <View style={styles.headingWithIcon}>
          <AppSymbol
            name={{
              ios:
                'person.badge.shield.checkmark.fill',
              android: 'verified_user',
              web: 'verified_user',
            }}
            color={theme.primary}
            size={18}
          />

          <ThemedText
            style={styles.sectionEyebrow}
          >
            CHỈ HUY ĐOÀN
          </ThemedText>
        </View>

        <View
          style={[
            styles.verifiedBadge,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.verifiedText,
              {
                color: theme.primary,
              },
            ]}
          >
            VERIFIED LEADER
          </ThemedText>
        </View>
      </View>

      <View style={styles.leaderProfile}>
        <Image
          source={{
            uri:
              'https://i.pravatar.cc/180?img=12',
          }}
          style={styles.leaderAvatar}
        />

        <View style={styles.flexOne}>
          <ThemedText style={styles.leaderName}>
            Phan Anh Tuấn
          </ThemedText>

          <ThemedText
            style={[
              styles.leaderRole,
              {
                color: theme.teal,
              },
            ]}
          >
            VFRS CERTIFIED SENIOR MOUNTAIN LEADER
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            ⭐ 4.95 • 6 năm kinh nghiệm
          </ThemedText>
        </View>
      </View>

      <View
        style={[
          styles.leaderQuote,
          {
            backgroundColor:
              theme.primarySurface,
          },
        ]}
      >
        <AppSymbol
          name={{
            ios: 'shield.checkered',
            android: 'health_and_safety',
            web: 'health_and_safety',
          }}
          color={theme.primary}
          size={17}
        />

        <ThemedText
          type="small"
          style={styles.flexOne}
        >
          Trực thuộc Liên đoàn Dã ngoại &
          Trạm cứu hộ Fansipan.
        </ThemedText>
      </View>

      <View style={styles.leaderStats}>
        <View
          style={[
            styles.leaderStat,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <ThemedText
            style={styles.leaderStatValue}
          >
            52
          </ThemedText>

          <ThemedText
            style={styles.leaderStatLabel}
            themeColor="textSecondary"
          >
            CHUYẾN HOÀN THÀNH
          </ThemedText>
        </View>

        <View
          style={[
            styles.leaderStat,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <ThemedText
            style={styles.leaderStatValue}
          >
            100%
          </ThemedText>

          <ThemedText
            style={styles.leaderStatLabel}
            themeColor="textSecondary"
          >
            AN TOÀN TUYỆT ĐỐI
          </ThemedText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            'Nhắn tin Leader',
            'Đã mở cuộc trò chuyện demo với Phan Anh Tuấn.',
          )
        }
        style={({ pressed }) => [
          styles.outlineButton,
          {
            borderColor: theme.primary,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <AppSymbol
          name={{
            ios: 'message.fill',
            android: 'chat',
            web: 'chat',
          }}
          color={theme.primary}
          size={18}
        />

        <ThemedText
          type="smallBold"
          style={{
            color: theme.primary,
          }}
        >
          NHẮN TIN TƯ VẤN VỚI LEADER
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function ItinerarySection() {
  const theme = useTheme();

  const [expandedDays, setExpandedDays] =
    useState<string[]>(['day-2']);

  function toggleDay(dayId: string) {
    setExpandedDays((current) =>
      current.includes(dayId)
        ? current.filter(
            (id) => id !== dayId,
          )
        : [...current, dayId],
    );
  }

  function expandAllDays() {
    setExpandedDays(
      itinerary.map((item) => item.id),
    );
  }

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.flexOne}>
          <ThemedText
            style={styles.sectionTitle}
          >
            Lịch trình chi tiết
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Lộ trình đã kiểm định theo VFRS
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={expandAllDays}
        >
          <ThemedText
            type="smallBold"
            style={{
              color: theme.primary,
            }}
          >
            Mở tất cả
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.itineraryList}>
        {itinerary.map((item) => {
          const expanded =
            expandedDays.includes(item.id);

          return (
            <ThemedView
              key={item.id}
              type="surfaceElevated"
              style={[
                styles.dayCard,
                {
                  borderColor: theme.border,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded,
                }}
                onPress={() =>
                  toggleDay(item.id)
                }
                style={styles.dayHeader}
              >
                <View
                  style={[
                    styles.dayBadge,
                    {
                      backgroundColor:
                        item.id === 'day-2'
                          ? theme.trailOrange
                          : theme.primary,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{
                      color:
                        theme.onPrimary,
                    }}
                  >
                    {item.day}
                  </ThemedText>
                </View>

                <View style={styles.flexOne}>
                  <ThemedText
                    style={styles.dayMeta}
                    themeColor="textSecondary"
                  >
                    {item.date} •{' '}
                    {item.distance} •{' '}
                    {item.elevation}
                  </ThemedText>

                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                  >
                    {item.route}
                  </ThemedText>
                </View>

                <AppSymbol
                  name={{
                    ios: expanded
                      ? 'chevron.up'
                      : 'chevron.down',
                    android: expanded
                      ? 'expand_less'
                      : 'expand_more',
                    web: expanded
                      ? 'expand_less'
                      : 'expand_more',
                  }}
                  color={theme.textSecondary}
                  size={20}
                />
              </Pressable>

              {expanded ? (
                <View
                  style={[
                    styles.schedule,
                    {
                      borderTopColor:
                        theme.border,
                    },
                  ]}
                >
                  {item.schedule.map(
                    (entry) => (
                      <View
                        key={`${item.id}-${entry.time}`}
                        style={
                          styles.scheduleRow
                        }
                      >
                        <ThemedText
                          style={[
                            styles.scheduleTime,
                            {
                              color:
                                theme.primary,
                            },
                          ]}
                        >
                          {entry.time}
                        </ThemedText>

                        <View
                          style={styles.flexOne}
                        >
                          <ThemedText type="smallBold">
                            {entry.title}
                          </ThemedText>

                          <ThemedText
                            type="small"
                            themeColor="textSecondary"
                          >
                            {entry.note}
                          </ThemedText>
                        </View>
                      </View>
                    ),
                  )}
                </View>
              ) : null}
            </ThemedView>
          );
        })}
      </View>
    </View>
  );
}

function ServicesSection() {
  const router = useRouter();
  const theme = useTheme();

  const services = [
    'Vé vào Vườn Quốc gia Hoàng Liên và phí giám sát môi trường',
    'Bảo hiểm du lịch mạo hiểm hạn mức 200.000.000 ₫/người',
    'Chỗ nằm lán gỗ có nệm cách nhiệt và túi ngủ chuyên dụng chịu 0°C',
    'Đội Porter bản địa đã qua huấn luyện cứu hộ',
    '5 bữa chính và 2 bữa phụ năng lượng cao',
    'Túi cứu thương dã ngoại, máy đo SpO2 và bộ đàm vệ tinh',
  ];

  function openRentalCatalog() {
    router.push({
      pathname: '/trip-rentals',
      params: {
        bookingId: 'booking_001',
      },
    } as unknown as Href);
  }

  return (
    <View style={styles.sectionBlock}>
      <ThemedText style={styles.sectionTitle}>
        Dịch vụ & Trang bị dã ngoại
      </ThemedText>

      <ThemedView
        type="surfaceElevated"
        style={[
          styles.sectionCard,
          {
            borderColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.includedBanner,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <ThemedText type="smallBold">
            Đã bao gồm trọn gói
          </ThemedText>

          <ThemedText type="small">
            Trang bị bắt buộc • Cá nhân
          </ThemedText>
        </View>

        <View style={styles.serviceList}>
          {services.map((service) => (
            <View
              key={service}
              style={styles.serviceRow}
            >
              <AppSymbol
                name={{
                  ios:
                    'checkmark.circle.fill',
                  android:
                    'check_circle',
                  web: 'check_circle',
                }}
                color={theme.primary}
                size={18}
              />

              <ThemedText
                type="small"
                style={styles.flexOne}
              >
                {service}
              </ThemedText>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.rentalCallout,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <View
            style={[
              styles.rentalIcon,
              {
                backgroundColor:
                  theme.primary,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'backpack.fill',
                android: 'backpack',
                web: 'backpack',
              }}
              color={theme.onPrimary}
              size={21}
            />
          </View>

          <View style={styles.flexOne}>
            <ThemedText type="smallBold">
              Chưa có đủ đồ trang bị?
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Thuê trọn gói chuẩn an toàn
              Vina_TrekGo.
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem danh mục kho đồ thuê"
              onPress={openRentalCatalog}
            >
              <ThemedText
                type="smallBold"
                style={{
                  color: theme.primary,
                }}
              >
                XEM DANH MỤC KHO ĐỒ THUÊ →
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    </View>
  );
}

export function TripDetailScreen({
  tripId,
}: TripDetailScreenProps) {
  const router = useRouter();
  const theme = useTheme();

  const [bookmarked, setBookmarked] =
    useState(false);

  async function shareTrip() {
    await Share.share({
      message:
        `Tham gia hành trình Fansipan cùng Vina_TrekGo: ${tripId}`,
    });
  }

  function toggleBookmark() {
  const nextBookmarked = !bookmarked;

  setBookmarked(nextBookmarked);

  Alert.alert(
    nextBookmarked
      ? 'Đã lưu chuyến đi'
      : 'Đã bỏ lưu',
    nextBookmarked
      ? 'Chuyến Fansipan đã được thêm vào danh sách yêu thích.'
      : 'Chuyến Fansipan đã được xóa khỏi danh sách yêu thích.',
  );
}

 function openBooking() {
  router.push({
    pathname: '/bookings/review',
    params: {
      tripId,
    },
  });
}

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        edges={['top']}
        style={styles.safeTop}
      >
        <View
          style={[
            styles.topBar,
            {
              borderBottomColor:
                theme.border,
            },
          ]}
        >
          <IconButton
            label="Quay lại"
            icon={{
              ios: 'chevron.left',
              android: 'arrow_back',
              web: 'arrow_back',
            }}
            onPress={() => router.back()}
          />

          <View style={styles.topTitle}>
            <ThemedText
              style={styles.brandLabel}
            >
              Vina_TrekGo
            </ThemedText>

            <ThemedText type="smallBold">
              Trip Detail
            </ThemedText>
          </View>

          <View style={styles.topActions}>
            <IconButton
              label={
                bookmarked
                  ? 'Bỏ lưu chuyến đi'
                  : 'Lưu chuyến đi'
              }
              icon={{
                ios: bookmarked
                  ? 'bookmark.fill'
                  : 'bookmark',
                android: bookmarked
                  ? 'bookmark'
                  : 'bookmark_border',
                web: 'bookmark',
              }}
             onPress={toggleBookmark}
            />

            <IconButton
              label="Chia sẻ chuyến đi"
              icon={{
                ios:
                  'square.and.arrow.up',
                android: 'share',
                web: 'share',
              }}
              onPress={() =>
                void shareTrip()
              }
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View style={styles.telemetryRow}>
          <View
            style={[
              styles.liveDot,
              {
                backgroundColor:
                  theme.success,
              },
            ]}
          />

          <ThemedText
            style={styles.telemetryText}
          >
            VFRS TELEMETRY: LIVE SYNC
          </ThemedText>
        </View>

        <View style={styles.hero}>
          <Image
            source={{
              uri:
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=88',
            }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.heroShade} />

          <View
            style={[
              styles.tripCode,
              {
                backgroundColor:
                  theme.primary,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios:
                  'checkmark.seal.fill',
                android: 'verified',
                web: 'verified',
              }}
              color={theme.onPrimary}
              size={14}
            />

            <ThemedText
              style={[
                styles.tripCodeText,
                {
                  color:
                    theme.onPrimary,
                },
              ]}
            >
              VFRS CHỨNG NHẬN #TRIP-892
            </ThemedText>
          </View>

          <View
            style={[
              styles.seatBadge,
              {
                backgroundColor:
                  theme.trailOrange,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.seatText,
                {
                  color:
                    theme.onPrimary,
                },
              ]}
            >
              CÒN 3 CHỖ TRỐNG
            </ThemedText>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.coordinateBox}>
              <ThemedText
                style={[
                  styles.coordinateText,
                  {
                    color:
                      theme.primaryDark,
                  },
                ]}
              >
                GPS 22°18&apos;12&quot; N
              </ThemedText>

              <ThemedText
                style={[
                  styles.coordinateText,
                  {
                    color:
                      theme.primaryDark,
                  },
                ]}
              >
                103°46&apos;31&quot; E
              </ThemedText>
            </View>

            <View style={styles.coordinateBox}>
              <ThemedText
                style={[
                  styles.coordinateText,
                  {
                    color:
                      theme.primaryDark,
                  },
                ]}
              >
                MỞ BẢN ĐỒ
              </ThemedText>

              <ThemedText
                style={[
                  styles.coordinateText,
                  {
                    color:
                      theme.primaryDark,
                  },
                ]}
              >
                TOPO • 1/18
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.introBlock}>
          <ThemedText
            style={[
              styles.routeCategory,
              {
                color:
                  theme.trailOrange,
              },
            ]}
          >
            CUNG ĐƯỜNG TRUYỀN THỐNG ĐẲNG CẤP
          </ThemedText>

          <ThemedText style={styles.tripTitle}>
            Chinh phục đỉnh Fansipan qua
            Sống Lưng Trâu 3N2Đ
          </ThemedText>

          <View style={styles.tripTags}>
            <ThemedText type="small">
              ⚑ VN-FSP-241118
            </ThemedText>

            <ThemedText
              type="small"
              style={{
                color:
                  theme.trailOrange,
              }}
            >
              Cấp độ 4: Thử thách
            </ThemedText>
          </View>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Lào Cai • 12 người
          </ThemedText>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            label="KHỞI HÀNH"
            value="05:30"
            note="T7, 18/11/2026"
            icon={{
              ios: 'calendar',
              android: 'calendar_month',
              web: 'calendar_month',
            }}
          />

          <MetricCard
            label="THỜI LƯỢNG"
            value="3 Ngày 2 Đêm"
            note="2 đêm cắm trại lán"
            icon={{
              ios: 'timer',
              android: 'timer',
              web: 'timer',
            }}
          />

          <MetricCard
            label="ĐỘ CAO MỤC TIÊU"
            value="3.143 m"
            note="Chênh cao +1.850 m"
            icon={{
              ios: 'mountain.2.fill',
              android: 'landscape',
              web: 'landscape',
            }}
          />

          <MetricCard
            label="THỜI TIẾT DỰ BÁO"
            value="11°C – 19°C"
            note="Trời trong, biển mây"
            icon={{
              ios: 'sun.max.fill',
              android: 'sunny',
              web: 'sunny',
            }}
          />
        </View>

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.meetingCard,
            {
              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.meetingIcon,
              {
                backgroundColor:
                  theme.tealSurface,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios:
                  'mappin.and.ellipse',
                android: 'location_on',
                web: 'location_on',
              }}
              color={theme.teal}
              size={22}
            />
          </View>

          <View style={styles.flexOne}>
            <ThemedText
              style={styles.metricLabel}
              themeColor="textSecondary"
            >
              ĐIỂM TẬP KẾT
            </ThemedText>

            <ThemedText
              style={styles.meetingTitle}
            >
              Trạm Kiểm lâm Tôn Đức
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Đèo Ô Quy Hồ, Sa Pa, Lào Cai •
              Có bãi giữ xe
            </ThemedText>
          </View>
        </ThemedView>

        <LeaderCard />

        <ItinerarySection />

        <ServicesSection />

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.sectionCard,
            {
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.headingWithIcon}>
            <AppSymbol
              name={{
                ios: 'doc.text.fill',
                android: 'policy',
                web: 'policy',
              }}
              color={theme.primary}
              size={18}
            />

            <ThemedText
              style={styles.policyTitle}
            >
              Chính sách bảo lưu & Hoàn tiền
            </ThemedText>
          </View>

          <ThemedText type="small">
            ✓ Hủy linh hoạt: hoàn 100% trước
            7 ngày khởi hành.
          </ThemedText>

          <ThemedText type="small">
            ✓ Thời tiết bất khả kháng: bảo
            lưu hoặc hoàn 100% nếu có cảnh
            báo cấp độ 4 trở lên.
          </ThemedText>
        </ThemedView>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomBar,
          {
            borderTopColor: theme.border,
            backgroundColor:
              theme.surfaceElevated,
          },
        ]}
      >
        <View>
          <ThemedText
            style={[
              styles.price,
              {
                color: theme.danger,
              },
            ]}
          >
            3.450.000 ₫
          </ThemedText>

          <ThemedText
            style={styles.priceNote}
            themeColor="textSecondary"
          >
            / khách • Chỉ còn 3 suất
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openBooking}
          style={({ pressed }) => [
            styles.bookingButton,
            {
              backgroundColor:
                theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <AppSymbol
            name={{
              ios: 'figure.hiking',
              android: 'hiking',
              web: 'hiking',
            }}
            color={theme.onPrimary}
            size={20}
          />

          <ThemedText
            type="smallBold"
            style={{
              color: theme.onPrimary,
            }}
          >
            ĐẶT CHỖ NGAY
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeTop: {
    zIndex: 2,
  },
  topBar: {
    alignItems: 'center',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: Spacing.two,
  },
  topTitle: {
    alignItems: 'center',
    flex: 1,
  },
  brandLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  topActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  telemetryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  liveDot: {
    borderRadius: Radius.pill,
    height: 7,
    width: 7,
  },
  telemetryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hero: {
    borderRadius: Radius.medium,
    height: 252,
    marginHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      'rgba(8,28,21,0.2)',
  },
  tripCode: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    top: 12,
  },
  tripCodeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  seatBadge: {
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    top: 46,
  },
  seatText: {
    fontSize: 9,
    fontWeight: '900',
  },
  heroBottom: {
    bottom: 10,
    flexDirection: 'row',
    gap: 6,
    left: 10,
    position: 'absolute',
    right: 10,
  },
  coordinateBox: {
    backgroundColor:
      'rgba(255,255,255,0.9)',
    borderRadius: 5,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  coordinateText: {
    fontSize: 8,
    fontWeight: '800',
  },
  introBlock: {
    gap: 5,
    paddingHorizontal: Spacing.three,
  },
  routeCategory: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  tripTitle: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 29,
  },
  tripTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  metricCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    minHeight: 104,
    padding: 12,
    width: '48.8%',
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 5,
  },
  metricNote: {
    fontSize: 11,
    lineHeight: 16,
  },
  meetingCard: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: Spacing.three,
    padding: 14,
  },
  meetingIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  meetingTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: Spacing.three,
    padding: 14,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headingWithIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  verifiedBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  verifiedText: {
    fontSize: 8,
    fontWeight: '900',
  },
  leaderProfile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  leaderAvatar: {
    borderRadius: 10,
    height: 58,
    width: 58,
  },
  leaderName: {
    fontSize: 18,
    fontWeight: '800',
  },
  leaderRole: {
    fontSize: 8,
    fontWeight: '900',
  },
  leaderQuote: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 9,
  },
  leaderStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  leaderStat: {
    alignItems: 'center',
    flex: 1,
    padding: 10,
  },
  leaderStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  leaderStatLabel: {
    fontSize: 7,
    fontWeight: '800',
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  sectionBlock: {
    gap: Spacing.two,
  },
  sectionTitleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  itineraryList: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  dayCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 62,
    padding: 10,
  },
  dayBadge: {
    alignItems: 'center',
    borderRadius: 6,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dayMeta: {
    fontSize: 9,
    fontWeight: '800',
  },
  schedule: {
    borderTopWidth:
      StyleSheet.hairlineWidth,
    gap: 12,
    padding: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleTime: {
    fontSize: 11,
    fontWeight: '900',
    width: 42,
  },
  includedBanner: {
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  serviceList: {
    gap: 10,
  },
  serviceRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  rentalCallout: {
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  rentalIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  policyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  flexOne: {
    flex: 1,
  },
  bottomBar: {
    alignItems: 'center',
    borderTopWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
  },
  price: {
    fontSize: 18,
    fontWeight: '900',
  },
  priceNote: {
    fontSize: 10,
  },
  bookingButton: {
    alignItems: 'center',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
  },
});