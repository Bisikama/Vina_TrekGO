import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import type { SymbolViewProps } from 'expo-symbols';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import {
  Radius,
  Spacing,
} from '@/constants/theme';
import { useSession } from '@/features/session/providers/session-provider';
import { useTheme } from '@/hooks/use-theme';

type TabButtonProps = Omit<
  TabTriggerSlotProps,
  'children'
> & {
  icon: SymbolViewProps['name'];
  label: string;
};

function TabButton({
  icon,
  isFocused,
  label,
  ...props
}: TabButtonProps) {
  const theme = useTheme();

  const color = isFocused
    ? theme.primary
    : theme.textSecondary;

  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && {
          backgroundColor: theme.primarySurface,
        },
        pressed && styles.pressed,
      ]}
    >
      <AppSymbol
        name={icon}
        color={color}
        size={22}
      />

      <Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          {
            color,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TrekkerTabs() {
  const theme = useTheme();
  const { session } = useSession();
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />

      <TabList
        accessibilityLabel={`Điều hướng ${
          session?.role ?? 'TREKKER'
        }`}
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surfaceElevated,
            borderTopColor: theme.border,
            paddingBottom: Math.max(
              insets.bottom,
              Spacing.one,
            ),
          },
        ]}
      >
        <TabTrigger
          name="home"
          href="/"
          asChild
        >
          <TabButton
            label="Trang chủ"
            icon={{
              ios: 'house.fill',
              android: 'home',
              web: 'home',
            }}
          />
        </TabTrigger>

        <TabTrigger
          name="explore"
          href="/explore"
          asChild
        >
          <TabButton
            label="Khám phá"
            icon={{
              ios: 'safari.fill',
              android: 'explore',
              web: 'explore',
            }}
          />
        </TabTrigger>

        <TabTrigger
          name="trips"
          href="/trips"
          asChild
        >
          <TabButton
            label="Chuyến đi"
            icon={{
              ios: 'map.fill',
              android: 'map',
              web: 'map',
            }}
          />
        </TabTrigger>

        <TabTrigger
          name="rentals"
          href="/rentals"
          asChild
        >
          <TabButton
            label="Thuê đồ"
            icon={{
              ios: 'backpack.fill',
              android: 'backpack',
              web: 'backpack',
            }}
          />
        </TabTrigger>

        <TabTrigger
          name="account"
          href="/account"
          asChild
        >
          <TabButton
            label="Cá nhân"
            icon={{
              ios: 'person.crop.circle.fill',
              android: 'account_circle',
              web: 'account_circle',
            }}
          />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  tabBar: {
    minHeight: 64,
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    minHeight: 54,
    marginHorizontal: 2,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
});