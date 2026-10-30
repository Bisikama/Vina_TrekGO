export const Colors = {
  // Brand colors from DESIGN-wise & Alpine Fin-Tech Trek
  primary: '#9fe870',          // Electric Lime Green brand accent
  onPrimary: '#0e0f0c',        // Ink on primary
  primaryActive: '#cdffad',
  primaryNeutral: '#c5edab',
  primaryPale: '#e2f6d5',
  primaryDark: '#63ad29',      // Alpine Forest Green
  onPrimaryDark: '#ffffff',
  primaryContainer: '#9fe870',
  onPrimaryContainer: '#2e6900',
  
  // Surfaces & Canvas (Sage / Nordic warm tint)
  surface: '#fbf9f3',          // Canvas soft background
  surfaceDim: '#dbdad4',
  surfaceBright: '#fbf9f3',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f4ee',
  surfaceContainer: '#efeee8',
  surfaceContainerHigh: '#eae8e2',
  surfaceContainerHighest: '#e4e2dd',
  
  // Inks & Text
  ink: '#0e0f0c',
  inkDeep: '#163300',
  onSurface: '#1b1c19',
  onSurfaceVariant: '#41493a',
  onSurfaceMuted: '#717a68',
  body: '#454745',
  mute: '#868685',
  
  // Inverse
  inverseSurface: '#30312d',
  inverseOnSurface: '#f2f1eb',
  
  // Functional & Semantic
  positive: '#2ead4b',
  positiveDeep: '#054d28',
  secondary: '#47672d',
  secondaryContainer: '#c5eba3',
  onSecondaryContainer: '#4b6c31',
  secondaryFixed: '#c8eea5',
  onSecondaryFixed: '#0c2000',
  
  // Warning / Milestones / Elevation
  tertiary: '#725c00',
  tertiaryContainer: '#fed018',
  onTertiaryContainer: '#6f5900',
  tertiaryFixed: '#ffe082',
  onTertiaryFixedVariant: '#564500',
  warning: '#ffd11a',
  warningDeep: '#b86700',
  
  // Critical / Deviation Alert / Danger
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  negative: '#d03238',
  negativeBg: '#320707',
  
  // Tactical Pathing & HUD
  pathPlanned: '#ffffff',
  pathActual: '#38ef7d',       // Neon emerald
  pathDeviation: '#fed018',    // Tactical yellow warning
  mapBackground: '#141d13',    // Dark tactical forest
  mapContour: '#9fe870',
};

export const Typography = {
  fontFamily: {
    display: 'Roboto, system-ui, sans-serif',
    body: 'Roboto, system-ui, sans-serif',
  },
  fontSize: {
    displayMega: 44,
    headlineLg: 32,
    headlineMd: 22,
    headlineSm: 18,
    bodyLg: 16,
    bodyMd: 14,
    bodySm: 12,
    labelSm: 10,
  },
  lineHeightMultiplier: 1.5,
  lineHeight: {
    displayMega: 66,
    headlineLg: 48,
    headlineMd: 33,
    headlineSm: 27,
    bodyLg: 24,
    bodyMd: 21,
    bodySm: 18,
    labelSm: 15,
  },
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,      // Signature 24px rounded card
  pill: 9999,  // Signature pill buttons per DESIGN-wise.md
  full: 9999,  // Signature pill buttons
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  hover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tactical: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
};
