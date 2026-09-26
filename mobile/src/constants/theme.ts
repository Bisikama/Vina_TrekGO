import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17231B',
    background: '#F7F9F7',
    backgroundElement: '#EEF2EE',
    backgroundSelected: '#DCE8DF',
    surfaceElevated: '#FFFFFF',
    textSecondary: '#657168',
    border: '#DCE4DE',
    primary: '#176B3A',
    primaryMuted: '#9AC7A8',
    primarySurface: '#E7F4EB',
    onPrimary: '#FFFFFF',
    onPrimaryMuted: '#DDF4E5',
    primaryDivider: 'rgba(255,255,255,0.35)',
    success: '#176B3A',
    successSurface: '#E7F4EB',
    danger: '#B42318',
    dangerSurface: '#FEECEB',
    onDanger: '#FFFFFF',
  },
  dark: {
    text: '#F1F6F2',
    background: '#0C120E',
    backgroundElement: '#18211B',
    backgroundSelected: '#263B2D',
    surfaceElevated: '#121A15',
    textSecondary: '#AAB7AD',
    border: '#2C3930',
    primary: '#55B879',
    primaryMuted: '#397B50',
    primarySurface: '#173522',
    onPrimary: '#07130B',
    onPrimaryMuted: '#C9ECD5',
    primaryDivider: 'rgba(7,19,11,0.35)',
    success: '#68C889',
    successSurface: '#173522',
    danger: '#FF8A80',
    dangerSurface: '#3B1D1B',
    onDanger: '#2B0906',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
