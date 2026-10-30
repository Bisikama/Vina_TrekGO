import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { SupportTicketCategory } from "@/types";

type Mode = "FAQ" | "SUPPORT" | "BUG" | "POLICY";

const faqs = [
  { question: "Làm sao xem vé QR của chuyến đi?", answer: "Vào My Trips, chọn chuyến đã xác nhận rồi bấm Vé QR. Vé chỉ dùng cho booking tương ứng." },
  { question: "Khi nào tiền cọc thiết bị được hoàn?", answer: "Sau khi Staff kiểm định thiết bị trả về. Bản demo sẽ hiển thị kết quả hoàn đủ hoặc khấu trừ cọc." },
  { question: "Yêu cầu ghép đoàn được duyệt như thế nào?", answer: "Nếu nhóm dùng chế độ Approval, trưởng nhóm xem hồ sơ thể lực rồi xác nhận. Nhóm Instant cho phép tham gia ngay." },
  { question: "Cung đường cá nhân bị từ chối thì sao?", answer: "Mở Personal Trail, xem phản hồi Admin, chỉnh sửa checkpoint hoặc mô tả rồi gửi xác minh lại." },
];

const categories: { value: SupportTicketCategory; label: string }[] = [
  { value: "BOOKING", label: "Booking" }, { value: "RENTAL", label: "Rental" }, { value: "ACCOUNT", label: "Tài khoản" }, { value: "TECHNICAL", label: "Kỹ thuật" }, { value: "OTHER", label: "Khác" },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const { supportTickets, createSupportTicket } = useApp();
  const [mode, setMode] = useState<Mode>("FAQ");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [category, setCategory] = useState<SupportTicketCategory>("BOOKING");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  function submitTicket(isBug: boolean) {
    if (!subject.trim() || description.trim().length < 10) {
      Alert.alert("Thiếu thông tin", "Nhập tiêu đề và mô tả ít nhất 10 ký tự.");
      return;
    }
    const ticket = createSupportTicket({ category: isBug ? "TECHNICAL" : category, subject, description });
    setSubject(""); setDescription("");
    Alert.alert("Đã gửi yêu cầu", `Mã hỗ trợ ${ticket.id} đã được tạo ở trạng thái SUBMITTED.`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color={Colors.onSurface} /></TouchableOpacity><View style={styles.flexOne}><Text style={styles.headerEyebrow}>TREKGO SUPPORT</Text><Text style={styles.headerTitle}>Trợ giúp & Hỗ trợ</Text></View><View style={styles.headerButton}><Ionicons name="help-circle" size={21} color={Colors.primaryDark} /></View></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}><View style={styles.heroIcon}><Ionicons name="headset" size={28} color={Colors.primary} /></View><View style={styles.flexOne}><Text style={styles.heroTitle}>Ngin cần TrekGo hỗ trợ gì?</Text><Text style={styles.heroText}>Tra cứu hướng dẫn, chính sách hoặc gửi yêu cầu mock cho đội hỗ trợ.</Text></View></View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          <ModeButton label="FAQ" icon="help-outline" selected={mode === "FAQ"} onPress={() => setMode("FAQ")} />
          <ModeButton label="Hỗ trợ" icon="chatbox-ellipses-outline" selected={mode === "SUPPORT"} onPress={() => setMode("SUPPORT")} />
          <ModeButton label="Báo lỗi" icon="bug-outline" selected={mode === "BUG"} onPress={() => setMode("BUG")} />
          <ModeButton label="Chính sách" icon="document-text-outline" selected={mode === "POLICY"} onPress={() => setMode("POLICY")} />
        </ScrollView>

        {mode === "FAQ" ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>{faqs.map((faq, index) => { const open = expandedFaq === index; return <TouchableOpacity key={faq.question} style={styles.faqRow} onPress={() => setExpandedFaq(open ? null : index)} activeOpacity={0.85}><View style={styles.faqTitleRow}><Text style={styles.faqQuestion}>{faq.question}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={17} color={Colors.primaryDark} /></View>{open ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}</TouchableOpacity>; })}</View> : null}

        {mode === "SUPPORT" ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Gửi yêu cầu hỗ trợ</Text><Text style={styles.fieldLabel}>Nhóm vấn đề</Text><View style={styles.categoryRow}>{categories.map((item) => <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.categorySelected]} onPress={() => setCategory(item.value)}><Text style={[styles.categoryText, category === item.value && styles.categoryTextSelected]}>{item.label}</Text></TouchableOpacity>)}</View><TicketFields subject={subject} description={description} onSubject={setSubject} onDescription={setDescription} /><TouchableOpacity style={styles.primaryButton} onPress={() => submitTicket(false)}><Ionicons name="send" size={18} color={Colors.onPrimaryDark} /><Text style={styles.primaryButtonText}>Gửi yêu cầu hỗ trợ</Text></TouchableOpacity></View> : null}

        {mode === "BUG" ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Báo lỗi ứng dụng</Text><View style={styles.notice}><Ionicons name="information-circle-outline" size={19} color={Colors.primaryDark} /><Text style={styles.noticeText}>Mô tả bước gây lỗi, kết quả mong đợi và kết quả thực tế. Ảnh đính kèm sẽ nối Media API sau.</Text></View><TicketFields subject={subject} description={description} onSubject={setSubject} onDescription={setDescription} /><TouchableOpacity style={styles.attachmentButton} onPress={() => Alert.alert("Ảnh đính kèm", "Media picker sẽ được nối sau.")}><Ionicons name="image-outline" size={18} color={Colors.primaryDark} /><Text style={styles.attachmentText}>Thêm ảnh chụp màn hình mock</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} onPress={() => submitTicket(true)}><Ionicons name="bug" size={18} color={Colors.onPrimaryDark} /><Text style={styles.primaryButtonText}>Gửi báo lỗi</Text></TouchableOpacity></View> : null}

        {mode === "POLICY" ? <View><PolicyCard icon="ticket-outline" title="Chính sách Booking" items={["Booking chỉ được xác nhận sau thanh toán thành công.", "Hủy chuyến có thể phát sinh phí theo thời điểm hủy.", "Vé QR gắn với booking và người tham gia."]} /><PolicyCard icon="cube-outline" title="Chính sách Rental" items={["Tiền cọc tách biệt với phí thuê thiết bị.", "Thiết bị được kiểm định khi trả.", "Hư hỏng hoặc thiếu phụ kiện có thể bị khấu trừ cọc."]} /><PolicyCard icon="shield-checkmark-outline" title="Quyền riêng tư & An toàn" items={["Thông tin sức khỏe chỉ phục vụ hỗ trợ an toàn.", "Liên hệ khẩn cấp được dùng khi có sự cố.", "Người dùng chịu trách nhiệm về nội dung Community đã đăng."]} /></View> : null}

        {supportTickets.length ? <View style={styles.ticketHistory}><Text style={styles.sectionTitle}>Yêu cầu vừa gửi</Text>{supportTickets.slice(0, 3).map((ticket) => <View key={ticket.id} style={styles.ticketRow}><View style={styles.ticketIcon}><Ionicons name="receipt-outline" size={17} color={Colors.primaryDark} /></View><View style={styles.flexOne}><Text style={styles.ticketTitle}>{ticket.subject}</Text><Text style={styles.ticketMeta}>{ticket.id} · {ticket.createdAt}</Text></View><Text style={styles.ticketStatus}>SUBMITTED</Text></View>)}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ label, icon, selected, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void }) { return <TouchableOpacity style={[styles.modeButton, selected && styles.modeSelected]} onPress={onPress}><Ionicons name={icon} size={17} color={selected ? Colors.onPrimaryDark : Colors.primaryDark} /><Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text></TouchableOpacity>; }
