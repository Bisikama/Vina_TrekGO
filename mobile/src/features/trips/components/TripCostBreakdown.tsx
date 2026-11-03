import { Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface CostBreakdownItem {
  icon: string;
  emoji: string;
  title: string;
  description: string;
  unitNote?: string;
}

export interface TripCostBreakdownProps {
  customItems?: CostBreakdownItem[];
  currency?: string;
}

const DEFAULT_BREAKDOWN_ITEMS: CostBreakdownItem[] = [
  {
    icon: "bus-outline",
    emoji: "🚌",
    title: "Di chuyển trung chuyển",
    description: "Xe 16 chỗ đưa đón toàn đoàn khứ hồi từ điểm tập kết tới chân núi",
    unitNote: "Trọn gói toàn chuyến",
  },
  {
    icon: "restaurant-outline",
    emoji: "🍱",
    title: "Ẩm thực dã ngoại & Nước suối",
    description: "Đầy đủ các bữa ăn dã ngoại tươi nóng (Sáng, Trưa, Tối) và nước bù điện giải",
    unitNote: "Tiêu chuẩn 150.000đ/ngày",
  },
  {
    icon: "shield-checkmark-outline",
    emoji: "🛡️",
    title: "Vé VQG & Bảo hiểm du lịch",
    description: "Vé tham quan bảo tồn Vườn Quốc Gia và bảo hiểm tai nạn mạo hiểm hạn mức 100tr",
    unitNote: "Quyền lợi bảo hiểm VFRS",
  },
  {
    icon: "people-outline",
    emoji: "🎒",
    title: "Đội ngũ dẫn đường & Porter",
    description: "Mountain Leader VFRS-L2 chuyên nghiệp và porter địa phương hỗ trợ tải đồ chung",
    unitNote: "Tỷ lệ an toàn 1 Leader : 5 Khách",
  },
];

export function TripCostBreakdown({
  customItems = DEFAULT_BREAKDOWN_ITEMS,
}: TripCostBreakdownProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="receipt-outline" size={20} color="#163300" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <Text style={styles.sectionEyebrow}>MINH BẠCH TÀI CHÍNH</Text>
            <View style={styles.standardBadge}>
              <Text style={styles.standardBadgeText}>TG-PTR-PRICING-01</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Cơ cấu giá vé & Quyền lợi trọn gói</Text>
        </View>
      </View>

      <Text style={styles.sectionSubtitle}>
        Tất cả chi phí đã được tính trọn gói trong giá vé. Không phụ thu ẩn trong suốt hành trình.
      </Text>

      {/* Items List */}
      <View style={styles.itemsList}>
        {customItems.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emojiText}>{item.emoji}</Text>
            </View>

            <View style={styles.itemContent}>
              <View style={styles.itemTopLine}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.includedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#054d28" />
                  <Text style={styles.includedBadgeText}>Đã gồm trong vé</Text>
                </View>
              </View>

              <Text style={styles.itemDesc}>{item.description}</Text>

              {item.unitNote ? (
                <Text style={styles.itemUnitNote}>{item.unitNote}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Transparency Guarantee Banner */}
      <View style={styles.guaranteeBanner}>
        <Ionicons name="shield-checkmark" size={18} color="#054d28" />
        <View style={{ flex: 1 }}>
          <Text style={styles.guaranteeTitle}>Cam kết minh bạch TrekGo</Text>
          <Text style={styles.guaranteeText}>
            Cam kết 100% không phát sinh chi phí hay phụ thu ngoài lộ trình đã công bố.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.xl,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e8ebe6",
    ...Shadows.card,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: "#e2f6d5",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#47672d",
    letterSpacing: 0.8,
  },
  standardBadge: {
    backgroundColor: "#f5f4ee",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  standardBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#717a68",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0e0f0c",
    marginTop: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#454745",
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 17,
  },
  itemsList: {
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f4ee",
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fbf9f3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8ebe6",
  },
  emojiText: {
    fontSize: 18,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  includedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e2f6d5",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  includedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#054d28",
  },
  itemDesc: {
    fontSize: 11,
    color: "#454745",
    marginTop: 4,
    lineHeight: 16,
  },
  itemUnitNote: {
    fontSize: 10,
    fontWeight: "600",
    color: "#47672d",
    marginTop: 3,
  },
  guaranteeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#e2f6d5",
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#c5edab",
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#054d28",
  },
  guaranteeText: {
    fontSize: 11,
    color: "#163300",
    marginTop: 2,
    lineHeight: 15,
  },
});
