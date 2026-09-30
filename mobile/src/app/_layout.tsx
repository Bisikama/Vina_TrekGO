import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';

import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

import { SessionProvider } from '@/features/session/providers/session-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  return (
    <SessionProvider>
      <ThemeProvider
        value={
          colorScheme === 'dark'
            ? DarkTheme
            : DefaultTheme
        }
      >
        <AnimatedSplashOverlay />

        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />

          <Stack.Screen
            name="sos"
            options={{
              animation:
                'slide_from_bottom',
            }}
          />

          <Stack.Screen
            name="rental-products/[id]"
            options={{
              animation:
                'slide_from_right',
            }}
          />

          <Stack.Screen
            name="bookings/[bookingId]/rentals"
            options={{
              animation:
                'slide_from_right',
            }}
          />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}