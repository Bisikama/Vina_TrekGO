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

type Trail = {
  id: string;
  name: string;
  region: string;
  location: string;
  imageUrl: string;
  badge: string;
  difficulty: string;
  rating: number;
  reviewCount: number;
  distance: string;
  elevation: string;
  duration: string;
  signalLabel: string;
  verified: boolean;
  hasSos: boolean;
  warning: string | null;
  supportLabel: string;
};

const trails: Trail[] = [
  {
    id: 'trail_lao_than',
    name: 'Đỉnh Lảo Thẩn (2.860m)',
    region: 'Tọa độ Bát Xát',
    location:
      'Xã Y Tý, Huyện Bát Xát, Tỉnh Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
    badge: 'VFRS CHUẨN ĐỘI',
    difficulty: 'Cấp 2/5 · Vừa phải',
    rating: 4.9,
    reviewCount: 380,
    distance: '15.2 km',
    elevation: '+1.420m',
    duration: '2N1Đ',
    signalLabel: '4G 85%',
    verified: true,
    hasSos: false,
    warning: null,
    supportLabel:
      'Đã đồng bộ GPS offline',
  },
  {
    id: 'trail_bach_moc',
    name: 'Bạch Mộc Lương Tử (3.046m)',
    region: 'Đỉnh Kỳ Quan San',
    location:
      'Bản Dền Sung, Xã Sàng Ma Sáo, Lào Cai',
    imageUrl:
      'https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1200&q=85',
    badge: 'VFRS THẨM ĐỊNH',
    difficulty: 'Cấp 4/5 · Khắc nghiệt',
    rating: 4.8,
    reviewCount: 215,
    distance: '30.0 km',
    elevation: '+2.100m',
    duration: '3N2Đ',
    signalLabel: 'Điểm cắm 2.100m',
    verified: true,
    hasSos: false,
    warning:
      'Yêu cầu gậy leo núi, sức bền và không sợ độ cao.',
    supportLabel:
      'Suối nước cách 4.2 km',
  },
  {
    id: 'trail_fansipan',
    name: 'Fansipan · Sống Lưng Trâu',
    region: 'Hoàng Liên Sơn',
    location:
      'Trạm Tôn / Cát Cát, VQG Hoàng Liên, Sa Pa',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
    badge: 'VFRS GIÁM SÁT',
    difficulty: 'Cấp 4/5 · Kỹ thuật',
    rating: 4.9,
    reviewCount: 520,
    distance: '22.0 km',
    elevation: '+1.950m',
    duration: '3N2Đ',
    signalLabel: '03 trạm SOS',
    verified: true,
    hasSos: true,
    warning: null,
    supportLabel:
      'Hỗ trợ offline topo',
  },
];

