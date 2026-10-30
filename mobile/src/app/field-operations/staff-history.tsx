import { Colors, Radius, Shadows } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { deliveryTasks } from '@/data/fieldOpsMock';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Receipt = {
  id: string;
  title: string;
  customer: string;
  completedAt: string;
  photoUri: string | null;
  signed: boolean;
  kind: 'Giao' | 'Thu hồi';
};

export default function StaffHistoryScreen() {
  const router = useRouter();
  const { fieldWorkflow } = useApp();
  const [selected, setSelected] = useState<Receipt | null>(null);
  const completed: Receipt[] = [];
  const deliveryTask = deliveryTasks.find(item => item.type === 'GIAO_THIET_BI');
  const returnTask = deliveryTasks.find(item => item.type === 'THU_HOI');
  if (fieldWorkflow.deliveryStatus === 'COMPLETED' && deliveryTask) completed.push({ id: deliveryTask.id, title: deliveryTask.title, customer: deliveryTask.customer, completedAt: fieldWorkflow.lastUpdated, photoUri: fieldWorkflow.deliveryPhotoUri, signed: fieldWorkflow.deliverySigned, kind: 'Giao' });
  if (fieldWorkflow.returnStatus === 'COMPLETED' && returnTask) completed.push({ id: returnTask.id, title: returnTask.title, customer: returnTask.customer, completedAt: fieldWorkflow.lastUpdated, photoUri: null, signed: fieldWorkflow.returnSigned, kind: 'Thu hồi' });

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity><View><Text style={styles.eyebrow}>TREKOPS DELIVERY</Text><Text style={styles.title}>Lịch sử nhiệm vụ</Text></View><View style={{ width: 23 }} /></View>
    <View style={styles.summary}><View><Text style={styles.summaryValue}>{completed.length}</Text><Text style={styles.summaryLabel}>Task hoàn tất</Text></View><View><Text style={styles.summaryValue}>{completed.length > 0 ? '100%' : '—'}</Text><Text style={styles.summaryLabel}>Có biên nhận</Text></View><Ionicons name="trending-up" size={30} color={Colors.primaryDark} /></View>
    <Text style={styles.section}>BIÊN NHẬN TRONG PHIÊN</Text>
    {completed.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>Chưa có task hoàn tất trong phiên này.</Text></View> : completed.map(item => <TouchableOpacity key={item.id} style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.84}><View style={styles.iconBox}><Ionicons name={item.kind === 'Giao' ? 'cube-outline' : 'return-down-back-outline'} size={21} color={Colors.primaryDark} /></View><View style={styles.cardCopy}><View style={styles.cardTop}><Text style={styles.id}>{item.id}</Text><Text style={styles.status}>Đã hoàn tất</Text></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.customer} · {formatDate(item.completedAt)}</Text></View><Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} /></TouchableOpacity>)}
  </ScrollView><Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={styles.modalBackdrop}><View style={styles.receipt}><Text style={styles.receiptTitle}>Biên nhận {selected?.id}</Text><Text style={styles.receiptRow}>Người nhận: <Text style={styles.receiptValue}>{selected?.customer}</Text></Text><Text style={styles.receiptRow}>Thời gian: <Text style={styles.receiptValue}>{selected ? formatDate(selected.completedAt) : ''}</Text></Text><Text style={styles.receiptRow}>Chữ ký: <Text style={styles.receiptValue}>{selected?.signed ? 'Đã ký xác nhận' : 'Chưa có chữ ký'}</Text></Text>{selected?.photoUri ? <Image source={{ uri: selected.photoUri }} style={styles.receiptPhoto} /> : <View style={styles.noPhoto}><Ionicons name="image-outline" size={25} color={Colors.onSurfaceMuted} /><Text style={styles.emptyText}>Không có ảnh lưu trong phiên</Text></View>}<TouchableOpacity style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeText}>ĐÓNG</Text></TouchableOpacity></View></View></Modal></SafeAreaView>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surface }, content: { padding: 20, paddingBottom: 35 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 }, eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, title: { color: Colors.ink, fontSize: 23, fontWeight: '800', marginTop: 4 }, summary: { flexDirection: 'row', alignItems: 'center', gap: 32, backgroundColor: Colors.inverseSurface, padding: 18, borderRadius: Radius.md, marginBottom: 25 }, summaryValue: { color: Colors.primary, fontSize: 24, fontWeight: '800' }, summaryLabel: { color: '#bfd0bb', fontSize: 11, marginTop: 3 }, section: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: '800', letterSpacing: .8, marginBottom: 10 }, card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: Radius.sm, marginBottom: 9, gap: 12, ...Shadows.card }, iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e9f4de', alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between' }, id: { color: Colors.primaryDark, fontSize: 11, fontWeight: '800' }, status: { color: '#2b8a4b', fontSize: 11, fontWeight: '800' }, cardTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800', marginTop: 5 }, meta: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 5 }, empty: { backgroundColor: '#fff', padding: 20, borderRadius: Radius.sm }, emptyText: { color: Colors.onSurfaceMuted, textAlign: 'center', marginTop: 5 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(14,15,12,.45)', justifyContent: 'center', padding: 20 }, receipt: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 20 }, receiptTitle: { color: Colors.ink, fontSize: 20, fontWeight: '800', marginBottom: 15 }, receiptRow: { color: Colors.body, marginBottom: 10 }, receiptValue: { color: Colors.ink, fontWeight: '700' }, receiptPhoto: { width: '100%', height: 180, borderRadius: 8, marginTop: 8 }, noPhoto: { alignItems: 'center', padding: 20, backgroundColor: Colors.surfaceContainerLow, borderRadius: 8, marginTop: 8 }, closeButton: { alignItems: 'center', backgroundColor: Colors.primaryDark, borderRadius: 8, padding: 13, marginTop: 16 }, closeText: { color: '#fff', fontWeight: '800' } });