function TicketFields({ subject, description, onSubject, onDescription }: { subject: string; description: string; onSubject: (value: string) => void; onDescription: (value: string) => void }) { return <><Text style={styles.fieldLabel}>Tiêu đề</Text><TextInput value={subject} onChangeText={onSubject} placeholder="Ví dụ: Không xem được vé QR" placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} /><Text style={styles.fieldLabel}>Mô tả chi tiết</Text><TextInput value={description} onChangeText={onDescription} placeholder="Mô tả vấn đề bạn đang gặp..." placeholderTextColor={Colors.onSurfaceMuted} multiline textAlignVertical="top" style={[styles.input, styles.textArea]} /></>; }
function PolicyCard({ icon, title, items }: { icon: keyof typeof Ionicons.glyphMap; title: string; items: string[] }) { return <View style={styles.sectionCard}><View style={styles.policyHeader}><View style={styles.policyIcon}><Ionicons name={icon} size={20} color={Colors.primaryDark} /></View><Text style={styles.sectionTitle}>{title}</Text></View>{items.map((item) => <View key={item} style={styles.policyRow}><View style={styles.policyDot} /><Text style={styles.policyText}>{item}</Text></View>)}</View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, flexOne: { flex: 1 }, header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" }, content: { padding: 14, paddingBottom: 44 }, heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card }, heroIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: "rgba(159,232,112,0.12)" }, heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" }, heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  modeRow: { paddingTop: 12, gap: 7 }, modeButton: { minHeight: 40, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.primaryNeutral, borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, modeSelected: { backgroundColor: Colors.primaryDark }, modeText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" }, modeTextSelected: { color: Colors.onPrimaryDark }, sectionCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" }, faqRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, faqTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, faqQuestion: { flex: 1, color: Colors.onSurface, fontSize: 9, fontWeight: "900" }, faqAnswer: { marginTop: 8, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 14 }, fieldLabel: { marginTop: 13, marginBottom: 6, color: Colors.onSurface, fontSize: 9, fontWeight: "900" }, categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, categoryChip: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, categorySelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale }, categoryText: { color: Colors.onSurfaceVariant, fontSize: 7, fontWeight: "800" }, categoryTextSelected: { color: Colors.primaryDark }, input: { minHeight: 45, paddingHorizontal: 12, color: Colors.onSurface, fontSize: 9, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow }, textArea: { minHeight: 110, paddingTop: 12 }, notice: { marginTop: 11, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale }, noticeText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 13 }, attachmentButton: { minHeight: 44, marginTop: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: Colors.primaryNeutral, borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, attachmentText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" }, primaryButton: { minHeight: 50, marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover }, primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "900" }, policyHeader: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 9 }, policyIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale }, policyRow: { marginTop: 9, flexDirection: "row", alignItems: "flex-start", gap: 8 }, policyDot: { width: 6, height: 6, marginTop: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryDark }, policyText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 13 }, ticketHistory: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, ticketRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, ticketIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale }, ticketTitle: { color: Colors.onSurface, fontSize: 9, fontWeight: "900" }, ticketMeta: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7 }, ticketStatus: { color: Colors.primaryDark, fontSize: 6, fontWeight: "900" },
});
