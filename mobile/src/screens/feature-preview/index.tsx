import type { SymbolViewProps } from 'expo-symbols';
import {
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

type FeaturePreviewScreenProps = {
  title: string;
  description: string;
  icon: SymbolViewProps['name'];
};

export function FeaturePreviewScreen({
  title,
  description,
  icon,
}: FeaturePreviewScreenProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'left', 'right']}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: theme.primarySurface,
              },
            ]}
          >
            <AppSymbol
              name={icon}
              color={theme.primary}
              size={32}
            />
          </View>

          <ThemedText style={styles.title}>
            {title}
          </ThemedText>

          <ThemedText
            themeColor="textSecondary"
            style={styles.description}
          >
            {description}
          </ThemedText>

          <View
            style={[
              styles.notice,
              {
                backgroundColor:
                  theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText type="smallBold">
              Đã nối route thành công
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Giao diện đầy đủ của mục này sẽ được
              triển khai ở cụm tiếp theo.
            </ThemedText>
          </View>
        </View>
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
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    textAlign: 'center',
  },
  notice: {
    width: '100%',
    maxWidth: 420,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    gap: Spacing.one,
  },
});