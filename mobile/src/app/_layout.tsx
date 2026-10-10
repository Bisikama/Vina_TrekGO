import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';

import {
  useColorScheme,
} from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#000' : '#FFF' }} edges={['top']}>
        <ThemeProvider
          value={
            colorScheme === 'dark'
              ? DarkTheme
              : DefaultTheme
          }
        >
      <AnimatedSplashOverlay />

      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />

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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}