import { FieldModal } from '@/components/FieldModal';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { leaderMembers, leaderTrip } from '@/data/fieldOpsMock';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeaderTripScreen() {
  const router = useRouter();
  const { fieldWorkflow, startLeaderTrip, setLeaderMemberAttendance } = useApp();
  const [started, setStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const attendance = leaderMembers.map(member => ({
    ...member,
    statusCode: fieldWorkflow.leaderAttendance.find((item: { memberName: string; status: string }) => item.memberName === member.name)?.status ?? 'PENDING',
  }));
  const checkedIn = attendance.filter(member => member.statusCode === 'CHECKED_IN').length;
  const enoughMembers = attendance.length > 0 && attendance.every(member => member.statusCode !== 'PENDING') && checkedIn > 0;
  const canStart = fieldWorkflow.leaderPretripApproved && enoughMembers;
  const reason = !fieldWorkflow.leaderPretripApproved
    ? 'Cần xác nhận sẵn sàng khởi hành ở màn Pre-trip.'
    : 'Cần xử lý toàn bộ thành viên bằng check-in hoặc no-show trước khi bắt đầu.';

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Header onBack={() => router.back()} /><Text style={styles.eyebrow}>TRIP OPERATIONS</Text><Text style={styles.title}>{leaderTrip.name}</Text><Text style={styles.meta}>{leaderTrip.code} · {leaderTrip.date}</Text>
    <View style={styles.hero}><View><Text style={styles.heroLabel}>CHECK-IN ĐOÀN</Text><Text style={styles.heroValue}>{checkedIn}/{attendance.length}</Text></View><View style={styles.progress}><View style={[styles.progressFill, { width: `${attendance.length ? (checkedIn / attendance.length) * 100 : 0}%` }]} /></View><Text style={styles.heroHint}>Cần xác nhận đủ thành viên trước khi bắt đầu trek.</Text></View>
    <Text style={styles.section}>THÀNH VIÊN & CHECKPOINT</Text><View style={styles.card}>{attendance.map(member => <View key={member.name} style={styles.member}><View style={[styles.dot, member.statusCode !== 'CHECKED_IN' && styles.wait]} /><View style={{ flex: 1 }}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRole}>{member.role}</Text></View><Text style={styles.memberStatus}>{member.statusCode === 'CHECKED_IN' ? 'Đã check-in' : member.statusCode === 'NO_SHOW' ? 'No-show' : 'Chờ xử lý'}</Text>{member.statusCode === 'PENDING' && <TouchableOpacity onPress={() => setLeaderMemberAttendance(member.name, 'CHECKED_IN')}><Ionicons name="checkmark-circle-outline" size={22} color={Colors.primaryDark} /></TouchableOpacity>}</View>)}</View>
    <Text style={styles.section}>GPS SESSION</Text><TouchableOpacity style={styles.feature} onPress={() => router.push('/field-operations/leader-map' as any)}><Ionicons name="navigate-circle" size={25} color={Colors.primaryDark} /><View style={{ flex: 1 }}><Text style={styles.featureTitle}>Theo dõi tuyến và checkpoint</Text><Text style={styles.featureText}>CP03 · Độ cao hiện tại {leaderTrip.altitude}</Text></View><Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} /></TouchableOpacity>
    {!canStart && <Text style={styles.lockReason}>{reason}</Text>}
    <TouchableOpacity disabled={!canStart || isStarting} style={[styles.primary, (!canStart || isStarting) && styles.disabled]} onPress={() => { setIsStarting(true); setTimeout(() => { startLeaderTrip(); setIsStarting(false); setStarted(true); }, 500); }}><Text style={styles.primaryText}>{isStarting ? 'ĐANG KHỞI ĐỘNG...' : 'BẮT ĐẦU CHUYẾN ĐI'}</Text><Ionicons name="play" size={17} color="#fff" /></TouchableOpacity>
  </ScrollView><FieldModal visible={started} title="Trip đã bắt đầu" message="GPS session và chế độ theo dõi thành viên đã được kích hoạt." icon="navigate-circle" actionLabel="Mở bản đồ GPS" onAction={() => { setStarted(false); router.push('/field-operations/leader-map' as any); }} onClose={() => setStarted(false)} /></SafeAreaView>;
}

function Header({ onBack }: { onBack: () => void }) { return <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity><Text style={styles.headerTitle}>Bảng điều khiển</Text><Ionicons name="ellipsis-horizontal" size={22} color={Colors.ink} /></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surface }, content: { padding: 20, paddingBottom: 35 }, header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }, headerTitle: { fontWeight: '800', color: Colors.ink }, eyebrow: { fontSize: 11, color: Colors.primaryDark, fontWeight: '800', letterSpacing: 1 }, title: { fontSize: 28, color: Colors.ink, fontWeight: '800', marginTop: 8 }, meta: { color: Colors.onSurfaceMuted, marginTop: 5 }, hero: { backgroundColor: Colors.inverseSurface, padding: 18, borderRadius: Radius.md, marginTop: 20, ...Shadows.tactical }, heroLabel: { color: Colors.primary, fontSize: 11, fontWeight: '800' }, heroValue: { color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 5 }, progress: { height: 7, backgroundColor: '#425340', borderRadius: 4, marginTop: 14 }, progressFill: { height: 7, backgroundColor: Colors.primary, borderRadius: 4 }, heroHint: { color: '#c1d0bd', fontSize: 12, marginTop: 10 }, section: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: '800', letterSpacing: .8, marginTop: 25, marginBottom: 10 }, card: { backgroundColor: '#fff', borderRadius: Radius.md, paddingHorizontal: 16, ...Shadows.card }, member: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer, gap: 10 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#25a55a' }, wait: { backgroundColor: '#e7a900' }, memberName: { color: Colors.ink, fontWeight: '700', fontSize: 14 }, memberRole: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 2 }, memberStatus: { color: Colors.onSurfaceMuted, fontSize: 11 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#eaf5e1', borderRadius: Radius.sm }, featureTitle: { color: Colors.ink, fontWeight: '800' }, featureText: { color: Colors.body, fontSize: 12, marginTop: 4 }, lockReason: { color: '#9b6700', fontSize: 12, marginTop: 10 }, primary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryDark, borderRadius: Radius.sm, padding: 15, marginTop: 24 }, disabled: { backgroundColor: '#aab3a5' }, primaryText: { color: '#fff', fontWeight: '800' } });
