import { Colors, Radius } from '@/constants/theme';
import { FieldModal } from '@/components/FieldModal';
import { useApp } from '@/context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const safetyOptions = ['Chuyển đường phụ B2 · +1.8km · 1h15', 'Giữ tuyến gốc và gọi VHF kênh 2', 'Kích hoạt điểm tập kết khẩn cấp'];

export default function LeaderSafetyScreen() {
  const router = useRouter();
  const { fieldWorkflow, resolveLeaderSafetyAlert } = useApp();
  const [report, setReport] = useState('');
  const [sent, setSent] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const resolved = fieldWorkflow.leaderSafetyAlert.status === 'RESOLVED';
  const selectedOption = fieldWorkflow.leaderSafetyAlert.selectedOption;
  const handleOptionPress = (index: number) => {
    if (index !== 0 || resolved || isResolving) return;
    setIsResolving(true);
    setTimeout(() => {
      resolveLeaderSafetyAlert('đường phụ B2');
      setIsResolving(false);
    }, 500);
  };

  if (fieldWorkflow.leaderTripStatus !== 'IN_PROGRESS') {
    return <BlockedScreen onBack={() => router.back()} />;
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Header onBack={() => router.back()} title="An toàn & liên lạc" /><View style={styles.alert}><Ionicons name="warning" size={28} color={Colors.error} /><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{resolved ? 'Đã xác nhận an toàn' : 'Đoàn đang lệch 240m so với lộ trình gốc'}</Text><Text style={styles.alertText}>{resolved ? `Đã ghi nhận phương án ${selectedOption}.` : 'Nguyễn Văn A · vị trí cuối: sườn Đông CP02'}</Text></View></View><Text style={styles.section}>PHƯƠNG ÁN XỬ LÝ</Text>{safetyOptions.map((item, index) => <TouchableOpacity key={item} disabled={resolved || isResolving} style={styles.option} onPress={() => handleOptionPress(index)}><View style={[styles.radio, resolved && index === 0 && styles.radioActive]} /><Text style={styles.optionText}>{item}</Text>{index === 0 && isResolving ? <Text style={styles.saving}>Lưu...</Text> : <Ionicons name="chevron-forward" size={17} color={Colors.onSurfaceMuted} />}</TouchableOpacity>)}<Text style={styles.section}>BÁO CÁO SỰ CỐ / KÊNH ĐOÀN</Text><View style={styles.chat}><Text style={styles.chatLabel}>VHF KÊNH 2 · ĐANG KẾT NỐI</Text><Text style={styles.message}>Minh Khoa: Mọi người dừng tại CP02, kiểm tra quân số.</Text><Text style={styles.messageMuted}>Nguyễn Văn A: Đã nhận, tôi đang quay lại tuyến.</Text><TextInput value={report} onChangeText={setReport} placeholder="Nhập thông báo cho đoàn..." placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} /><TouchableOpacity style={styles.send} onPress={() => { setReport(''); setSent(true); }}><Text style={styles.sendText}>GỬI THÔNG BÁO</Text><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity></View></ScrollView><FieldModal visible={sent} title="Đã gửi thông báo" message="Thông báo đã phát trên VHF kênh 2. Các thành viên trong đoàn đã nhận được nội dung." icon="radio-outline" actionLabel="Đã hiểu" onAction={() => setSent(false)} onClose={() => setSent(false)} /></SafeAreaView>;
}

function BlockedScreen({ onBack }: { onBack: () => void }) { return <SafeAreaView style={styles.blocked}><Ionicons name="lock-closed" size={42} color={Colors.primaryDark} /><Text style={styles.blockedTitle}>Chưa bắt đầu chuyến</Text><Text style={styles.blockedText}>Cần bắt đầu trip trước khi xử lý cảnh báo an toàn.</Text><TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backButtonText}>QUAY LẠI</Text></TouchableOpacity></SafeAreaView>; }
function Header({ onBack, title }: { onBack: () => void; title: string }) { return <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity><Text style={styles.headerTitle}>{title}</Text><View style={{ width: 23 }} /></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surface }, content: { padding: 20, paddingBottom: 35 }, blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.surface }, blockedTitle: { color: Colors.ink, fontSize: 24, fontWeight: '800', marginTop: 16 }, blockedText: { color: Colors.body, textAlign: 'center', marginTop: 8 }, backButton: { backgroundColor: Colors.primaryDark, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radius.sm, marginTop: 24 }, backButtonText: { color: '#fff', fontWeight: '800' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }, headerTitle: { color: Colors.ink, fontWeight: '800', fontSize: 17 }, alert: { flexDirection: 'row', gap: 12, backgroundColor: '#ffe8e5', padding: 17, borderRadius: Radius.md }, alertTitle: { color: Colors.error, fontSize: 16, fontWeight: '800', lineHeight: 22 }, alertText: { color: Colors.body, fontSize: 12, marginTop: 5 }, section: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: '800', letterSpacing: .8, marginTop: 25, marginBottom: 10 }, option: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderRadius: Radius.sm, padding: 15, marginBottom: 9 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.onSurfaceMuted }, radioActive: { borderWidth: 5, borderColor: Colors.primaryDark }, optionText: { flex: 1, color: Colors.ink, fontSize: 13, fontWeight: '700' }, saving: { color: Colors.primaryDark, fontSize: 11, fontWeight: '800' }, chat: { backgroundColor: Colors.inverseSurface, padding: 16, borderRadius: Radius.md }, chatLabel: { color: Colors.primary, fontSize: 10, fontWeight: '800', marginBottom: 15 }, message: { color: '#fff', fontSize: 13, padding: 11, backgroundColor: '#294329', borderRadius: 8, marginBottom: 8 }, messageMuted: { color: '#bfd0bb', fontSize: 13, padding: 11, backgroundColor: '#263127', borderRadius: 8 }, input: { color: '#fff', borderWidth: 1, borderColor: '#52624f', borderRadius: 8, padding: 12, marginTop: 14 }, send: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryDark, padding: 13, borderRadius: 8, marginTop: 10 }, sendText: { color: '#fff', fontSize: 12, fontWeight: '800' } });
