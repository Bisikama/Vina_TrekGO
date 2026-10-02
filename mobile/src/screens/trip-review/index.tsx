import { Image } from 'expo-image';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import {
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RatingRowProps = {
  description: string;
  label: string;
  onChange: (rating: number) => void;
  rating: number;
};

type EquipmentReview = {
  id: string;
  name: string;
  code: string;
  icon: string;
  rating: number;
  tags: string[];
};

const leaderHighlights = [
  'An toàn tuyệt đối',
  'Nhiệt tình hỗ trợ',
  'Dẫn đường chuẩn',
  'Sơ cấp cứu tốt',
  'Kỹ năng sinh tồn',
];

const initialEquipment: EquipmentReview[] = [
  {
    id: 'tent',
    name: 'Lều Coleman WeatherMaster 4P',
    code: '#EQ-TENT-402',
    icon: '⛺',
    rating: 5,
    tags: [
      'Chống nước tốt',
      'Đủ cọc & dây',
      'Gọn gàng',
    ],
  },
  {
    id: 'pole',
    name: 'Gậy trekking Naturehike Carbon Pro',
    code: '#EQ-POLE-819',
    icon: '🥾',
    rating: 5,
    tags: [
      'Nhẹ & chắc chắn',
      'Khóa ngàm nhạy',
    ],
  },
  {
    id: 'lamp',
    name: 'Đèn pin đội đầu BD Storm 450',
    code: '#EQ-LAMP-115',
    icon: '🔦',
    rating: 4,
    tags: [
      'Sáng tốt',
      'Pin trâu',
      'Dây đeo vừa vặn',
    ],
  },
];

const memoryPhotos = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=85',
  'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=500&q=85',
  'https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=500&q=85',
];

