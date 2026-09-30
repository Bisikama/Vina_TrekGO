import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
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

type BookingReviewScreenProps = {
  tripId: string;
};

type PaymentPlan = 'deposit' | 'full';
type PaymentMethod = 'vietqr' | 'card' | 'wallet';

const tripPrice = 3_450_000;
const voucherDiscount = 150_000;

const moneyFormatter = new Intl.NumberFormat('vi-VN');

function formatMoney(value: number) {
  return `${moneyFormatter.format(value)} ₫`;
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: Parameters<typeof AppSymbol>[0]['name'];
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <ThemedView
      type="surfaceElevated"
      style={[
        styles.sectionCard,
        { borderColor: theme.border },
      ]}
    >
      <View style={styles.sectionHeading}>
        <AppSymbol
          name={icon}
          color={theme.primary}
          size={19}
        />

        <ThemedText style={styles.sectionTitle}>
          {title}
        </ThemedText>
      </View>

      {children}
    </ThemedView>
  );
}

function RadioOption({
  selected,
  title,
  description,
  trailing,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  trailing?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioOption,
        {
          backgroundColor: selected
            ? theme.primarySurface
            : theme.backgroundElement,
          borderColor: selected
            ? theme.primary
            : theme.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected
              ? theme.primary
              : theme.textSecondary,
          },
        ]}
      >
        {selected ? (
          <View
            style={[
              styles.radioInner,
              { backgroundColor: theme.primary },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.flexOne}>
        <ThemedText type="smallBold">
          {title}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          {description}
        </ThemedText>
      </View>

      {trailing ? (
        <ThemedText
          type="smallBold"
          style={{ color: theme.primary }}
        >
          {trailing}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function CostRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.costRow}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.flexOne}
      >
        {label}
      </ThemedText>

      <ThemedText
        type="smallBold"
        style={
          valueColor
            ? { color: valueColor }
            : undefined
        }
      >
        {value}
      </ThemedText>
    </View>
  );
}

function BankTransferCard() {
  const theme = useTheme();

  function copyValue(label: string, value: string) {
    Alert.alert(
      'Đã sao chép',
      `${label}: ${value}`,
    );
  }

  return (
    <View style={styles.bankArea}>
      <View style={styles.qrHeader}>
        <ThemedText
          style={styles.qrLabel}
          themeColor="textSecondary"
        >
          MÃ CHUYỂN KHOẢN VIETQR TỰ ĐỘNG
        </ThemedText>

        <ThemedText
          style={[
            styles.qrTimer,
            { color: theme.danger },
          ]}
        >
          ◷ 14:46
        </ThemedText>
      </View>

      <View
        style={[
          styles.qrCard,
          {
            backgroundColor:
              theme.backgroundElement,
          },
        ]}
      >
        <View
          style={[
            styles.bankLogo,
            { backgroundColor: theme.primary },
          ]}
        >
          <ThemedText
            style={{
              color: theme.onPrimary,
              fontWeight: '900',
            }}
          >
            VietinBank • Napas247
          </ThemedText>
        </View>

        <AppSymbol
          name={{
            ios: 'qrcode',
            android: 'qr_code_2',
            web: 'qr_code_2',
          }}
          color={theme.primaryDark}
          size={132}
        />

        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Quét bằng bất kỳ ứng dụng ngân hàng nào
        </ThemedText>
      </View>

      <View style={styles.bankDetails}>
        <ThemedText
          type="small"
          themeColor="textSecondary"
        >
          Ngân hàng thụ hưởng
        </ThemedText>

        <ThemedText type="smallBold">
          VietinBank (Chi nhánh Tây Hà Nội)
        </ThemedText>

        <View
          style={[
            styles.bankField,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <View style={styles.flexOne}>
            <ThemedText
              style={styles.bankFieldLabel}
              themeColor="textSecondary"
            >
              Số tài khoản Escrow Vina_TrekGo
            </ThemedText>

            <ThemedText type="smallBold">
              1903889902199
            </ThemedText>
          </View>

          <Pressable
            onPress={() =>
              copyValue(
                'Số tài khoản',
                '1903889902199',
              )
            }
          >
            <AppSymbol
              name={{
                ios: 'doc.on.doc',
                android: 'content_copy',
                web: 'content_copy',
              }}
              color={theme.primary}
              size={19}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.bankField,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <View style={styles.flexOne}>
            <ThemedText
              style={styles.bankFieldLabel}
              themeColor="textSecondary"
            >
              Chủ tài khoản thụ hưởng
            </ThemedText>

            <ThemedText type="smallBold">
              CÔNG TY CP VINATREKGO ESCROW
            </ThemedText>
          </View>

          <AppSymbol
            name={{
              ios: 'checkmark.shield.fill',
              android: 'verified_user',
              web: 'verified_user',
            }}
            color={theme.primary}
            size={19}
          />
        </View>

        <View
          style={[
            styles.bankField,
            {
              backgroundColor:
                theme.backgroundElement,
            },
          ]}
        >
          <View style={styles.flexOne}>
            <ThemedText
              style={styles.bankFieldLabel}
              themeColor="textSecondary"
            >
              Nội dung chuyển khoản
            </ThemedText>

            <ThemedText
              type="smallBold"
              style={{ color: theme.danger }}
            >
              TREK FSP 892 HOANG VAN NAM
            </ThemedText>
          </View>

          <Pressable
            onPress={() =>
              copyValue(
                'Nội dung chuyển khoản',
                'TREK FSP 892 HOANG VAN NAM',
              )
            }
          >
            <AppSymbol
              name={{
                ios: 'doc.on.doc',
                android: 'content_copy',
                web: 'content_copy',
              }}
              color={theme.primary}
              size={19}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function BookingReviewScreen({
  tripId,
}: BookingReviewScreenProps) {
  const router = useRouter();
  const theme = useTheme();

  const [paymentPlan, setPaymentPlan] =
    useState<PaymentPlan>('full');

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('vietqr');

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const payableAmount = useMemo(() => {
    const discountedTotal =
      tripPrice - voucherDiscount;

    return paymentPlan === 'deposit'
      ? discountedTotal / 2
      : discountedTotal;
  }, [paymentPlan]);

  function confirmPayment() {
    if (!acceptedTerms) {
      Alert.alert(
        'Chưa xác nhận điều khoản',
        'Bạn cần đọc và đồng ý với chính sách hoàn hủy trước khi tiếp tục.',
      );

      return;
    }

    Alert.alert(
      'Đã xác nhận thanh toán',
      `Hệ thống demo đã ghi nhận ${formatMoney(
        payableAmount,
      )} cho chuyến ${tripId}.`,
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']}>
        <View
          style={[
            styles.topBar,
            {
              borderBottomColor: theme.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow_back',
              }}
              color={theme.text}
              size={22}
            />
          </Pressable>

          <View style={styles.topTitle}>
            <ThemedText style={styles.brandText}>
              Vina_TrekGo
            </ThemedText>

            <ThemedText type="smallBold">
              Đặt chỗ an toàn Escrow
            </ThemedText>
          </View>

          <View
            style={[
              styles.stepBadge,
              {
                backgroundColor:
                  theme.primarySurface,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.stepText,
                { color: theme.primary },
              ]}
            >
              BƯỚC 2/2
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={[
            styles.progressCard,
            {
              backgroundColor:
                theme.primarySurface,
            },
          ]}
        >
          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                {
                  backgroundColor:
                    theme.primary,
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
                size={15}
              />
            </View>

            <View>
              <ThemedText
                style={styles.progressLabel}
                themeColor="textSecondary"
              >
                BƯỚC 1
              </ThemedText>

              <ThemedText type="smallBold">
                Hồ sơ sức khỏe
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.progressDivider,
              {
                backgroundColor:
                  theme.primaryMuted,
              },
            ]}
          />

          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressCircle,
                {
                  backgroundColor:
                    theme.primary,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: theme.onPrimary,
                  fontWeight: '900',
                }}
              >
                2
              </ThemedText>
            </View>

            <View>
              <ThemedText
                style={styles.progressLabel}
                themeColor="textSecondary"
              >
                HIỆN TẠI
              </ThemedText>

              <ThemedText type="smallBold">
                Cọc & Thanh toán
              </ThemedText>
            </View>
          </View>
        </View>

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.tripCard,
            { borderColor: theme.border },
          ]}
        >
          <View style={styles.tripCodeRow}>
            <ThemedText
              style={[
                styles.tripCode,
                { color: theme.primary },
              ]}
            >
              MÃ CHUYẾN: VN-FSP-241118
            </ThemedText>

            <View
              style={[
                styles.levelBadge,
                {
                  backgroundColor:
                    theme.trailOrange,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: theme.onPrimary,
                  fontSize: 9,
                  fontWeight: '900',
                }}
              >
                3N2Đ • CẤP 4/5
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.tripTitle}>
            Chinh phục đỉnh Fansipan qua Sống Lưng
            Trâu 3N2Đ
          </ThemedText>

          <ThemedText type="small">
            ◷ Khởi hành: 05:30 • Thứ 7,
            18/11/2026
          </ThemedText>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Leader phụ trách: Phan Anh Tuấn
            (Chứng chỉ WFA)
          </ThemedText>

          <View
            style={[
              styles.travelerCard,
              {
                backgroundColor:
                  theme.backgroundElement,
              },
            ]}
          >
            <View style={styles.flexOne}>
              <ThemedText
                style={styles.travelerLabel}
              >
                THÀNH VIÊN ĐĂNG KÝ (01)
              </ThemedText>

              <ThemedText type="smallBold">
                Hoàng Văn Nam • CCCD:
                001095012345
              </ThemedText>

              <ThemedText
                type="small"
                style={{ color: theme.danger }}
              >
                Liên hệ khẩn cấp: 0988 765 432
                (Người thân)
              </ThemedText>
            </View>

            <View
              style={[
                styles.healthBadge,
                {
                  backgroundColor:
                    theme.successSurface,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: theme.success,
                  fontSize: 9,
                  fontWeight: '900',
                }}
              >
                Đã duyệt y tế
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        <SectionCard
          title="Chính sách thanh toán"
          icon={{
            ios: 'creditcard.fill',
            android: 'payments',
            web: 'payments',
          }}
        >
          <RadioOption
            selected={paymentPlan === 'deposit'}
            title="Đặt cọc giữ chỗ 50%"
            description="Số tiền còn lại thanh toán trước giờ khởi hành 48 giờ."
            trailing={formatMoney(
              (tripPrice - voucherDiscount) / 2,
            )}
            onPress={() =>
              setPaymentPlan('deposit')
            }
          />

          <RadioOption
            selected={paymentPlan === 'full'}
            title="Thanh toán trọn gói 100%"
            description="Được tặng voucher thuê giày leo núi carbon và ưu đãi tập kết."
            trailing={formatMoney(
              tripPrice - voucherDiscount,
            )}
            onPress={() =>
              setPaymentPlan('full')
            }
          />
        </SectionCard>

        <SectionCard
          title="Bảng tính chi phí chi tiết"
          icon={{
            ios: 'list.clipboard.fill',
            android: 'receipt_long',
            web: 'receipt_long',
          }}
        >
          <CostRow
            label="Giá tour cơ bản (1 Trekker chuẩn)"
            value={formatMoney(tripPrice)}
          />

          <CostRow
            label="Bảo hiểm mạo hiểm VFRS 200 triệu"
            value="ĐÃ BAO GỒM"
            valueColor={theme.success}
          />

          <CostRow
            label="Vé VQG Hoàng Liên Sơn & giám sát"
            value="ĐÃ BAO GỒM"
            valueColor={theme.success}
          />

          <CostRow
            label="Voucher mã giảm giá: VFRS-TREKPRO"
            value={`-${formatMoney(
              voucherDiscount,
            )}`}
            valueColor={theme.danger}
          />

          <View
            style={[
              styles.voucherRow,
              {
                backgroundColor:
                  theme.backgroundElement,
              },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'tag.fill',
                android: 'sell',
                web: 'sell',
              }}
              color={theme.primary}
              size={18}
            />

            <ThemedText
              type="smallBold"
              style={styles.flexOne}
            >
              VFRS-TREKPRO
            </ThemedText>

            <ThemedText
              type="smallBold"
              style={{ color: theme.success }}
            >
              ✓ Đã áp dụng
            </ThemedText>
          </View>

          <View
            style={[
              styles.totalBox,
              {
                backgroundColor:
                  theme.primarySurface,
              },
            ]}
          >
            <View>
              <ThemedText
                style={styles.totalLabel}
                themeColor="textSecondary"
              >
                TỔNG THANH TOÁN BÂY GIỜ
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Đã khấu trừ ưu đãi & mã giảm
              </ThemedText>
            </View>

            <ThemedText
              style={[
                styles.totalValue,
                { color: theme.primary },
              ]}
            >
              {formatMoney(payableAmount)}
            </ThemedText>
          </View>
        </SectionCard>

        <SectionCard
          title="Phương thức thanh toán"
          icon={{
            ios: 'building.columns.fill',
            android: 'account_balance',
            web: 'account_balance',
          }}
        >
          <RadioOption
            selected={
              paymentMethod === 'vietqr'
            }
            title="Chuyển khoản QR Napas247 / VietQR"
            description="Khuyến dùng • Tự động đối soát, kích hoạt vé trong 10 giây."
            onPress={() =>
              setPaymentMethod('vietqr')
            }
          />

          <RadioOption
            selected={
              paymentMethod === 'card'
            }
            title="Thẻ ATM nội địa / Thẻ quốc tế"
            description="Visa / Mastercard • Cổng thanh toán OnePay / VNPAY."
            onPress={() =>
              setPaymentMethod('card')
            }
          />

          <RadioOption
            selected={
              paymentMethod === 'wallet'
            }
            title="Ví điện tử MoMo / ZaloPay"
            description="Thanh toán qua ứng dụng liên kết."
            onPress={() =>
              setPaymentMethod('wallet')
            }
          />
        </SectionCard>

        {paymentMethod === 'vietqr' ? (
          <BankTransferCard />
        ) : (
          <ThemedView
            type="surfaceElevated"
            style={[
              styles.methodPlaceholder,
              { borderColor: theme.border },
            ]}
          >
            <AppSymbol
              name={{
                ios: 'lock.shield.fill',
                android: 'lock',
                web: 'lock',
              }}
              color={theme.primary}
              size={30}
            />

            <ThemedText
              style={styles.placeholderTitle}
            >
              {paymentMethod === 'card'
                ? 'Thanh toán thẻ bảo mật'
                : 'Thanh toán ví điện tử'}
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.placeholderText}
            >
              Giao diện cổng thanh toán sẽ được kết
              nối khi API thanh toán sẵn sàng.
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView
          type="surfaceElevated"
          style={[
            styles.commitmentCard,
            { borderColor: theme.border },
          ]}
        >
          <View style={styles.sectionHeading}>
            <AppSymbol
              name={{
                ios: 'hammer.fill',
                android: 'gavel',
                web: 'gavel',
              }}
              color={theme.primary}
              size={19}
            />

            <ThemedText
              style={styles.sectionTitle}
            >
              Cam kết bảo vệ quyền lợi Escrow VFRS
            </ThemedText>
          </View>

          <ThemedText
            type="small"
            themeColor="textSecondary"
          >
            Toàn bộ tiền cọc được đóng băng an toàn
            trong tài khoản ủy thác Escrow của
            Vina_TrekGo và chỉ giải ngân cho Leader
            sau khi hoàn thành hành trình.
          </ThemedText>

          <View
            style={[
              styles.policyBox,
              {
                backgroundColor:
                  theme.backgroundElement,
              },
            ]}
          >
            <ThemedText type="smallBold">
              Chính sách hủy tour:
            </ThemedText>

            <ThemedText type="small">
              • Hủy trước 7 ngày: hoàn trả 100% tiền
              cọc.
            </ThemedText>

            <ThemedText type="small">
              • Hủy từ 3–7 ngày: hoàn trả 50% tiền
              cọc.
            </ThemedText>

            <ThemedText type="small">
              • Hủy dưới 72 giờ: bảo lưu vé cho lần
              kế tiếp.
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: acceptedTerms,
            }}
            onPress={() =>
              setAcceptedTerms(
                (current) => !current,
              )
            }
            style={styles.termsRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor:
                    acceptedTerms
                      ? theme.primary
                      : 'transparent',
                  borderColor:
                    acceptedTerms
                      ? theme.primary
                      : theme.textSecondary,
                },
              ]}
            >
              {acceptedTerms ? (
                <AppSymbol
                  name={{
                    ios: 'checkmark',
                    android: 'check',
                    web: 'check',
                  }}
                  color={theme.onPrimary}
                  size={14}
                />
              ) : null}
            </View>

            <ThemedText
              type="small"
              style={styles.flexOne}
            >
              Tôi xác nhận đã đọc, hiểu rõ tình
              trạng thể lực cá nhân và đồng ý hoàn
              toàn với Chính sách hoàn hủy & Quy chế
              An toàn VFRS.
            </ThemedText>
          </Pressable>
        </ThemedView>
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
        <View>
          <ThemedText
            style={styles.totalLabel}
            themeColor="textSecondary"
          >
            TỔNG TIỀN
          </ThemedText>

          <ThemedText
            style={[
              styles.bottomTotal,
              { color: theme.primary },
            ]}
          >
            {formatMoney(payableAmount)}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmPayment}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor: acceptedTerms
                ? theme.primary
                : theme.primaryMuted,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: theme.onPrimary }}
          >
            XÁC NHẬN ĐÃ THANH TOÁN →
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

  topBar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: Spacing.two,
  },

  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  topTitle: {
    alignItems: 'center',
    flex: 1,
  },

  brandText: {
    fontSize: 9,
    fontWeight: '900',
  },

  stepBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  stepText: {
    fontSize: 9,
    fontWeight: '900',
  },

  scrollContent: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
  },

  progressCard: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flexDirection: 'row',
    padding: 12,
  },

  progressItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },

  progressCircle: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  progressDivider: {
    height: 2,
    width: 20,
  },

  progressLabel: {
    fontSize: 8,
    fontWeight: '900',
  },

  tripCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },

  tripCodeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tripCode: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  levelBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  tripTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
  },

  travelerCard: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },

  travelerLabel: {
    fontSize: 9,
    fontWeight: '900',
  },

  healthBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  sectionCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },

  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },

  radioOption: {
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },

  radioOuter: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    marginTop: 2,
    width: 20,
  },

  radioInner: {
    borderRadius: Radius.pill,
    height: 10,
    width: 10,
  },

  costRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  voucherRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },

  totalBox: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },

  totalLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  totalValue: {
    fontSize: 22,
    fontWeight: '900',
  },

  bankArea: {
    gap: 10,
  },

  qrHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  qrLabel: {
    fontSize: 9,
    fontWeight: '900',
  },

  qrTimer: {
    fontSize: 11,
    fontWeight: '900',
  },

  qrCard: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    gap: 8,
    padding: 18,
  },

  bankLogo: {
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  bankDetails: {
    gap: 8,
  },

  bankField: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },

  bankFieldLabel: {
    fontSize: 9,
  },

  methodPlaceholder: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: 8,
    padding: Spacing.four,
  },

  placeholderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },

  placeholderText: {
    textAlign: 'center',
  },

  commitmentCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },

  policyBox: {
    borderRadius: 8,
    gap: 4,
    padding: 10,
  },

  termsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },

  checkbox: {
    alignItems: 'center',
    borderRadius: 3,
    borderWidth: 1,
    height: 21,
    justifyContent: 'center',
    marginTop: 2,
    width: 21,
  },

  bottomBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
  },

  bottomTotal: {
    fontSize: 18,
    fontWeight: '900',
  },

  confirmButton: {
    alignItems: 'center',
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
});