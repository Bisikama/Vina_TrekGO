import { SurfaceCard } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyTripFilter, MyTripSource, ParticipationGroup } from '../trip-groups';

const OPTIONS: { key: MyTripFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'UPCOMING', label: 'Sắp & đang đi', icon: 'calendar-outline' },
  { key: 'PENDING', label: 'Chờ thanh toán', icon: 'time-outline' },
  { key: 'INVITATIONS', label: 'Lời mời', icon: 'mail-outline' },
  { key: 'HISTORY', label: 'Đã đi', icon: 'checkmark-circle-outline' },
  { key: 'CANCELLED', label: 'Đã hủy', icon: 'close-circle-outline' },
  { key: 'INACTIVE', label: 'Không tham gia', icon: 'person-remove-outline' },
];
export const MY_TRIP_LABELS: Record<MyTripFilter, string> = Object.fromEntries(OPTIONS.map((option) => [option.key, option.label])) as Record<MyTripFilter, string>;
export const MY_TRIP_DESCRIPTIONS: Record<MyTripFilter, string> = {
  UPCOMING: 'Các chuyến sắp khởi hành, đang diễn ra hoặc nhóm riêng đang chuẩn bị.',
  PENDING: 'Các đơn giữ chỗ còn chờ thanh toán. Chuyến chờ duyệt hủy sẽ có thông báo riêng.',
  INVITATIONS: 'Lời mời vé công khai và lời mời chuyến riêng nằm ở đây. Chuyến đã nhận lời mời được hiển thị theo trạng thái tham gia.',
  HISTORY: 'Chỉ gồm các chuyến đã kết thúc mà bạn có vé hoặc tham gia. Không gồm đơn đã hủy, hết hạn hay vắng mặt.',
  CANCELLED: 'Các đặt chỗ, vé hoặc chuyến đi đã hủy. Mở đặt chỗ để theo dõi khoản hoàn liên quan.',
  INACTIVE: 'Đơn giữ chỗ hết hạn, vé vắng mặt hoặc chuyến bạn đã rời nhóm. Các mục này không nằm trong Đã đi.',
};

export function MyTripFilters({ selected, source, counts, onSelect, onSource, onBookings, onTransactions }: {
  selected: MyTripFilter; source: MyTripSource; counts: Record<ParticipationGroup, number>;
  onSelect: (filter: MyTripFilter) => void; onSource: (source: MyTripSource) => void;
  onBookings: () => void; onTransactions: () => void;
}) {
  return <SurfaceCard style={s.card}>
    <Text style={s.label}>Trạng thái chuyến</Text>
    <View style={s.grid}>{OPTIONS.map((option) => {
      const active = selected === option.key;
      return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(option.key)} style={({ pressed }) => [s.cell, active && s.active, pressed && { opacity: 0.8 }]}>
        <View style={s.cellTop}><Ionicons name={option.icon} size={19} color={Colors.ink} />{option.key !== 'INVITATIONS' && <Text style={s.count}>{counts[option.key]}</Text>}</View>
        <Text style={[s.text, active && { fontWeight: '800' }]}>{option.label}</Text>
      </Pressable>;
    })}</View>
    {selected !== 'INVITATIONS' && <View style={{ gap: 6 }}><Text style={s.label}>Loại chuyến</Text><View style={s.sources}>
      {([['ALL', 'Tất cả'], ['PUBLIC', 'Công khai'], ['PRIVATE', 'Riêng']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: source === value }} onPress={() => onSource(value)} style={[s.source, source === value && s.sourceActive]}><Text style={[s.text, source === value && { fontWeight: '800' }]}>{label}</Text></Pressable>)}
    </View></View>}
    <View style={s.actions}>
      <Pressable accessibilityRole="button" onPress={onBookings} style={s.action}><Ionicons name="ticket-outline" size={17} color={Colors.ink} /><Text style={s.actionText}>Đặt chỗ & vé</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onTransactions} style={s.action}><Ionicons name="receipt-outline" size={17} color={Colors.ink} /><Text style={s.actionText}>Thu & hoàn tiền</Text></Pressable>
    </View>
  </SurfaceCard>;
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 24, borderWidth: 0, backgroundColor: '#ffffff', gap: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#454745' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '30%', flexGrow: 1, minHeight: 72, padding: 10, borderRadius: 16, backgroundColor: '#f0f2ed', gap: 8 },
  active: { backgroundColor: '#9fe870' },
  cellTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  count: { fontSize: 11, fontWeight: '700', color: '#163300', fontVariant: ['tabular-nums'] },
  text: { fontSize: 12, lineHeight: 17, color: '#0e0f0c' },
  sources: { flexDirection: 'row', padding: 4, backgroundColor: '#e8ebe6', borderRadius: 24, gap: 4 },
  source: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  sourceActive: { backgroundColor: '#ffffff' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#e8ebe6', paddingTop: 8, gap: 8 },
  action: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#0e0f0c' },
});
