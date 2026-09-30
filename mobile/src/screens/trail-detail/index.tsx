import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

type TrailDetail = {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  location: string;
  imageUrl: string;
  distance: string;
  summit: string;
  elevationGain: string;
  difficulty: string;
  weather: string;
  direction: string;
  climbTime: string;
};

const defaultTrail: TrailDetail = {
  id: 'trail_lao_than',
  code: 'TR-042',
  name: 'Lảo Thẩn – Nóc nhà Y Tý',
  subtitle:
    'Thiên đường săn mây bồng bềnh và hoàng hôn đại ngàn',
  location: 'Bát Xát, Lào Cai',
  imageUrl:
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=88',
  distance: '16.2 km',
  summit: '2.860 m',
  elevationGain: '+1.120 m',
  difficulty:
    'Cấp 3 · Trung bình',
  weather:
    '14°C · Mây rải rác',
  direction: 'Đông Bắc',
  climbTime: '5–6 giờ',
};

const trails: Record<
  string,
  TrailDetail
> = {
  trail_lao_than: defaultTrail,

  trail_bach_moc: {
    ...defaultTrail,
    id: 'trail_bach_moc',
    code: 'TR-061',
    name:
      'Bạch Mộc Lương Tử – Kỳ Quan San',
    subtitle:
      'Sống núi thử thách giữa biển mây Tây Bắc',
    location:
      'Sàng Ma Sáo, Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1400&q=88',
    distance: '30.0 km',
    summit: '3.046 m',
    elevationGain: '+2.100 m',
    difficulty:
      'Cấp 4 · Khắc nghiệt',
    weather: '9°C · Gió mạnh',
    direction: 'Tây Bắc',
    climbTime: '8–10 giờ',
  },

  trail_fansipan: {
    ...defaultTrail,
    id: 'trail_fansipan',
    code: 'TR-001',
    name:
      'Fansipan – Sống Lưng Trâu',
    subtitle:
      'Hành trình chạm nóc nhà Đông Dương qua rừng Hoàng Liên',
    location: 'Sa Pa, Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=88',
    distance: '22.0 km',
    summit: '3.143 m',
    elevationGain: '+1.950 m',
    difficulty:
      'Cấp 4 · Kỹ thuật',
    weather: '7°C · Sương dày',
    direction: 'Bắc',
    climbTime: '7–9 giờ',
  },
};

const checkpoints = [
  {
    number: '01',
    title:
      'Xuất phát Bản Phìn Hồ',
    meta:
      'Km 0.0 · Cao độ 1.740 m',
    tag: 'Khởi điểm',
    description:
      'Điểm gửi xe, gặp Porter và kiểm tra lại nước uống cùng trang bị cá nhân.',
    support:
      '4G ổn định · Có nước sạch',
  },
  {
    number: '02',
    title: 'Trạm lán nghỉ A Hờ',
    meta:
      'Km 4.5 · Cao độ 2.200 m',
    tag: 'Lán hạ trại',
    description:
      'Lán gỗ kiên cố, có khu vệ sinh riêng, nơi sạc pin mặt trời và bộ đàm cứu hộ.',
    support:
      'Điện mặt trời · Bộ đàm SOS',
  },
  {
    number: '03',
    title:
      'Mỏm đá Câu Cá & Cột mốc gió',
    meta:
      'Km 7.8 · Cao độ 2.650 m',
    tag: 'Cảnh báo gió',
    description:
      'Sườn núi hở và có gió giật mạnh. Không trèo ra mép đá khi thời tiết xấu.',
    support:
      'Khu vực cần đi theo Leader',
  },
  {
    number: '04',
    title: 'Đỉnh Lảo Thẩn',
    meta:
      'Km 8.1 · Cao độ 2.860 m',
    tag: 'Đích đến',
    description:
      'Tầm nhìn 360 độ hướng về thung lũng Dền Sáng, Nhìu Cồ San và biển mây Y Tý.',
    support:
      '22.6105° N, 103.6291° E',
  },
];

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
      >
        {label}
      </ThemedText>

      <ThemedText
        type="smallBold"
        style={styles.metricValue}
      >
        {value}
      </ThemedText>
    </View>
  );
}

