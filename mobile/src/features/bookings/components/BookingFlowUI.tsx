import { Button, type ButtonProps } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { StyleSheet } from 'react-native';

export function BookingFlowButton({ style, appearance = 'primary', ...props }: Omit<ButtonProps, 'variant'> & { appearance?: 'primary' | 'outline' | 'quiet' }) {
  const surface = appearance === 'outline' ? { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#868685' } : appearance === 'quiet' ? { backgroundColor: '#e8ebe6' } : null;
  return <Button {...props} variant="secondary" style={[flowStyles.button, surface, style]} />;
}

export const flowStyles = StyleSheet.create({
  canvas: { backgroundColor: '#e8ebe6' },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  card: { backgroundColor: '#ffffff', borderWidth: 0, borderRadius: 24, padding: 24, gap: 16 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: Colors.ink },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: Colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: Colors.body },
  muted: { fontSize: 12, lineHeight: 18, color: '#686b65' },
  money: { fontSize: 28, lineHeight: 36, fontWeight: '900', fontVariant: ['tabular-nums'], color: Colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  inset: { backgroundColor: '#e8ebe6', borderRadius: 16, padding: 16, gap: 8 },
  banner: { borderRadius: 16, padding: 16 },
  button: { backgroundColor: Colors.primary, borderWidth: 0, borderRadius: 24, minHeight: 48 },
  outline: { borderRadius: 24, minHeight: 48 },
  divider: { borderTopWidth: 1, borderTopColor: '#e8ebe6', paddingTop: 16, gap: 8 },
});
