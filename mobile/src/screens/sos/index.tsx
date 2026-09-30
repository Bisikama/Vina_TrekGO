import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function SosScreen() {
  const router = useRouter();
 const colorScheme = useColorScheme();
const theme =
  colorScheme === 'dark'
    ? Colors.dark
    : Colors.light;

  function sendDemoSos() {
    Alert.alert(
      'Đã tạo tín hiệu SOS demo',
      'Vị trí mẫu đã được gửi đến trung tâm điều phối. Tính năng này hiện chỉ sử dụng mock data.',
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.backIcon,
              {
                color: theme.text,
              },
            ]}
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={[
            styles.headerTitle,
            {
              color: theme.text,
            },
          ]}
        >
          Trung tâm SOS
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.sosMark,
            {
              backgroundColor: theme.danger,
            },
          ]}
        >
          <Text style={styles.sosLabel}>SOS</Text>
        </View>

        <View style={styles.titleGroup}>
          <Text
            style={[
              styles.title,
              {
                color: theme.text,
              },
            ]}
          >
            Bạn đang cần hỗ trợ?
          </Text>

          <Text
            style={[
              styles.description,
              {
                color: theme.textSecondary,
              },
            ]}
          >
            Gửi vị trí hiện tại và tạo yêu cầu hỗ trợ khẩn cấp tới
            trung tâm điều phối TrekGo.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={sendDemoSos}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.danger,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.locationIcon}>⌖</Text>

          <Text style={styles.primaryButtonText}>
            GỬI VỊ TRÍ KHẨN CẤP
          </Text>
        </Pressable>

        <View
          style={[
            styles.notice,
            {
              backgroundColor: theme.warningSurface,
              borderColor: theme.warning,
            },
          ]}
        >
          <Text
            style={[
              styles.noticeTitle,
              {
                color: theme.warning,
              },
            ]}
          >
            Chế độ trình diễn
          </Text>

          <Text
            style={[
              styles.noticeDescription,
              {
                color: theme.textSecondary,
              },
            ]}
          >
            Màn hình đang sử dụng mock data, chưa gọi số khẩn cấp
            và chưa gửi vị trí GPS thật.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    marginTop: -4,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  sosMark: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B42318',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  sosLabel: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  titleGroup: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    maxWidth: 420,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 420,
    minHeight: 58,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  locationIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  notice: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  noticeDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.72,
  },
});