function RatingStars({
  onChange,
  rating,
  size = 34,
}: {
  onChange: (rating: number) => void;
  rating: number;
  size?: number;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((value) => {
        const selected = value <= rating;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${value} sao`}
            hitSlop={6}
            key={value}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.starButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={[
                styles.star,
                {
                  color: selected
                    ? '#C43D22'
                    : '#B7C0BA',
                  fontSize: size,
                },
              ]}
            >
              {selected ? '★' : '☆'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function RatingRow({
  description,
  label,
  onChange,
  rating,
}: RatingRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.ratingRow,
        {
          backgroundColor:
            theme.backgroundElement,
        },
      ]}
    >
      <View style={styles.ratingText}>
        <ThemedText style={styles.ratingLabel}>
          {label}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          {description}
        </ThemedText>
      </View>

      <RatingStars
        rating={rating}
        onChange={onChange}
        size={24}
      />
    </View>
  );
}

function SectionCard({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor:
            theme.surfaceElevated,
          borderColor: theme.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function TripReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [leaderRating, setLeaderRating] =
    useState(5);

  const [routeRating, setRouteRating] =
    useState(5);

  const [
    organizationRating,
    setOrganizationRating,
  ] = useState(5);

  const [experienceRating, setExperienceRating] =
    useState(5);

  const [
    selectedHighlights,
    setSelectedHighlights,
  ] = useState<string[]>([
    'An toàn tuyệt đối',
    'Nhiệt tình hỗ trợ',
    'Dẫn đường chuẩn',
    'Kỹ năng sinh tồn',
  ]);

  const [comment, setComment] = useState(
    'Cung đường Tà Năng – Phan Dũng mùa cỏ xanh tuyệt đẹp! Anh Nam dẫn đoàn cực kỳ kỹ luật khi qua đồi lộng gió và hỗ trợ nhóm qua suối an toàn. Bữa tối cắm trại chu đáo.',
  );

  const [equipment, setEquipment] =
    useState(initialEquipment);

  const averageExperience = useMemo(
    () =>
      (
        (routeRating +
          organizationRating +
          experienceRating) /
        3
      ).toFixed(1),
    [
      experienceRating,
      organizationRating,
      routeRating,
    ],
  );

  function toggleHighlight(value: string) {
    setSelectedHighlights((current) =>
      current.includes(value)
        ? current.filter(
            (item) => item !== value,
          )
        : [...current, value],
    );
  }

  function updateEquipmentRating(
    equipmentId: string,
    rating: number,
  ) {
    setEquipment((current) =>
      current.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              rating,
            }
          : item,
      ),
    );
  }

  function submitReview() {
    if (leaderRating === 0) {
      Alert.alert(
        'Chưa đủ thông tin',
        'Bạn cần đánh giá Mountain Leader trước khi gửi.',
      );

      return;
    }

    Alert.alert(
      'Đã gửi đánh giá',
      'Cảm ơn bạn! Bạn nhận được 50 điểm VFRS.',
      [
        {
          text: 'Hoàn tất',
          onPress: () => router.back(),
        },
      ],
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            theme.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        style={styles.flexOne}
      >
        <View
          style={[
            styles.header,
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
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
          >
            <AppSymbol
              name={{
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow_back',
              }}
              color={theme.text}
              size={23}
            />
          </Pressable>

          <View style={styles.headerTitle}>
            <ThemedText
              type="smallBold"
              style={styles.eyebrow}
            >
              VINA_TREKGO FIELD LOG
            </ThemedText>

            <ThemedText style={styles.pageTitle}>
              Đánh giá chuyến đi
            </ThemedText>
          </View>

          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor:
                  theme.primary,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'person.crop.circle',
                android: 'person',
                web: 'person',
              }}
              color="#FFFFFF"
              size={21}
            />
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                110 + insets.bottom,
            },
          ]}
        >
          <SectionCard>
            <View style={styles.tripCodeRow}>
              <View
                style={[
                  styles.codeBadge,
                  {
                    backgroundColor:
                      '#EAF2FF',
                  },
                ]}
              >
                <ThemedText style={styles.codeText}>
                  MÃ: #TRIP-TND-2024
                </ThemedText>
              </View>

              <View
                style={[
                  styles.challengeBadge,
                  {
                    backgroundColor:
                      '#FDE5DF',
                  },
                ]}
              >
                <ThemedText
                  style={styles.challengeText}
                >
                  ♨ VFRS CẤP 3
                </ThemedText>
              </View>

              <ThemedText
                type="smallBold"
                style={styles.finishedText}
              >
                ● ĐÃ KẾT THÚC
              </ThemedText>
            </View>

            <ThemedText style={styles.tripName}>
              Tà Năng — Phan Dũng 3N2Đ
            </ThemedText>

            <View style={styles.tripMeta}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                📅 28/10/2024
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                🛡 12 thành viên an toàn
              </ThemedText>
            </View>

            <View
              style={[
                styles.leaderSummary,
                {
                  backgroundColor:
                    theme.backgroundElement,
                },
              ]}
            >
              <View
                style={[
                  styles.leaderAvatar,
                  {
                    backgroundColor:
                      theme.primary,
                  },
                ]}
              >
                <ThemedText
                  style={styles.leaderInitials}
                >
                  THN
                </ThemedText>
              </View>

              <View style={styles.flexOne}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  MOUNTAIN LEADER
                </ThemedText>

                <ThemedText type="smallBold">
                  Trần Hoàng Nam
                </ThemedText>
              </View>

              <View
                style={[
                  styles.verifiedBadge,
                  {
                    backgroundColor:
                      theme.surfaceElevated,
                  },
                ]}
              >
                <ThemedText
                  style={styles.verifiedText}
                >
                  VFRS L2 VERIFIED
                </ThemedText>
              </View>
            </View>

            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.hiddenTripId}
            >
              Chuyến: {id ?? 'trip_ta_nang'}
            </ThemedText>
          </SectionCard>

          <SectionCard>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>
                ⚑ 1. Đánh giá Mountain Leader
              </ThemedText>

              <ThemedText style={styles.requiredText}>
                BẮT BUỘC
              </ThemedText>
            </View>

            <View
              style={[
                styles.leaderProfile,
                {
                  backgroundColor:
                    theme.backgroundElement,
                },
              ]}
            >
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=85',
                }}
                contentFit="cover"
                style={styles.leaderPhoto}
              />

              <View style={styles.flexOne}>
                <View style={styles.nameRow}>
                  <ThemedText
                    style={styles.leaderName}
                  >
                    Trần Hoàng Nam
                  </ThemedText>

                  <View
                    style={[
                      styles.mainLeaderBadge,
                      {
                        backgroundColor:
                          theme.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={
                        styles.mainLeaderText
                      }
                    >
                      LEADER CHÍNH
                    </ThemedText>
                  </View>
                </View>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  Cứu hộ địa hình rừng • 38
                  chuyến Tà Năng
                </ThemedText>

                <ThemedText
                  type="smallBold"
                  style={styles.vfrsScore}
                >
                  VFRS Điểm Uy Tín: 99.4/100
                </ThemedText>
              </View>
            </View>

            <View
              style={[
                styles.leaderRatingBox,
                {
                  backgroundColor:
                    theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Mức độ an toàn & dẫn dắt
              </ThemedText>

              <RatingStars
                rating={leaderRating}
                onChange={setLeaderRating}
              />

              <ThemedText
                style={styles.ratingResult}
              >
                {leaderRating === 5
                  ? 'Xuất sắc'
                  : leaderRating >= 4
                    ? 'Rất tốt'
                    : leaderRating >= 3
                      ? 'Tốt'
                      : 'Cần cải thiện'}{' '}
                — {leaderRating}.0 / 5.0
              </ThemedText>
            </View>

            <ThemedText
              type="smallBold"
              style={styles.subheading}
            >
              Điểm nổi bật của Leader:
            </ThemedText>

            <View style={styles.chipWrap}>
              {leaderHighlights.map((item) => {
                const selected =
                  selectedHighlights.includes(item);

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() =>
                      toggleHighlight(item)
                    }
                    style={({ pressed }) => [
                      styles.highlightChip,
                      {
                        backgroundColor: selected
                          ? theme.primary
                          : theme.backgroundElement,
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
                          ? '#FFFFFF'
                          : theme.text,
                      }}
                    >
                      {selected ? '✓ ' : '+ '}
                      {item}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard>
            <ThemedText style={styles.sectionTitle}>
              ◉ 2. Trải nghiệm & Tổ chức
            </ThemedText>

            <View style={styles.ratingList}>
              <RatingRow
                label="Cung đường & Lộ trình"
                description="Phân bổ chặng dốc, trạm nước, lán trại"
                rating={routeRating}
                onChange={setRouteRating}
              />

              <RatingRow
                label="Tổ chức & Hỗ trợ Porter"
                description="Đưa đón, thực phẩm, bảo hộ hành trang"
                rating={organizationRating}
                onChange={
                  setOrganizationRating
                }
              />

              <RatingRow
                label="Giá trị trải nghiệm"
                description="Cảnh quan thực địa, gắn kết đồng đội"
                rating={experienceRating}
                onChange={
                  setExperienceRating
                }
              />
            </View>

            <ThemedText
              type="smallBold"
              style={styles.averageText}
            >
              Điểm trải nghiệm trung bình:{' '}
              {averageExperience}/5
            </ThemedText>

            <View style={styles.commentHeader}>
              <ThemedText type="smallBold">
                Nhận xét chi tiết chuyến đi
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                {comment.length} ký tự
              </ThemedText>
            </View>

            <TextInput
              accessibilityLabel="Nhận xét chuyến đi"
              multiline
              maxLength={500}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              placeholderTextColor={
                theme.textSecondary
              }
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
              style={[
                styles.commentInput,
                {
                  backgroundColor:
                    theme.backgroundElement,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </SectionCard>

          <SectionCard>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>
                ▣ 3. Đánh giá thiết bị thuê
              </ThemedText>

              <View
                style={[
                  styles.equipmentCount,
                  {
                    backgroundColor:
                      theme.successSurface,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.equipmentCountText,
                    {
                      color: theme.success,
                    },
                  ]}
                >
                  3 MÓN ĐỒ
                </ThemedText>
              </View>
            </View>

            <View style={styles.equipmentList}>
              {equipment.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.equipmentItem,
                    {
                      backgroundColor:
                        theme.backgroundElement,
                    },
                  ]}
                >
                  <View style={styles.equipmentTop}>
                    <View
                      style={[
                        styles.equipmentIcon,
                        {
                          backgroundColor:
                            theme.primarySurface,
                        },
                      ]}
                    >
                      <ThemedText
                        style={
                          styles.equipmentEmoji
                        }
                      >
                        {item.icon}
                      </ThemedText>
                    </View>

                    <View style={styles.flexOne}>
                      <ThemedText
                        type="smallBold"
                      >
                        {item.name}
                      </ThemedText>

                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                      >
                        Mã kho: {item.code}
                      </ThemedText>
                    </View>
                  </View>

                  <RatingStars
                    rating={item.rating}
                    onChange={(rating) =>
                      updateEquipmentRating(
                        item.id,
                        rating,
                      )
                    }
                    size={22}
                  />

                  <View style={styles.equipmentTags}>
                    {item.tags.map(
                      (tag, index) => (
                        <View
                          key={tag}
                          style={[
                            styles.equipmentTag,
                            {
                              backgroundColor:
                                index < 2
                                  ? theme.primary
                                  : theme.primarySurface,
                            },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color:
                                index < 2
                                  ? '#FFFFFF'
                                  : theme.primary,
                              fontSize: 10,
                              fontWeight: '800',
                            }}
                          >
                            {index < 2
                              ? '✓ '
                              : ''}
                            {tag}
                          </ThemedText>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>
                ✣ 4. Ảnh kỷ niệm thực địa
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Tùy chọn
              </ThemedText>
            </View>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Chia sẻ ảnh khoảnh khắc ấn tượng
              trên đường mòn để lưu vào Sổ tay
              hành trình VFRS.
            </ThemedText>

            <View style={styles.photoRow}>
              {memoryPhotos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  contentFit="cover"
                  style={styles.memoryPhoto}
                />
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm ảnh"
                onPress={() =>
                  Alert.alert(
                    'Thêm ảnh',
                    'Bản demo đã ghi nhận thao tác mở thư viện ảnh.',
                  )
                }
                style={({ pressed }) => [
                  styles.addPhoto,
                  {
                    backgroundColor:
                      theme.backgroundElement,
                    borderColor:
                      theme.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <AppSymbol
                  name={{
                    ios: 'camera.fill',
                    android: 'add_a_photo',
                    web: 'add_a_photo',
                  }}
                  color={theme.primary}
                  size={25}
                />

                <ThemedText
                  type="smallBold"
                  style={{
                    color: theme.primary,
                  }}
                >
                  THÊM ẢNH
                </ThemedText>
              </Pressable>
            </View>
          </SectionCard>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor:
                theme.surfaceElevated,
              borderTopColor: theme.border,
              paddingBottom:
                Math.max(
                  insets.bottom,
                  Spacing.two,
                ),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={submitReview}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor:
                  theme.primary,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={styles.submitText}
            >
              ✪ GỬI ĐÁNH GIÁ — NHẬN +50 ĐIỂM
              VFRS
            </ThemedText>
          </Pressable>

          <ThemedText
            style={styles.transparencyText}
          >
            ◉ Minh bạch tiêu chuẩn an toàn thực
            địa Vina_TrekGo
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  eyebrow: {
    color: '#176B3A',
    fontSize: 9,
    letterSpacing: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  headerBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  sectionCard: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  tripCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  codeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  challengeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 6,
  },
  challengeText: {
    color: '#9F2B1B',
    fontSize: 9,
    fontWeight: '900',
  },
  finishedText: {
    marginLeft: 'auto',
    color: '#176B3A',
    fontSize: 9,
  },
  tripName: {
    fontSize: 19,
    fontWeight: '900',
  },
  tripMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  leaderSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 8,
  },
  leaderAvatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  leaderInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  verifiedBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#176B3A',
    fontSize: 8,
    fontWeight: '900',
  },
  hiddenTripId: {
    display: 'none',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  requiredText: {
    color: '#176B3A',
    fontSize: 9,
    fontWeight: '900',
  },
  leaderProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 8,
  },
  leaderPhoto: {
    width: 58,
    height: 58,
    borderRadius: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  leaderName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  mainLeaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  mainLeaderText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  vfrsScore: {
    marginTop: 3,
    color: '#B42318',
    fontSize: 10,
  },
  leaderRatingBox: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: 8,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    lineHeight: 38,
  },
  ratingResult: {
    color: '#B42318',
    fontSize: 17,
    fontWeight: '900',
  },
  subheading: {
    marginBottom: -Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  highlightChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  ratingList: {
    gap: Spacing.two,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 8,
  },
  ratingText: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  averageText: {
    color: '#176B3A',
    textAlign: 'right',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  commentInput: {
    minHeight: 120,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  equipmentCount: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: 4,
  },
  equipmentCountText: {
    fontSize: 9,
    fontWeight: '900',
  },
  equipmentList: {
    gap: Spacing.two,
  },
  equipmentItem: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 8,
  },
  equipmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  equipmentIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  equipmentEmoji: {
    fontSize: 22,
  },
  equipmentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  equipmentTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  memoryPhoto: {
    flex: 1,
    height: 78,
    borderRadius: 7,
  },
  addPhoto: {
    width: 82,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 7,
  },
  footer: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 6,
  },
  submitText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
  },
  transparencyText: {
    textAlign: 'center',
    fontSize: 9,
  },
});