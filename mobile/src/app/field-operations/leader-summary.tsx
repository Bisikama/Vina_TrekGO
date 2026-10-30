import { FieldModal } from '@/components/FieldModal';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeaderSummaryScreen() {
  const router = useRouter();
  const {
    activeTrail,
    completeLeaderTrip,
    sendLeaderReport,
    fieldWorkflow,
  } = useApp();
  const [complete, setComplete] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const requiredCheckpointIds = fieldWorkflow.requiredCheckpointIds;
  const completedCheckpointIds = fieldWorkflow.completedCheckpointIds;
  const processedMemberCount = fieldWorkflow.leaderAttendance.filter((member: { memberName: string; status: string }) => member.status !== 'PENDING').length;
  const missingCheckpointIds = useMemo(
    () => requiredCheckpointIds.filter((id: string) => !completedCheckpointIds.includes(id)),
    [requiredCheckpointIds, completedCheckpointIds]
  );
  const canComplete = missingCheckpointIds.length === 0 && !isCompleting;
  const checkpointName = (id: string) => activeTrail.checkpoints.find(checkpoint => checkpoint.id === id)?.name ?? id;

  const handleComplete = () => {
    if (!canComplete) return;
    setIsCompleting(true);
    setTimeout(() => {
      completeLeaderTrip();
      setIsCompleting(false);
      setComplete(true);
    }, 500);
  };

  const handleSendReport = () => {
    if (isSendingReport) return;
    setIsSendingReport(true);
    setTimeout(() => {
      sendLeaderReport();
      setIsSendingReport(false);
    }, 500);
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity><Text style={styles.headerTitle}>Tổng kết & nghiệm thu</Text><View style={{ width: 23 }} /></View>
    <View style={styles.success}><Ionicons name="checkmark-circle" size={42} color={Colors.primary} /><Text style={styles.successTitle}>{fieldWorkflow.leaderReportSent ? 'ĐÃ GỬI BÁO CÁO CHỜ ĐỐI SOÁT' : fieldWorkflow.leaderTripStatus === 'COMPLETED' ? 'CHUYẾN ĐI ĐÃ HOÀN TẤT' : 'CHUYẾN ĐI SẴN SÀNG CHỐT'}</Text><Text style={styles.successText}>{missingCheckpointIds.length === 0 ? 'Tất cả checkpoint bắt buộc đã được ghi nhận.' : 'Chưa thể kết thúc cho đến khi hoàn tất các checkpoint bắt buộc.'}</Text></View>
    <View style={styles.card}>{[['Thành viên đã xử lý', `${processedMemberCount}/${fieldWorkflow.leaderAttendance.length}`], ['Checkpoint đã ghi nhận', `${completedCheckpointIds.length}/${requiredCheckpointIds.length}`], ['Quãng đường thực tế', '16.2 km'], ['Sự cố đang mở', '0']].map(([label, value]) => <View style={styles.row} key={label}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    {missingCheckpointIds.length > 0 && <View style={styles.warning}><Ionicons name="warning-outline" size={21} color="#9b6700" /><View style={{ flex: 1 }}><Text style={styles.warningTitle}>Còn thiếu checkpoint bắt buộc</Text>{missingCheckpointIds.map((id: string) => <Text style={styles.warningText} key={id}>• {checkpointName(id)}</Text>)}</View></View>}
    <Text style={styles.section}>BẰNG CHỨNG HIỆN TRƯỜNG</Text><View style={styles.evidence}><Ionicons name="images-outline" size={28} color={Colors.primaryDark} /><View style={{ flex: 1 }}><Text style={styles.evidenceTitle}>12 ảnh · 3 biên bản</Text><Text style={styles.label}>Đã phân loại theo checkpoint</Text></View><Ionicons name="checkmark-circle" size={21} color={Colors.primaryDark} /></View>
    <TouchableOpacity disabled={!canComplete} style={[styles.primary, !canComplete && styles.disabled]} onPress={handleComplete}><Text style={styles.primaryText}>{isCompleting ? 'ĐANG XÁC NHẬN...' : fieldWorkflow.leaderTripStatus === 'COMPLETED' ? 'ĐÃ XÁC NHẬN KẾT THÚC' : 'XÁC NHẬN KẾT THÚC'}</Text><Ionicons name="checkmark" size={17} color="#fff" /></TouchableOpacity>
    {fieldWorkflow.leaderTripStatus === 'COMPLETED' && !fieldWorkflow.leaderReportSent && <TouchableOpacity disabled={isSendingReport} style={[styles.report, isSendingReport && styles.disabled]} onPress={handleSendReport}><Text style={styles.reportText}>{isSendingReport ? 'ĐANG GỬI...' : 'GỬI BÁO CÁO'}</Text><Ionicons name="send" size={17} color={Colors.primaryDark} /></TouchableOpacity>}
  </ScrollView><FieldModal visible={complete} title="Đã hoàn tất chuyến" message="Trip đã chuyển sang trạng thái hoàn thành. Hãy gửi báo cáo để mở task thu hồi cho Staff Delivery." icon="checkmark-circle" actionLabel="Đã hiểu" onAction={() => setComplete(false)} onClose={() => setComplete(false)} /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surface }, content: { padding: 20, paddingBottom: 35 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }, headerTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800' }, success: { backgroundColor: Colors.inverseSurface, borderRadius: Radius.md, padding: 22, alignItems: 'center' }, successTitle: { color: Colors.primary, fontSize: 16, fontWeight: '800', marginTop: 12 }, successText: { color: '#c1d0bd', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 }, card: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 17, marginTop: 18, ...Shadows.card }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, label: { color: Colors.onSurfaceMuted, fontSize: 13 }, value: { color: Colors.ink, fontWeight: '800', fontSize: 14 }, warning: { flexDirection: 'row', gap: 10, backgroundColor: '#fff3d2', borderRadius: Radius.sm, padding: 14, marginTop: 14 }, warningTitle: { color: '#785000', fontWeight: '800' }, warningText: { color: '#785000', fontSize: 12, marginTop: 4 }, section: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: '800', letterSpacing: .8, marginTop: 25, marginBottom: 10 }, evidence: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#eaf5e1', borderRadius: Radius.sm, padding: 16 }, evidenceTitle: { color: Colors.ink, fontWeight: '800', marginBottom: 4 }, primary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryDark, borderRadius: Radius.sm, padding: 15, marginTop: 25 }, report: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: Radius.sm, padding: 15, marginTop: 10 }, disabled: { backgroundColor: '#aab3a5', borderColor: '#aab3a5' }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' }, reportText: { color: Colors.primaryDark, fontSize: 13, fontWeight: '800' } });
