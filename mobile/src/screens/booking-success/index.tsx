import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BookingSuccessScreenProps = {
  tripId: string;
  bookingId: string;
  amount: number;
};

const moneyFormatter = new Intl.NumberFormat('vi-VN');

function formatMoney(value: number) {
  return `${moneyFormatter.format(value)} ₫`;
}

function DetailRow({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.detailRow}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.detailLabel}
      >
        {label}
      </ThemedText>

      <ThemedText
        type="smallBold"
        style={[
          styles.detailValue,
          highlighted
            ? { color: theme.primary }
            : undefined,
        ]}
      >
        {value}
      </ThemedText>
    </View>
  );
}

export function BookingSuccessScreen({
  tripId,
  bookingId,
  amount,
}: BookingSuccessScreenProps) {
  const router = useRouter();
  const theme = useTheme();

  function openTripDetail() {
    router.replace({
      pathname: '/trips/[id]',
      params: {
        id: tripId,
      },
    });
  }

  function goHome() {
    router.replace('/(tabs)');
  }

  function saveTicket() {
    Alert.alert(
      'Đã lưu vé',
      'Vé điện tử đã được lưu vào chuyến đi của bạn.',
    );
  }

  function shareTicket() {
    Alert.alert(
      'Chia sẻ vé',
      `Mã đặt chỗ của bạn là ${bookingId}.`,
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.headerSpacer} />

          <View style={styles.headerTitleArea}>
            <ThemedText style={styles.brand}>
              Vina_TrekGo
            </ThemedText>

            <ThemedText type="smallBold">
              Xác nhận đặt chỗ
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng và về trang chủ"
            onPress={goHome}
            style={({ pressed }) => [
              styles.closeButton,
              {
                opacity: pressed ? 0.55 : 1,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'xmark',
                android: 'close',
                web: 'close',
              }}
              color={theme.text}
              size={22}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.successArea}>
          <View
            style={[
              styles.successCircleOuter,
              {
                backgroundColor:
                  theme.successSurface,
              },
            ]}
          >
            <View
              style={[
                styles.successCircle,
                {
                  backgroundColor: theme.success,
                },
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'checkmark',
                  android: 'check',
                  web: 'check',
                }}
                color={theme.onPrimary}
                size={44}
              />
            </View>
          </View>

          <ThemedText style={styles.successTitle}>
            Đặt chỗ thành công!
          </ThemedText>

          <ThemedText
            themeColor="textSecondary"
            style={styles.successDescription}
          >
            Thanh toán của bạn đã được ghi nhận.
            Vé điện tử đã được thêm vào chuyến đi.
          </ThemedText>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  theme.successSurface,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'checkmark.shield.fill',
                android: 'verified_user',
                web: 'verified_user',
              }}
              color={theme.success}
              size={17}
            />

            <ThemedText
              type="smallBold"
              style={{ color: theme.success }}
            >
              ĐÃ XÁC NHẬN THANH TOÁN
            </ThemedText>
          </View>
        </View>

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.ticketCard,
            {
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.ticketHeader}>
            <View style={styles.flexOne}>
              <ThemedText
                style={styles.ticketEyebrow}
                themeColor="textSecondary"
              >
                VÉ ĐIỆN TỬ VINATREKGO
              </ThemedText>

              <ThemedText style={styles.ticketTitle}>
                Chinh phục đỉnh Fansipan
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Sống Lưng Trâu • 3 ngày 2 đêm
              </ThemedText>
            </View>

            <View
              style={[
                styles.tripBadge,
                {
                  backgroundColor:
                    theme.primarySurface,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.tripBadgeText,
                  { color: theme.primary },
                ]}
              >
                CẤP 4/5
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.ticketDivider,
              {
                borderColor: theme.border,
              },
            ]}
          />

          <View style={styles.qrSection}>
            <View
              style={[
                styles.qrBox,
                {
                  backgroundColor:
                    theme.backgroundElement,
                },
              ]}
            >
              <AppSymbol
                name={{
                  ios: 'qrcode',
                  android: 'qr_code_2',
                  web: 'qr_code_2',
                }}
                color={theme.primaryDark}
                size={128}
              />
            </View>

            <View style={styles.bookingCodeArea}>
              <ThemedText
                style={styles.bookingCodeLabel}
                themeColor="textSecondary"
              >
                MÃ ĐẶT CHỖ
              </ThemedText>

              <ThemedText
                style={[
                  styles.bookingCode,
                  { color: theme.primary },
                ]}
              >
                {bookingId}
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Xuất trình mã QR này khi check-in
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.ticketDivider,
              {
                borderColor: theme.border,
              },
            ]}
          />

          <View style={styles.details}>
            <DetailRow
              label="Người tham gia"
              value="Hoàng Văn Nam"
            />

            <DetailRow
              label="Ngày khởi hành"
              value="05:30 • 18/11/2026"
            />

            <DetailRow
              label="Điểm tập trung"
              value="Văn phòng TrekGo Sa Pa"
            />

            <DetailRow
              label="Leader phụ trách"
              value="Phan Anh Tuấn"
            />

            <DetailRow
              label="Số tiền thanh toán"
              value={formatMoney(amount)}
              highlighted
            />
          </View>
        </ThemedView>

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.escrowCard,
            {
              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.escrowIcon,
              {
                backgroundColor:
                  theme.primarySurface,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'lock.shield.fill',
                android: 'lock',
                web: 'lock',
              }}
              color={theme.primary}
              size={24}
            />
          </View>

          <View style={styles.flexOne}>
            <ThemedText type="smallBold">
              Thanh toán được bảo vệ bởi Escrow
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Khoản thanh toán được giữ an toàn và
              chỉ giải ngân sau khi chuyến đi hoàn
              thành đúng cam kết.
            </ThemedText>
          </View>
        </ThemedView>

        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <AppSymbol
            name={{
              ios: 'bell.fill',
              android: 'notifications',
              web: 'notifications',
            }}
            color={theme.primary}
            size={22}
          />

          <View style={styles.flexOne}>
            <ThemedText type="smallBold">
              Bước tiếp theo
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              TrekGo sẽ gửi thông báo nhắc chuẩn bị
              hành lý, thời gian tập trung và thông
              tin check-in trước ngày khởi hành.
            </ThemedText>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={saveTicket}
            style={({ pressed }) => [
              styles.secondaryAction,
              {
                borderColor: theme.border,
                backgroundColor:
                  theme.surfaceElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'square.and.arrow.down',
                android: 'download',
                web: 'download',
              }}
              color={theme.primary}
              size={20}
            />

            <ThemedText type="smallBold">
              Lưu vé
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={shareTicket}
            style={({ pressed }) => [
              styles.secondaryAction,
              {
                borderColor: theme.border,
                backgroundColor:
                  theme.surfaceElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'square.and.arrow.up',
                android: 'share',
                web: 'share',
              }}
              color={theme.primary}
              size={20}
            />

            <ThemedText type="smallBold">
              Chia sẻ
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomBar,
          {
            backgroundColor:
              theme.surfaceElevated,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={goHome}
          style={({ pressed }) => [
            styles.homeButton,
            {
              borderColor: theme.primary,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: theme.primary }}
          >
            VỀ TRANG CHỦ
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={openTripDetail}
          style={({ pressed }) => [
            styles.tripButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: theme.onPrimary }}
          >
            XEM CHUYẾN ĐI →
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

  flexOne: {
    flex: 1,
  },

  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: Spacing.two,
  },

  headerSpacer: {
    width: 42,
  },

  headerTitleArea: {
    alignItems: 'center',
    flex: 1,
  },

  brand: {
    fontSize: 9,
    fontWeight: '900',
  },

  closeButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
  },

  successArea: {
    alignItems: 'center',
    gap: 9,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },

  successCircleOuter: {
    alignItems: 'center',
    borderRadius: 52,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },

  successCircle: {
    alignItems: 'center',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },

  successTitle: {
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },

  successDescription: {
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },

  statusBadge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  ticketCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 15,
  },

  ticketHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },

  ticketEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  ticketTitle: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 27,
  },

  tripBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  tripBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },

  ticketDivider: {
    borderTopWidth: 1,
    marginVertical: 15,
  },

  qrSection: {
    alignItems: 'center',
    gap: 13,
  },

  qrBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 158,
    justifyContent: 'center',
    width: 158,
  },

  bookingCodeArea: {
    alignItems: 'center',
    gap: 3,
  },

  bookingCodeLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  bookingCode: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },

  details: {
    gap: 11,
  },

  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },

  detailLabel: {
    flex: 1,
  },

  detailValue: {
    flex: 1.35,
    textAlign: 'right',
  },

  escrowCard: {
    alignItems: 'flex-start',
    borderRadius: Radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 14,
  },

  escrowIcon: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  noticeCard: {
    alignItems: 'flex-start',
    borderRadius: Radius.medium,
    flexDirection: 'row',
    gap: 11,
    padding: 14,
  },

  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  secondaryAction: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
  },

  bottomBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
  },

  homeButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },

  tripButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1.25,
    justifyContent: 'center',
    minHeight: 50,
  },
});