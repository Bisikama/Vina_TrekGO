import { StatusBadge, SurfaceCard } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripParticipation } from '../trip-groups';

type CardEntry = Extract<TripParticipation, { kind: 'ticket' | 'leader' }>;

export function TripParticipationCard({ entry, onPress }: { entry: CardEntry; onPress: () => void }) {
  const trip = entry.kind === 'ticket' ? entry.data.trip : entry.data;
  const checkedIn = entry.kind === 'ticket' && entry.data.checkinStatus === 'CHECKED_IN';
  const inactiveLabel = entry.kind === 'ticket' && (entry.data.checkinStatus === 'NO_SHOW' || entry.data.participantStatus === 'NO_SHOW') ? 'Vắng mặt' : 'Không còn hiệu lực';
  const label = entry.group === 'CANCELLED' ? 'Đã hủy' : entry.group === 'INACTIVE' ? inactiveLabel : entry.group === 'HISTORY' ? checkedIn ? 'Đã đi' : 'Chuyến đã kết thúc' : trip.status === 'CANCEL_PENDING' ? 'Chờ duyệt hủy' : checkedIn ? 'Đã điểm danh' : 'Vé đã nhận';
  const tone = entry.group === 'CANCELLED' ? 'danger' : entry.group === 'INACTIVE' ? 'neutral' : trip.status === 'CANCEL_PENDING' ? 'warning' : 'success';
  const date = new Date(trip.startAt);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${trip.title}. ${label}. Xem chi tiết`} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
    <SurfaceCard style={s.card}>
      <View style={s.row}><Text style={s.eyebrow}>{entry.kind === 'ticket' ? 'VÉ CÁ NHÂN · CÔNG KHAI' : 'CHUYẾN BẠN DẪN'}</Text><StatusBadge label={label} tone={tone} size="sm" /></View>
      <Text style={s.title}>{trip.title}</Text>
      {entry.kind === 'ticket' && <Text style={s.body}>Người tham gia: {entry.data.participantName}</Text>}
      <View style={s.meta}><Ionicons name="calendar-outline" size={16} color="#454745" /><Text style={s.body}>{Number.isNaN(date.getTime()) ? 'Chưa có ngày khởi hành' : date.toLocaleDateString('vi-VN')}</Text></View>
      {trip.destination?.name && <View style={s.meta}><Ionicons name="location-outline" size={16} color="#454745" /><Text style={[s.body, { flex: 1 }]}>{trip.destination.name}</Text></View>}
      <View style={s.footer}><Text style={s.link}>{entry.kind === 'leader' ? 'Quản lý chuyến' : 'Xem chi tiết vé'}</Text><Ionicons name="arrow-forward" size={17} color="#163300" /></View>
    </SurfaceCard>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { padding: 18, borderRadius: 24, borderWidth: 0, backgroundColor: '#ffffff', marginBottom: 12, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#454745' },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 24, color: '#0e0f0c' },
  body: { fontSize: 13, lineHeight: 19, color: '#454745' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { minHeight: 44, borderTopWidth: 1, borderTopColor: '#e8ebe6', paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 13, fontWeight: '700', color: '#163300' },
});
