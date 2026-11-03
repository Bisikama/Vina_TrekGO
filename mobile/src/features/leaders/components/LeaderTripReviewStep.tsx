import { Trip3DMapView } from "@/components/Trip3DMapView";
import { Colors, Radius, Shadows } from "@/constants/theme";
import type {
  TripOptionCheckpoint,
  TripOptionDestination,
  TripOptionPickupPoint,
} from "@/features/leaders/hooks";
import type { CostItem } from "@/features/leaders/services/leader-pricing.api";
import {
  calculateTripDuration,
  getDayOfWeekName,
  parseVnDate,
} from "@/features/leaders/utils/tripDateUtils";
import { CostPlanBuilder } from "./CostPlanBuilder";
import type { LeaderTripFormData } from "./LeaderTripFormStep";
import { TrekkingPricingSimulator } from "./TrekkingPricingSimulator";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface LeaderTripReviewStepProps {
  form: LeaderTripFormData;
  tripId?: string;
  expectedVersion?: number;
  accessToken?: string;
  costItems: CostItem[];
  onChangeCostItems: (items: CostItem[]) => void;
  selectedDestination?: TripOptionDestination;
  selectedPickup?: TripOptionPickupPoint;
  selectedCheckpoints: TripOptionCheckpoint[];
  selectedTrail?: any;
  conflictWarning?: string | null;
  submitError?: string | null;
  readinessIssues?: string[];
  canPublish?: boolean;
  isSubmitting: boolean;
  apiLoading: boolean;
  onPublish: () => void;
  onBackToForm: () => void;
  onBackToStep1?: () => void;
  onPriceConfirmed: (
    confirmedPrice: number,
    minPax: number,
    explanation: string,
    newVersion: number,
  ) => void;
  isPriceConfirmed: boolean;
  confirmedPriceExplanation?: string | null;
  onVersionUpdated?: (newVersion: number) => void;
  onUpdateDescription?: (desc: string) => void;
  onSaveDraft?: () => void;
}

const RENTAL_GEAR_TAGS = [
  "+ Balo trekking",
  "+ Chiếu sáng và nguồn điện",
  "+ Giày leo núi",
  "+ Gậy trekking",
  "+ Lều và mái che",
  "+ Nấu ăn và xử lý nước",
  "+ Phụ kiện sinh tồn và định hướng",
  "+ Túi ngủ và đệm cách nhiệt",
  "+ Áo mưa và chống thời tiết",
];