function FilterChip({
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
      accessibilityState={{
        selected,
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected
            ? theme.primary
            : theme.surfaceElevated,
          borderColor: selected
            ? theme.primary
            : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        type="smallBold"
        style={{
          color: selected
            ? theme.onPrimary
            : theme.text,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TrailCard({
  trail,
}: {
  trail: Trail;
}) {
  const theme = useTheme();
  const router = useRouter();

  const metrics = [
    ['Cự ly', trail.distance],
    ['Độ dốc', trail.elevation],
    ['Thời lượng', trail.duration],
    [
      trail.hasSos
        ? 'Trạm SOS'
        : 'Tín hiệu',
      trail.signalLabel,
    ],
  ];

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
      <View style={styles.hero}>
        <Image
          source={trail.imageUrl}
          style={styles.heroImage}
          contentFit="cover"
          transition={180}
        />

        <View style={styles.heroShade} />

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  theme.primary,
              },
            ]}
          >
            <ThemedText
              style={styles.badgeText}
            >
              {trail.badge}
            </ThemedText>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  theme.trailOrange,
              },
            ]}
          >
            <ThemedText
              style={styles.badgeText}
            >
              {trail.difficulty}
            </ThemedText>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lưu ${trail.name}`}
          onPress={() =>
            Alert.alert(
              'Đã lưu cung đường',
              trail.name,
            )
          }
          style={({ pressed }) => [
            styles.bookmark,
            pressed && styles.pressed,
          ]}
        >
          <AppSymbol
            name={{
              ios: 'bookmark',
              android:
                'bookmark_border',
              web: 'bookmark',
            }}
            color="#FFFFFF"
            size={21}
          />
        </Pressable>

        <View style={styles.heroText}>
          <ThemedText
            style={styles.region}
          >
            {trail.region.toUpperCase()}
          </ThemedText>

          <View style={styles.titleRow}>
            <ThemedText
              style={styles.trailName}
            >
              {trail.name}
            </ThemedText>

            <View
              style={styles.ratingBadge}
            >
              <ThemedText
                style={styles.ratingText}
              >
                ★ {trail.rating} (
                {trail.reviewCount})
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.locationRow}>
          <AppSymbol
            name={{
              ios: 'mappin.and.ellipse',
              android: 'location_on',
              web: 'location_on',
            }}
            color={theme.primary}
            size={18}
          />

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.locationText}
          >
            {trail.location}
          </ThemedText>
        </View>

        {trail.warning ? (
          <View
            style={[
              styles.warning,
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
              ⚠ {trail.warning}
            </ThemedText>
          </View>
        ) : null}

        <View
          style={[
            styles.metrics,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          {metrics.map(
            ([label, value]) => (
              <View
                key={label}
                style={styles.metricItem}
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.metricLabel}
                >
                  {label.toUpperCase()}
                </ThemedText>

                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      theme.primary,
                  }}
                >
                  {value}
                </ThemedText>
              </View>
            ),
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.supportRow}>
            <AppSymbol
              name={{
                ios: 'arrow.down.circle',
                android:
                  'download_for_offline',
                web: 'download',
              }}
              color={theme.primary}
              size={17}
            />

            <ThemedText
              type="smallBold"
              themeColor="primary"
            >
              {trail.supportLabel}
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
           onPress={() =>
  router.push({
    pathname: '/trails/[id]',
    params: {
      id: trail.id,
    },
  })
}
            style={({ pressed }) => [
              styles.detailButton,
              {
                backgroundColor:
                  theme.primary,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={{
                color:
                  theme.onPrimary,
                fontWeight: '900',
              }}
            >
              CHI TIẾT →
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

function MapPreview({
  visibleTrails,
}: {
  visibleTrails: Trail[];
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.mapPanel,
        {
          backgroundColor:
            theme.tealSurface,
        },
      ]}
    >
      <View
        style={[
          styles.mapRoute,
          {
            borderColor: theme.teal,
          },
        ]}
      />

      {visibleTrails.map(
        (trail, index) => (
          <View
            key={trail.id}
            style={[
              styles.mapPin,
              {
                backgroundColor:
                  trail.hasSos
                    ? theme.danger
                    : theme.primary,

                left: `${
                  18 + index * 27
                }%`,

                top: `${
                  18 +
                  (index % 2) * 34
                }%`,
              },
            ]}
          >
            <ThemedText
              style={styles.mapPinText}
            >
              {index + 1}
            </ThemedText>
          </View>
        ),
      )}

      <View style={styles.mapCaption}>
        <ThemedText
          style={styles.mapTitle}
        >
          Bản đồ cung đường Tây Bắc
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Bản demo vị trí — chưa sử dụng
          GPS thật.
        </ThemedText>
      </View>
    </View>
  );
}

export function ExploreScreen() {
  const theme = useTheme();

  const [query, setQuery] =
    useState('');

  const [mode, setMode] =
    useState<'list' | 'map'>(
      'list',
    );

  const [
    verifiedOnly,
    setVerifiedOnly,
  ] = useState(true);

  const [sosOnly, setSosOnly] =
    useState(false);

  const visibleTrails = useMemo(
    () => {
      const keyword = query
        .trim()
        .toLocaleLowerCase('vi');

      return trails.filter(
        (trail) => {
          const matchesQuery =
            !keyword ||
            `${trail.name} ${trail.region} ${trail.location}`
              .toLocaleLowerCase(
                'vi',
              )
              .includes(keyword);

          return (
            matchesQuery &&
            (!verifiedOnly ||
              trail.verified) &&
            (!sosOnly ||
              trail.hasSos)
          );
        },
      );
    },
    [
      query,
      sosOnly,
      verifiedOnly,
    ],
  );

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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.header}>
            <View>
              <ThemedText
                type="smallBold"
                themeColor="primary"
              >
                VINA_TREKGO TRAILS
              </ThemedText>

              <ThemedText
                style={styles.pageTitle}
              >
                Khám phá cung đường
              </ThemedText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hồ sơ cá nhân"
              onPress={() =>
                Alert.alert(
                  'Hồ sơ',
                  'Mở tab Cá nhân để xem hồ sơ Trekker.',
                )
              }
              style={({ pressed }) => [
                styles.profileButton,
                {
                  backgroundColor:
                    theme.primary,
                },
                pressed &&
                  styles.pressed,
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'person.fill',
                  android: 'person',
                  web: 'person',
                }}
                color={theme.onPrimary}
                size={20}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchBox,
              {
                backgroundColor:
                  theme.backgroundElement,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'magnifyingglass',
                android: 'search',
                web: 'search',
              }}
              color={theme.primary}
              size={20}
            />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm theo tên đỉnh, tỉnh hoặc khu vực"
              placeholderTextColor={
                theme.textSecondary
              }
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                },
              ]}
            />

            {query ? (
              <Pressable
                onPress={() =>
                  setQuery('')
                }
              >
                <AppSymbol
                  name={{
                    ios: 'xmark.circle.fill',
                    android: 'cancel',
                    web: 'cancel',
                  }}
                  color={
                    theme.textSecondary
                  }
                  size={19}
                />
              </Pressable>
            ) : null}
          </View>

          <View
            style={[
              styles.modeSwitch,
              {
                backgroundColor:
                  theme.backgroundElement,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setMode('list')
              }
              style={[
                styles.modeButton,
                mode === 'list' && {
                  backgroundColor:
                    theme.surfaceElevated,
                },
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'list.bullet',
                  android: 'view_list',
                  web: 'list',
                }}
                color={
                  mode === 'list'
                    ? theme.primary
                    : theme.textSecondary
                }
                size={18}
              />

              <ThemedText
                type="smallBold"
                style={{
                  color:
                    mode === 'list'
                      ? theme.primary
                      : theme.textSecondary,
                }}
              >
                Danh sách
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() =>
                setMode('map')
              }
              style={[
                styles.modeButton,
                mode === 'map' && {
                  backgroundColor:
                    theme.surfaceElevated,
                },
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'map.fill',
                  android: 'map',
                  web: 'map',
                }}
                color={
                  mode === 'map'
                    ? theme.primary
                    : theme.textSecondary
                }
                size={18}
              />

              <ThemedText
                type="smallBold"
                style={{
                  color:
                    mode === 'map'
                      ? theme.primary
                      : theme.textSecondary,
                }}
              >
                Bản đồ (Live GPS)
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filters
            }
          >
            <FilterChip
              label="Độ khó: Cấp 2–4"
              selected
              onPress={() =>
                undefined
              }
            />

            <FilterChip
              label="Đã thẩm định VFRS"
              selected={verifiedOnly}
              onPress={() =>
                setVerifiedOnly(
                  (current) =>
                    !current,
                )
              }
            />

            <FilterChip
              label="Có trạm SOS"
              selected={sosOnly}
              onPress={() =>
                setSosOnly(
                  (current) =>
                    !current,
                )
              }
            />
          </ScrollView>

          <View style={styles.resultRow}>
            <ThemedText
              style={styles.resultCount}
            >
              {visibleTrails.length}{' '}
              cung đường
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Tây Bắc · Phổ biến nhất
            </ThemedText>
          </View>

          {mode === 'map' ? (
            <MapPreview
              visibleTrails={
                visibleTrails
              }
            />
          ) : visibleTrails.length ? (
            <View
              style={styles.cardList}
            >
              {visibleTrails.map(
                (trail) => (
                  <TrailCard
                    key={trail.id}
                    trail={trail}
                  />
                ),
              )}
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <ThemedText
                style={styles.emptyTitle}
              >
                Không tìm thấy cung đường
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Hãy xoá từ khoá hoặc thay
                đổi bộ lọc đang chọn.
              </ThemedText>
            </View>
          )}

          <View
            style={[
              styles.offlineBanner,
              {
                backgroundColor:
                  theme.primarySurface,
              },
            ]}
          >
            <View style={styles.offlineText}>
              <ThemedText type="smallBold">
                Bản đồ ngoại tuyến sẵn sàng
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Ba cung đường đã có gói dữ
                liệu GPS demo.
              </ThemedText>
            </View>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Đã tải bản đồ demo',
                  'Gói dữ liệu ngoại tuyến đã sẵn sàng.',
                )
              }
              style={({ pressed }) => [
                styles.downloadButton,
                {
                  backgroundColor:
                    theme.primary,
                },
                pressed &&
                  styles.pressed,
              ]}
            >
              <ThemedText
                type="smallBold"
                style={{
                  color:
                    theme.onPrimary,
                }}
              >
                TẢI VỀ
              </ThemedText>
            </Pressable>
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
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    marginTop: 2,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    minHeight: 50,
    fontSize: 14,
  },
  modeSwitch: {
    padding: 4,
    borderRadius: Radius.medium,
    flexDirection: 'row',
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  filters: {
    gap: Spacing.two,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCount: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  cardList: {
    gap: Spacing.three,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  hero: {
    height: 210,
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
      'rgba(3,20,12,0.3)',
  },
  badgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  bookmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor:
      'rgba(8,28,21,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    position: 'absolute',
    left: 13,
    right: 13,
    bottom: 13,
    gap: 3,
  },
  region: {
    color: '#9FE8D9',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  trailName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor:
      'rgba(8,28,21,0.7)',
  },
  ratingText: {
    color: '#9FE8D9',
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  locationText: {
    flex: 1,
  },
  warning: {
    padding: 11,
    borderRadius: 10,
  },
  metrics: {
    paddingVertical: 11,
    paddingHorizontal: 5,
    borderRadius: 10,
    flexDirection: 'row',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  supportRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailButton: {
    minHeight: 43,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPanel: {
    height: 440,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: Radius.large,
  },
  mapRoute: {
    position: 'absolute',
    left: 45,
    top: 70,
    width: 270,
    height: 210,
    borderWidth: 4,
    borderRadius: 100,
    transform: [
      {
        rotate: '-12deg',
      },
    ],
    opacity: 0.45,
  },
  mapPin: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  mapCaption: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor:
      'rgba(255,255,255,0.92)',
  },
  mapTitle: {
    color: '#081C15',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  emptyState: {
    minHeight: 180,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  emptyTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  offlineBanner: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  offlineText: {
    flex: 1,
    gap: 2,
  },
  downloadButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});