export function TrailDetailScreen({
  trailId,
}: {
  trailId: string;
}) {
  const router = useRouter();
  const theme = useTheme();

  const trail =
    trails[trailId] ??
    defaultTrail;

  function shareTrail() {
    void Share.share({
      message: `${trail.name} — ${trail.location}`,
    });
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
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() =>
                router.back()
              }
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor:
                    theme.backgroundElement,
                },
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
                size={21}
              />
            </Pressable>

            <View
              style={styles.topBarTitle}
            >
              <ThemedText type="smallBold">
                Chi tiết cung đường
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                VFRS VERIFIED #
                {trail.code}
              </ThemedText>
            </View>

            <View
              style={styles.topActions}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lưu cung đường"
                onPress={() =>
                  Alert.alert(
                    'Đã lưu',
                    trail.name,
                  )
                }
                style={[
                  styles.iconButton,
                  {
                    backgroundColor:
                      theme.backgroundElement,
                  },
                ]}
              >
                <AppSymbol
                  name={{
                    ios: 'heart',
                    android:
                      'favorite_border',
                    web: 'favorite',
                  }}
                  color={theme.primary}
                  size={20}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chia sẻ cung đường"
                onPress={shareTrail}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor:
                      theme.backgroundElement,
                  },
                ]}
              >
                <AppSymbol
                  name={{
                    ios:
                      'square.and.arrow.up',
                    android: 'share',
                    web: 'share',
                  }}
                  color={theme.primary}
                  size={20}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.hero}>
            <Image
              source={trail.imageUrl}
              style={styles.heroImage}
              contentFit="cover"
              transition={180}
            />

            <View
              style={styles.heroShade}
            />

            <View
              style={styles.heroText}
            >
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
                  style={
                    styles.verifiedText
                  }
                >
                  ✓ VFRS VERIFIED
                </ThemedText>
              </View>

              <ThemedText
                style={styles.location}
              >
                {trail.location}
              </ThemedText>

              <ThemedText
                style={styles.title}
              >
                {trail.name}
              </ThemedText>

              <ThemedText
                style={styles.subtitle}
              >
                {trail.subtitle}
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.metricGrid,
              {
                backgroundColor:
                  theme.surfaceElevated,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <Metric
              label="Cự ly"
              value={trail.distance}
            />

            <Metric
              label="Đỉnh"
              value={trail.summit}
            />

            <Metric
              label="Chênh cao"
              value={
                trail.elevationGain
              }
            />

            <Metric
              label="Cấp độ"
              value={
                trail.difficulty
              }
            />
          </View>

          <View
            style={styles.quickGrid}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  'GPX Offline',
                  'Đã tải gói GPX demo 1.8 MB.',
                )
              }
              style={[
                styles.quickCard,
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
                ↓ Tải GPX Offline
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                1.8 MB · KML/GPX
              </ThemedText>
            </Pressable>

            <View
              style={[
                styles.quickCard,
                {
                  backgroundColor:
                    theme.tealSurface,
                },
              ]}
            >
              <ThemedText type="smallBold">
                ☁ Thời tiết 72h
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                {trail.weather}
              </ThemedText>
            </View>
          </View>

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
              style={styles.sectionTitle}
            >
              Hồ sơ độ cao
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Dốc trung bình 14.8% ·
              Hướng {trail.direction} ·{' '}
              {trail.climbTime}
            </ThemedText>

            <View style={styles.chart}>
              {[
                35,
                48,
                62,
                80,
                100,
                84,
                68,
              ].map(
                (
                  height,
                  index,
                ) => (
                  <View
                    key={`${height}-${index}`}
                    style={[
                      styles.chartBar,
                      {
                        height: `${height}%`,
                        backgroundColor:
                          theme.primary,
                      },
                    ]}
                  />
                ),
              )}
            </View>

            <View
              style={styles.chartLabels}
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Km 0
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Lán A Hờ
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Đỉnh
              </ThemedText>
            </View>
          </ThemedView>

          <View
            style={styles.sectionHeader}
          >
            <ThemedText
              style={styles.sectionTitle}
            >
              Trạm dừng & Điểm an toàn
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              4 checkpoints đã xác minh
            </ThemedText>
          </View>

          <View
            style={
              styles.checkpointList
            }
          >
            {checkpoints.map(
              (checkpoint) => (
                <ThemedView
                  key={
                    checkpoint.number
                  }
                  type="surfaceElevated"
                  style={[
                    styles.checkpoint,
                    {
                      borderColor:
                        theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkpointNumber,
                      {
                        backgroundColor:
                          theme.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={
                        styles.checkpointNumberText
                      }
                    >
                      {
                        checkpoint.number
                      }
                    </ThemedText>
                  </View>

                  <View
                    style={
                      styles.checkpointContent
                    }
                  >
                    <View
                      style={
                        styles.checkpointHeading
                      }
                    >
                      <View
                        style={
                          styles.checkpointTitleGroup
                        }
                      >
                        <ThemedText type="smallBold">
                          {
                            checkpoint.title
                          }
                        </ThemedText>

                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                        >
                          {
                            checkpoint.meta
                          }
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.checkpointTag,
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
                          {
                            checkpoint.tag
                          }
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                    >
                      {
                        checkpoint.description
                      }
                    </ThemedText>

                    <ThemedText
                      type="smallBold"
                      themeColor="primary"
                    >
                      {
                        checkpoint.support
                      }
                    </ThemedText>
                  </View>
                </ThemedView>
              ),
            )}
          </View>

          <ThemedView
            type="surfaceElevated"
            style={[
              styles.tripCard,
              {
                borderColor:
                  theme.border,
              },
            ]}
          >
            <View
              style={styles.tripHeader}
            >
              <View>
                <ThemedText
                  style={
                    styles.sectionTitle
                  }
                >
                  Chuyến sắp khởi hành
                </ThemedText>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Khởi hành 15/11 ·
                  Còn 3 chỗ
                </ThemedText>
              </View>

              <View
                style={[
                  styles.seatBadge,
                  {
                    backgroundColor:
                      theme.warningSurface,
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  themeColor="warning"
                >
                  Còn 3 chỗ
                </ThemedText>
              </View>
            </View>

            <ThemedText type="smallBold">
              Chinh phục Lảo Thẩn 2N1Đ
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Leader Vũ Hùng · VFRS
              Verified · 5 năm kinh nghiệm
            </ThemedText>

            <View
              style={styles.tripFooter}
            >
              <View>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Chi phí trọn gói
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
                  2.850.000đ
                </ThemedText>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Đặt chỗ demo',
                    'Màn booking sẽ được nối ở cụm tiếp theo.',
                  )
                }
                style={({ pressed }) => [
                  styles.bookButton,
                  {
                    backgroundColor:
                      theme.trailOrange,
                  },
                  pressed &&
                    styles.pressed,
                ]}
              >
                <ThemedText
                  style={
                    styles.bookButtonText
                  }
                >
                  ĐẶT CHỖ NGAY
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
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
  content: {
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    gap: 6,
  },
  hero: {
    height: 330,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor:
      'rgba(3,20,12,0.42)',
  },
  heroText: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    gap: 7,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  location: {
    color: '#B7F0D1',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
  },
  subtitle: {
    color: '#E5F1E9',
    fontSize: 14,
    lineHeight: 20,
  },
  metricGrid: {
    marginHorizontal: Spacing.three,
    marginTop: -4,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    paddingHorizontal: 3,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 12,
    textAlign: 'center',
  },
  quickGrid: {
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickCard: {
    flex: 1,
    minHeight: 80,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    justifyContent: 'center',
    gap: 5,
  },
  panel: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  chart: {
    height: 120,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chartBar: {
    flex: 1,
    minHeight: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    opacity: 0.82,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
  },
  checkpointList: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  checkpoint: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  checkpointNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointNumberText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  checkpointContent: {
    flex: 1,
    gap: 8,
  },
  checkpointHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  checkpointTitleGroup: {
    flex: 1,
    gap: 2,
  },
  checkpointTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },
  tripCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    gap: Spacing.two,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  seatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tripFooter: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  price: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  bookButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.7,
  },
});