export function LeaderTripReviewStep({
  form,
  tripId = "",
  expectedVersion = 1,
  accessToken = "",
  costItems,
  onChangeCostItems,
  selectedDestination,
  selectedPickup,
  selectedCheckpoints,
  selectedTrail,
  conflictWarning,
  submitError,
  readinessIssues = [],
  canPublish = false,
  isSubmitting,
  apiLoading,
  onPublish,
  onBackToForm,
  onBackToStep1,
  onPriceConfirmed,
  isPriceConfirmed,
  confirmedPriceExplanation,
  onVersionUpdated,
  onUpdateDescription,
  onSaveDraft,
}: LeaderTripReviewStepProps) {
  const isLoading = isSubmitting || apiLoading;

  // Local state for description editing and markdown tab
  const [descTab, setDescTab] = useState<"edit" | "preview">("edit");
  const [descriptionText, setDescriptionText] = useState(form.description || "");

  const durationInfo = useMemo(() => {
    const start = parseVnDate(form.startDate);
    const end = parseVnDate(form.endDate);
    if (start && end && end.getTime() >= start.getTime()) {
      return calculateTripDuration(start, end);
    }
    return null;
  }, [form.startDate, form.endDate]);

  const startDay = useMemo(() => {
    const d = parseVnDate(form.startDate);
    return d ? getDayOfWeekName(d) : "";
  }, [form.startDate]);

  const endDay = useMemo(() => {
    const d = parseVnDate(form.endDate);
    return d ? getDayOfWeekName(d) : "";
  }, [form.endDate]);

  const minPaxNum = parseInt(form.minPax || "5", 10) || 5;
  const maxPaxNum = parseInt(form.slots || "15", 10) || 15;
  const initialPriceNum = parseInt(form.price || "2850000", 10) || 2850000;

  // Append a gear tag to the description
  const handleAddGearTag = (tag: string) => {
    const cleanTag = tag.replace(/^\+\s*/, "");
    const appended = descriptionText
      ? `${descriptionText}\n- Khuyến nghị thuê trang bị: ${cleanTag}`
      : `- Khuyến nghị thuê trang bị: ${cleanTag}`;
    setDescriptionText(appended);
    if (onUpdateDescription) onUpdateDescription(appended);
  };

  // Generate standard itinerary template
  const handleApplyDescriptionTemplate = () => {
    const destName = selectedDestination?.name || "Khu bảo tồn thiên nhiên";
    const trailName = selectedTrail?.name || "Cung đường trekking tiêu chuẩn";
    const cpNames = selectedCheckpoints.length > 0
      ? selectedCheckpoints.map((c) => c.name).join(" → ")
      : "Các trạm kiểm soát VFRS";

    const template = `# 🏔️ Hành Trình Chinh Phục: ${form.name || destName}

## 📅 Lịch trình tổng quan
- **Ngày khởi hành**: ${form.startDate || "Chưa định"} (${startDay || "Thứ Bảy"} • ${form.departureTime || "05:30"})
- **Ngày kết thúc**: ${form.endDate || "Chưa định"} (${endDay || "Chủ Nhật"} • 18:00)
- **Điểm tập kết toàn đoàn**: ${form.departureTime || "05:30"} tại ${selectedPickup?.name || "Cổng KDL"}
- **Quy mô đoàn**: ${minPaxNum} - ${maxPaxNum} thành viên (Tối thiểu ${minPaxNum} để xuất phát)

## 🗺️ Cung đường & Trắc địa
- **Tuyến đường**: ${trailName}
- **Cự ly**: ${selectedTrail?.distanceKm || "5.0"} km • Cao độ: +${selectedTrail?.elevationGainM || 500}m
- **Trạm dừng an toàn**: ${cpNames}

## 🎒 Trang bị khuyến nghị thành viên cần chuẩn bị
- Balo trekking chuyên dụng 35L - 50L có trợ lực
- Giày leo núi bám dốc, gậy trekking
- Đèn pin cá nhân, sạc dự phòng dung lượng cao
- Lều cắm trại 2 lớp chống mưa, túi ngủ cá nhân
- Bình lọc nước dã ngoại, viên bù điện giải

*Lưu ý an toàn: Toàn bộ thành viên bắt buộc check-in GPS tại các cột mốc đã định theo Quy chuẩn an toàn VFRS.*`;

    setDescriptionText(template);
    if (onUpdateDescription) onUpdateDescription(template);
    Alert.alert("Đã áp dụng mẫu mô tả", "Nội dung lịch trình chuẩn đã được tự động điền đầy đủ thông tin từ Bước 1 & Bước 2.");
  };

  const handleSaveDescription = () => {
    if (onUpdateDescription) onUpdateDescription(descriptionText);
    Alert.alert("Thành công", "Đã lưu nội dung mô tả & lịch trình chuyến đi.");
  };

  return (
    <View style={styles.container}>
      {/* ─── Header & Stepper ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBackToForm} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#121c2a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Xem lại hồ sơ & Công khai chuyến đi</Text>
            <Text style={styles.headerSubtitle}>BƯỚC 3/3 · KIỂM DUYỆT & XUẤT BẢN</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.draftTopBtn}
          onPress={onSaveDraft || (() => Alert.alert("Đã lưu nháp", "Bản nháp đã được lưu vào hệ thống."))}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmark-outline" size={14} color="#0e0f0c" />
          <Text style={styles.draftTopBtnText}>Lưu bản nháp</Text>
        </TouchableOpacity>
      </View>

      {/* 3-Step Stepper Header */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperItemDone}>
          <Ionicons name="checkmark-circle" size={16} color="#0e0f0c" />
          <Text style={styles.stepperItemTextDone} numberOfLines={1}>
            1. Thông tin cơ bản & Lịch trình
          </Text>
        </View>
        <View style={styles.stepperItemDone}>
          <Ionicons name="checkmark-circle" size={16} color="#0e0f0c" />
          <Text style={styles.stepperItemTextDone} numberOfLines={1}>
            2. Cung đường & Trạm dừng
          </Text>
        </View>
        <View style={styles.stepperItemActive}>
          <View style={styles.activeStepBadge}>
            <Text style={styles.activeStepBadgeText}>3</Text>
          </View>
          <Text style={styles.stepperItemTextActive} numberOfLines={1}>
            3. Xem lại & Công khai
          </Text>
        </View>
      </View>

      {/* ─── Điều kiện xuất bản (Pre-publish Readiness Check) ─── */}
      <View style={styles.readinessCard}>
        <View style={styles.readinessHeader}>
          <Ionicons
            name={canPublish ? "shield-checkmark" : "alert-circle"}
            size={18}
            color={canPublish ? "#125238" : "#d97706"}
          />
          <Text style={styles.readinessTitle}>Điều kiện xuất bản (Pre-publish Readiness Check)</Text>
        </View>

        {canPublish ? (
          <View style={styles.readinessPassBox}>
            <Ionicons name="checkmark-circle" size={24} color="#0e0f0c" />
            <View style={{ flex: 1 }}>
              <Text style={styles.readinessPassTitle}>Đủ điều kiện xuất bản</Text>
              <Text style={styles.readinessPassSub}>
                Hồ sơ chuyến đi đã đạt đầy đủ quy chuẩn an toàn VFRS. Bạn có thể mở bán công khai ngay.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.readinessWarnBox}>
            <View style={styles.warnBadgeCircle}>
              <Text style={styles.warnBadgeText}>Cần bổ sung</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readinessWarnTitle}>Chưa đạt điều kiện xuất bản</Text>
              <Text style={styles.readinessWarnSub}>
                Vui lòng xem lại danh sách kiểm tra bên dưới trước khi công khai.
              </Text>
            </View>
          </View>
        )}

        {/* Readiness Checklist */}
        {!canPublish && (
          <View style={styles.checklistWrap}>
            <View style={styles.checkItemRow}>
              <Ionicons
                name={isPriceConfirmed ? "checkmark-circle" : "close-circle"}
                size={15}
                color={isPriceConfirmed ? "#125238" : "#ba1a1a"}
              />
              <Text style={[styles.checkItemText, !isPriceConfirmed && { color: "#ba1a1a" }]}>
                {isPriceConfirmed
                  ? "Đã chốt giá vé & mô phỏng tài chính thành công."
                  : "Cần hoàn tất lập ngân sách định giá hoặc bổ sung cơ sở tính giá trước khi publish."}
              </Text>
            </View>
            <View style={styles.checkItemRow}>
              <Ionicons
                name={selectedTrail && selectedCheckpoints.length > 0 ? "checkmark-circle" : "alert-circle"}
                size={15}
                color={selectedTrail && selectedCheckpoints.length > 0 ? "#125238" : "#d97706"}
              />
              <Text style={[styles.checkItemText, (!selectedTrail || selectedCheckpoints.length === 0) && { color: "#d97706" }]}>
                {selectedTrail && selectedCheckpoints.length > 0
                  ? `Đã chọn cung đường ${selectedTrail.name} (${selectedCheckpoints.length} trạm an toàn).`
                  : "Cần hoàn thiện cung đường & trạm dừng ở Bước 2."}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── MỤC 01 · THÔNG TIN ĐOÀN: Chi tiết chuyến đi & Quy mô ─── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>MỤC 01 · THÔNG TIN ĐOÀN</Text>
            <Text style={styles.sectionTitle}>Chi tiết chuyến đi & Quy mô</Text>
          </View>
          <TouchableOpacity
            style={styles.editStepBtn}
            onPress={onBackToStep1 || onBackToForm}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={13} color="#0e0f0c" />
            <Text style={styles.editStepBtnText}>Chỉnh sửa Bước 1</Text>
          </TouchableOpacity>
        </View>

        {/* Destination Thumbnail Card */}
        <View style={styles.destSummaryRow}>
          <Image
            source={{
              uri: (selectedDestination as any)?.imageUrl ||
                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
            }}
            style={styles.destThumb}
          />
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View style={styles.destBadgeRow}>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>Cấp 3 - Vừa phải</Text>
              </View>
              <Text style={styles.destCodeText}>
                #{tripId ? tripId.slice(0, 8) : "2a48e61f"}
              </Text>
            </View>
            <Text style={styles.tripH1Title}>{form.name || "Chuyến đi mới"}</Text>
            <View style={styles.vfrsTagRow}>
              <Ionicons name="shield-checkmark" size={12} color="#0e0f0c" />
              <Text style={styles.vfrsTagText}>Công khai VFRS · Đạt chuẩn</Text>
            </View>
          </View>
        </View>

        {/* Mô tả chi tiết & Lịch trình chuyến đi */}
        <View style={styles.itineraryBox}>
          <View style={styles.itineraryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itineraryTitle}>Mô tả chi tiết & Lịch trình chuyến đi</Text>
              <Text style={styles.itinerarySub}>Nội dung giới thiệu công khai cho trekker khi đặt tour.</Text>
            </View>
            <View style={styles.itineraryActions}>
              <TouchableOpacity
                style={styles.templateActionBtn}
                onPress={handleApplyDescriptionTemplate}
                activeOpacity={0.8}
              >
                <Text style={styles.templateActionBtnText}>🌿 Dùng mẫu mô tả</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveDescActionBtn}
                onPress={handleSaveDescription}
                activeOpacity={0.8}
              >
                <Text style={styles.saveDescActionBtnText}>Lưu mô tả</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Gợi ý danh mục đồ thuê cho thành viên */}
          <View style={styles.rentalTagsSection}>
            <Text style={styles.rentalTagsTitle}>Gợi ý danh mục đồ thuê cho thành viên:</Text>
            <Text style={styles.rentalTagsSub}>Chạm vào thẻ tag để tự động chèn vào mô tả chuyến đi</Text>
            <View style={styles.tagsFlexWrap}>
              {RENTAL_GEAR_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.rentalTagChip}
                  onPress={() => handleAddGearTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rentalTagChipText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Editor Toolbar & Tabs */}
          <View style={styles.editorToolbar}>
            <View style={styles.editorToolsLeft}>
              <Text style={styles.toolIcon}>B</Text>
              <Text style={styles.toolIcon}>I</Text>
              <Text style={styles.toolIcon}>U</Text>
              <Text style={styles.toolIcon}>🔗</Text>
              <Text style={styles.toolIcon}>• List</Text>
            </View>
            <View style={styles.editorTabs}>
              <TouchableOpacity
                style={[styles.editorTab, descTab === "edit" && styles.editorTabActive]}
                onPress={() => setDescTab("edit")}
              >
                <Text style={[styles.editorTabText, descTab === "edit" && styles.editorTabTextActive]}>
                  Soạn thảo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editorTab, descTab === "preview" && styles.editorTabActive]}
                onPress={() => setDescTab("preview")}
              >
                <Text style={[styles.editorTabText, descTab === "preview" && styles.editorTabTextActive]}>
                  Xem trước
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Input / Preview Area */}
          {descTab === "edit" ? (
            <TextInput
              style={styles.descInputArea}
              value={descriptionText}
              onChangeText={(txt) => {
                setDescriptionText(txt);
                if (onUpdateDescription) onUpdateDescription(txt);
              }}
              placeholder='Bấm "🌿 Dùng mẫu mô tả" phía trên để tự động tạo bài viết từ thông tin chuyến đi...'
              placeholderTextColor="#707972"
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.descPreviewArea}>
              <Text style={styles.descPreviewText}>
                {descriptionText || "Chưa có nội dung mô tả chuyến đi."}
              </Text>
            </View>
          )}

          {/* Editor Tip Box */}
          <View style={styles.editorTipBox}>
            <Text style={styles.editorTipText}>
              💡 <Text style={{ fontWeight: "700" }}>Mẹo: </Text>
              Hệ thống tự động gom toàn bộ thông tin từ Bước 1 (ngày đi, giờ đón, điểm tập kết, giá vé) và Bước 2 (cung đường, trạm checkpoint, cự ly km) để điền vào bài viết. Bạn có thể tự do chỉnh sửa câu chữ cho phù hợp trước khi xuất bản!
            </Text>
          </View>
        </View>

        {/* 3 Info Blocks at the bottom of Section 1 */}
        <View style={styles.threeInfoGrid}>
          <View style={styles.infoColCard}>
            <Text style={styles.infoColLabel}>Thời gian thực hiện</Text>
            <Text style={styles.infoColVal}>
              {form.startDate || "Chưa định"} - {form.endDate || "Chưa định"}
            </Text>
            <Text style={styles.infoColSub}>{durationInfo?.text || "2 ngày"}</Text>
          </View>

          <View style={styles.infoColCard}>
            <Text style={styles.infoColLabel}>Quy mô đoàn</Text>
            <Text style={styles.infoColVal}>{minPaxNum} - {maxPaxNum} người</Text>
            <Text style={styles.infoColSub}>Slots: 0/{maxPaxNum} (Tối thiểu {minPaxNum})</Text>
          </View>

          <View style={styles.infoColCard}>
            <Text style={styles.infoColLabel}>Chính sách hủy</Text>
            <Text style={[styles.infoColVal, { color: "#0e0f0c" }]}>Linh hoạt</Text>
            <Text style={styles.infoColSub}>Hoàn 100% trước 7 ngày</Text>
          </View>
        </View>

        <Text style={styles.pickupFooterText}>
          * <Text style={{ fontWeight: "700" }}>Điểm tập kết: </Text>
          {form.departureTime || "07:00"} tại {selectedPickup?.name || "Điểm tập kết toàn đoàn"}
        </Text>
      </View>

      {/* ─── MỤC 02 · BẢN ĐỒ & TRẮC ĐỊA: Cung đường & Lộ trình chi tiết ─── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>MỤC 02 · BẢN ĐỒ & TRẮC ĐỊA</Text>
            <Text style={styles.sectionTitle}>Cung đường & Lộ trình chi tiết</Text>
          </View>
          <TouchableOpacity
            style={styles.editStepBtn}
            onPress={onBackToForm}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={13} color="#0e0f0c" />
            <Text style={styles.editStepBtnText}>Chỉnh sửa Bước 2</Text>
          </TouchableOpacity>
        </View>

        {/* Trail Banner */}
        <View style={styles.trailBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trailBannerTitle}>
              ~ Cung đường: {selectedTrail?.name || "HBS - La Bàn"}
            </Text>
            <Text style={styles.trailBannerSub}>
              Mã quản lý: #{selectedTrail?.id ? selectedTrail.id.slice(0, 8) : "2a48e61f"} • Cự ly: {selectedTrail?.distanceKm || selectedTrail?.lengthKm || "5"} km
            </Text>
          </View>
          <View style={styles.verifiedBadgeDark}>
            <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
            <Text style={styles.verifiedBadgeDarkText}>VFRS Verified</Text>
          </View>
        </View>

        {/* 4 Stats Tiles */}
        <View style={styles.fourStatsRow}>
          <View style={styles.fourStatCell}>
            <Text style={styles.fourStatLabel}>Tổng cự ly</Text>
            <Text style={styles.fourStatVal}>
              {selectedTrail?.distanceKm || selectedTrail?.lengthKm || "5"} km
            </Text>
          </View>
          <View style={styles.fourStatCell}>
            <Text style={styles.fourStatLabel}>Độ khó</Text>
            <Text style={[styles.fourStatVal, { color: "#b45309" }]}>
              {selectedTrail?.difficulty || "MEDIUM"}
            </Text>
          </View>
          <View style={styles.fourStatCell}>
            <Text style={styles.fourStatLabel}>Cao độ đỉnh</Text>
            <Text style={styles.fourStatVal}>
              +{selectedTrail?.elevationGainM || 500}m
            </Text>
          </View>
          <View style={styles.fourStatCell}>
            <Text style={styles.fourStatLabel}>Dự kiến leo</Text>
            <Text style={styles.fourStatVal}>
              ~{Math.round(Number(selectedTrail?.distanceKm || 5) * 0.8) || 5} giờ
            </Text>
          </View>
        </View>

        {/* Interactive 3D GPS Map Preview */}
        <View style={styles.mapWrap}>
          <Trip3DMapView trailData={selectedTrail as any} height={220} />
        </View>
      </View>

      {/* ─── MỤC 03 · AN TOÀN & GIÁM SÁT: Trạm kiểm soát an toàn ─── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>MỤC 03 · AN TOÀN & GIÁM SÁT</Text>
            <Text style={styles.sectionTitle}>
              {selectedCheckpoints.length} Trạm kiểm soát an toàn
            </Text>
          </View>
          <View style={styles.countBadgePill}>
            <Text style={styles.countBadgePillText}>
              {selectedCheckpoints.length} đã thiết lập
            </Text>
          </View>
        </View>

        {selectedCheckpoints.length === 0 ? (
          <View style={styles.emptyCpNotice}>
            <Ionicons name="information-circle-outline" size={18} color="#707972" />
            <Text style={styles.emptyCpNoticeText}>
              Chưa có trạm kiểm soát nào được liên kết. Vui lòng quay lại Bước 2 để chọn cung đường.
            </Text>
          </View>
        ) : (
          <View style={styles.cpListGrid}>
            {selectedCheckpoints.map((cp, idx) => {
              const latStr = Number(cp.latitude).toFixed(3);
              const lngStr = Number(cp.longitude).toFixed(3);

              return (
                <View key={cp.id || idx} style={styles.checkpointWebCard}>
                  <View style={styles.cpWebNumCircle}>
                    <Text style={styles.cpWebNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cpWebTitleRow}>
                      <Text style={styles.cpWebName}>{cp.name}</Text>
                      <View style={styles.cpReqBadge}>
                        <Text style={styles.cpReqBadgeText}>• Bắt buộc</Text>
                      </View>
                    </View>
                    <Text style={styles.cpWebSub}>
                      Mốc GPS ({latStr}, {lngStr}) · Bán kính 50m
                    </Text>
                  </View>
                  <Ionicons name="checkmark" size={18} color="#0e0f0c" />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── MỤC 04 · TÀI CHÍNH ĐOÀN: Bảng Dự Toán Chi Phí & Trekking Pricing Simulator ─── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>MỤC 04 · TÀI CHÍNH ĐOÀN</Text>
            <Text style={styles.sectionTitle}>Bảng Dự Toán Chi Phí & Trekking Pricing Simulator</Text>
          </View>
          <Text style={styles.currencyNoticeText}>Đơn vị: VNĐ</Text>
        </View>

        {/* 1. COMPONENT CON: BẢNG KÊ CHI PHÍ (CostPlanBuilder) */}
        <CostPlanBuilder
          tripId={tripId}
          expectedVersion={expectedVersion}
          accessToken={accessToken}
          targetPax={maxPaxNum}
          items={costItems}
          onChangeItems={onChangeCostItems}
          onSavedSuccess={onVersionUpdated}
        />

        {/* 2. COMPONENT CON: BỘ MÔ PHỎNG TÀI CHÍNH (TrekkingPricingSimulator) */}
        <TrekkingPricingSimulator
          tripId={tripId}
          expectedVersion={expectedVersion}
          accessToken={accessToken}
          minPax={minPaxNum}
          maxPax={maxPaxNum}
          initialPrice={initialPriceNum}
          items={costItems}
          onPriceConfirmed={onPriceConfirmed}
          isConfirmed={isPriceConfirmed}
        />

        {/* 3. CARD: GIẢI THÍCH CƠ CẤU GIÁ VÉ TỰ ĐỘNG */}
        <View style={styles.explanationWrapBox}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="receipt-outline" size={18} color="#0e0f0c" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.expTitle}>Cơ cấu giải trình giá vé</Text>
                <Text style={styles.expSub}>AUTOMATED PRICE EXPLANATION (TG-PTR-PRICING-01)</Text>
              </View>
            </View>
            {isPriceConfirmed && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#054d28" />
                <Text style={styles.verifiedBadgeText}>Đã chốt giá</Text>
              </View>
            )}
          </View>

          {isPriceConfirmed || confirmedPriceExplanation || (form.priceExplanation && form.priceExplanation.trim()) ? (
            <View style={styles.explanationContentBox}>
              <Text style={styles.explanationText}>
                {confirmedPriceExplanation ||
                  form.priceExplanation ||
                  `Đã chốt giá vé ${Number(form.price || 0).toLocaleString("vi-VN")} đ/người cho quy mô tối thiểu ${form.minPax || 5} khách. Cơ cấu chi phí đã được thẩm định tự động theo chuẩn TG-PTR-PRICING-01.`}
              </Text>
            </View>
          ) : (
            <View style={styles.missingExplanationBox}>
              <Ionicons name="alert-circle" size={18} color="#ba1a1a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.missingExplanationTitle}>
                  Chưa chốt giá vé trên bộ mô phỏng!
                </Text>
                <Text style={styles.missingExplanationText}>
                  Leader vui lòng bấm &ldquo;Chốt mức giá vé này&rdquo; trên bộ mô phỏng phía trên để tạo giải trình cơ cấu giá.
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Warnings & Errors */}
      {Boolean(conflictWarning) && (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={18} color="#9a3412" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Cảnh báo xung đột lịch trình</Text>
            <Text style={styles.warningText}>{conflictWarning}</Text>
          </View>
        </View>
      )}

      {Boolean(submitError) && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#ba1a1a" />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Thông báo hệ thống</Text>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        </View>
      )}

      {/* ─── Bottom Actions Bar ─── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          disabled={isLoading || !canPublish}
          style={[
            styles.publishMainBtn,
            canPublish && styles.publishMainBtnActive,
            (!canPublish || isLoading) && styles.disabledBtn,
          ]}
          onPress={onPublish}
          activeOpacity={0.88}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.publishMainBtnText}>ĐANG XUẤT BẢN CHUYẾN ĐI...</Text>
            </>
          ) : (
            <Text style={styles.publishMainBtnText}>
              {canPublish ? "Công khai chuyến đi ngay" : "Chưa đạt điều kiện xuất bản (Khóa)"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveDraftBottomBtn}
          onPress={onSaveDraft || (() => Alert.alert("Đã lưu nháp", "Bản nháp chuyến đi đã được lưu."))}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmark-outline" size={16} color="#404943" />
          <Text style={styles.saveDraftBottomBtnText}>Lưu bản nháp để duyệt sau</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLinkBtn}
          onPress={onBackToForm}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkBtnText}>← Quay lại Bước 2</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#707972",
    marginTop: 1,
    letterSpacing: 0.5,
  },
  draftTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  draftTopBtnText: {
    color: "#0e0f0c",
    fontSize: 11,
    fontWeight: "700",
  },
  stepperContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  stepperItemDone: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  stepperItemTextDone: {
    color: "#0e0f0c",
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
  },
  stepperItemActive: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: "#125238",
  },
  activeStepBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#9fe870",
    alignItems: "center",
    justifyContent: "center",
  },
  activeStepBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  stepperItemTextActive: {
    color: "#0e0f0c",
    fontSize: 10,
    fontWeight: "800",
    flex: 1,
  },
  readinessCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e7f1",
    ...Shadows.card,
  },
  readinessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  readinessTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  readinessPassBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  readinessPassTitle: {
    color: "#0e0f0c",
    fontSize: 12,
    fontWeight: "800",
  },
  readinessPassSub: {
    color: "#374151",
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  readinessWarnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  warnBadgeCircle: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  warnBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  readinessWarnTitle: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
  },
  readinessWarnSub: {
    color: "#92400e",
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  checklistWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 6,
  },
  checkItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  checkItemText: {
    fontSize: 10,
    color: "#475569",
    flex: 1,
    lineHeight: 14,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e7f1",
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0e0f0c",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0e0f0c",
    marginTop: 2,
  },
  editStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  editStepBtnText: {
    color: "#0e0f0c",
    fontSize: 10,
    fontWeight: "700",
  },
  destSummaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  destThumb: {
    width: 90,
    height: 70,
    borderRadius: Radius.sm,
    backgroundColor: "#e2e8f0",
  },
  destBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  gradeBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#92400e",
  },
  destCodeText: {
    fontSize: 10,
    color: "#707972",
    fontWeight: "600",
  },
  tripH1Title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  vfrsTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  vfrsTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0e0f0c",
  },
  itineraryBox: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itineraryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  itineraryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  itinerarySub: {
    fontSize: 10,
    color: "#707972",
    marginTop: 1,
  },
  itineraryActions: {
    flexDirection: "row",
    gap: 6,
  },
  templateActionBtn: {
    backgroundColor: "#9fe870",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  templateActionBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  saveDescActionBtn: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  saveDescActionBtnText: {
    color: "#0e0f0c",
    fontSize: 10,
    fontWeight: "700",
  },
  rentalTagsSection: {
    marginBottom: 10,
  },
  rentalTagsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0e0f0c",
  },
  rentalTagsSub: {
    fontSize: 9,
    color: "#707972",
    marginBottom: 6,
  },
  tagsFlexWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  rentalTagChip: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  rentalTagChipText: {
    fontSize: 10,
    color: "#334155",
    fontWeight: "600",
  },
  editorToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderBottomWidth: 0,
  },
  editorToolsLeft: {
    flexDirection: "row",
    gap: 8,
  },
  toolIcon: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  editorTabs: {
    flexDirection: "row",
    gap: 4,
  },
  editorTab: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editorTabActive: {
    backgroundColor: "#9fe870",
  },
  editorTabText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  editorTabTextActive: {
    color: "#0e0f0c",
    fontWeight: "700",
  },
  descInputArea: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    minHeight: 120,
    fontSize: 11,
    color: "#0e0f0c",
    lineHeight: 16,
  },
  descPreviewArea: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    minHeight: 120,
  },
  descPreviewText: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 16,
  },
  editorTipBox: {
    marginTop: 8,
    backgroundColor: "#fffbeb",
    borderRadius: Radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  editorTipText: {
    fontSize: 9,
    color: "#92400e",
    lineHeight: 13,
  },
  threeInfoGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  infoColCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoColLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#707972",
  },
  infoColVal: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0e0f0c",
    marginTop: 2,
  },
  infoColSub: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  pickupFooterText: {
    marginTop: 10,
    fontSize: 10,
    color: "#475569",
  },
  trailBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  trailBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  trailBannerSub: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  verifiedBadgeDark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#9fe870",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  verifiedBadgeDarkText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  fourStatsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  fourStatCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: Radius.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fourStatLabel: {
    fontSize: 9,
    color: "#707972",
    fontWeight: "600",
  },
  fourStatVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
    marginTop: 2,
  },
  mapWrap: {
    borderRadius: Radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  countBadgePill: {
    backgroundColor: "#9fe870",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  countBadgePillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  emptyCpNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: Radius.sm,
  },
  emptyCpNoticeText: {
    fontSize: 11,
    color: "#64748b",
    flex: 1,
  },
  cpListGrid: {
    gap: 8,
  },
  checkpointWebCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cpWebNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#9fe870",
    alignItems: "center",
    justifyContent: "center",
  },
  cpWebNumText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  cpWebTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cpWebName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  cpReqBadge: {
    backgroundColor: "#e2f6d5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cpReqBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },
  cpWebSub: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  currencyNoticeText: {
    fontSize: 10,
    color: "#707972",
    fontWeight: "600",
  },
  explanationWrapBox: {
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeaderBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  expTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  expSub: {
    fontSize: 9,
    color: "#707972",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e2f6d5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  verifiedBadgeText: {
    color: "#15803d",
    fontSize: 9,
    fontWeight: "800",
  },
  explanationContentBox: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  explanationText: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 16,
  },
  missingExplanationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  missingExplanationTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  missingExplanationText: {
    fontSize: 10,
    color: "#9f1239",
    marginTop: 2,
    lineHeight: 14,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff7ed",
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  warningTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#c2410c",
  },
  warningText: {
    fontSize: 10,
    color: "#9a3412",
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  errorText: {
    fontSize: 10,
    color: "#9f1239",
    marginTop: 2,
  },
  bottomBar: {
    gap: 10,
    marginTop: 8,
  },
  publishMainBtn: {
    backgroundColor: "#9fe870",
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  publishMainBtnActive: {
    backgroundColor: "#9fe870",
  },
  disabledBtn: {
    backgroundColor: "#94a3b8",
  },
  publishMainBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  saveDraftBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eff4ff",
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  saveDraftBottomBtnText: {
    color: "#0e0f0c",
    fontSize: 12,
    fontWeight: "700",
  },
  backLinkBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  backLinkBtnText: {
    color: "#0e0f0c",
    fontSize: 12,
    fontWeight: "700",
  },
});
