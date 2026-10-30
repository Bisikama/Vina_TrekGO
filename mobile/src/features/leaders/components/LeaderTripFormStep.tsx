import { Trip3DMapView } from "@/components/Trip3DMapView";
import { Colors, Radius, Shadows } from "@/constants/theme";
import type {
  TripOptionCheckpoint,
  TripOptionDestination,
  TripOptionPickupPoint,
} from "@/features/leaders/hooks";
import type { SystemTrailDetail } from "@/features/leaders/services/leader-public-trips.api";
import {
  calculateTripDuration,
  formatVnDate,
  getDayOfWeekName,
  getQuickDatePresets,
  parseVnDate,
} from "@/features/leaders/utils/tripDateUtils";
import { WheelDatePickerModal } from "./WheelDatePickerModal";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


function getTimePeriodLabel(timeStr: string): string {
  if (!timeStr) return "Sáng";
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0], 10);
  if (isNaN(h)) return "Sáng";
  if (h >= 0 && h < 12) return "Sáng";
  if (h >= 12 && h < 18) return "Chiều";
  return "Tối";
}

export interface LeaderTripFormData {
  name: string;
  description: string;
  destinationId: string;
  pickupPointId: string;
  startDate: string;
  endDate: string;
  departureTime?: string;
  bookingGateDays?: string;
  registrationOpenAt?: string;
  registrationDeadlineAt?: string;
  slots: string;
  minPax?: string;
  price: string;
  priceExplanation?: string;
  checkpointIds: string[];
}

interface LeaderTripFormStepProps {
  form: LeaderTripFormData;
  errors: Partial<Record<keyof LeaderTripFormData, string>>;
  destinations: TripOptionDestination[];
  pickupPoints: TripOptionPickupPoint[];
  checkpoints: TripOptionCheckpoint[];
  isLoadingMeta: boolean;
  submitError?: string | null;
  onUpdateField: (field: keyof LeaderTripFormData, value: string) => void;
  onToggleCheckpoint?: (id: string) => void;
  onProceed: () => void;
  onBack: () => void;
  onRetryLoadMeta?: () => void;
}

export function LeaderTripFormStep({
  form,
  errors,
  destinations,
  pickupPoints,
  checkpoints,
  isLoadingMeta,
  submitError,
  onUpdateField,
  onToggleCheckpoint,
  onProceed,
  onBack,
  onRetryLoadMeta,
}: LeaderTripFormStepProps) {
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [pickupDropdownOpen, setPickupDropdownOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"start" | "end" | "regOpen" | null>(null);

  const tomorrow = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Compute duration in real-time
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
    return d ? getDayOfWeekName(d) : null;
  }, [form.startDate]);

  const endDay = useMemo(() => {
    const d = parseVnDate(form.endDate);
    return d ? getDayOfWeekName(d) : null;
  }, [form.endDate]);

  const quickPresets = useMemo(() => getQuickDatePresets(), []);

  const gateDays = parseInt(form.bookingGateDays || "2", 10) || 2;
  const departureTime = form.departureTime || "05:30";

  const calculatedDeadline = useMemo(() => {
    if (!form.startDate) return "Chưa chọn ngày khởi hành";
    const d = parseVnDate(form.startDate);
    if (!d) return "Chưa chọn ngày khởi hành";
    const deadlineDate = new Date(d.getTime() - gateDays * 24 * 60 * 60 * 1000);
    const day = String(deadlineDate.getDate()).padStart(2, "0");
    const month = String(deadlineDate.getMonth() + 1).padStart(2, "0");
    const year = deadlineDate.getFullYear();
    return `${day}/${month}/${year} ${departureTime}`;
  }, [form.startDate, gateDays, departureTime]);

  const slotNum = parseInt(form.slots, 10) || 15;
  const minPaxNum = parseInt(form.minPax || "5", 10) || 5;

  const handleMinPaxChange = (delta: number) => {
    const next = Math.max(3, Math.min(10, minPaxNum + delta));
    onUpdateField("minPax", String(next));
    if (slotNum < next) {
      onUpdateField("slots", String(next));
    }
  };

  const handleSlotChange = (delta: number) => {
    const next = Math.max(minPaxNum, Math.min(30, slotNum + delta));
    onUpdateField("slots", String(next));
  };

  const selectedDest = useMemo(
    () => destinations.find((d) => d.id === form.destinationId),
    [destinations, form.destinationId],
  );

  const selectedPickup = useMemo(
    () => pickupPoints.find((p) => p.id === form.pickupPointId),
    [pickupPoints, form.pickupPointId],
  );

  // Generate 3D Trail Model immediately once destination & checkpoints are selected
  const trail3DData = useMemo<SystemTrailDetail | null>(() => {
    if (!selectedDest || checkpoints.length === 0) return null;

    const coords = checkpoints.map((cp) => [
      Number(cp.longitude) || 106.17,
      Number(cp.latitude) || 11.37,
    ]);

    const firstCp = checkpoints[0];
    const centerLng = Number(firstCp?.longitude) || 106.1712;
    const centerLat = Number(firstCp?.latitude) || 11.3789;

    return {
      id: selectedDest.id,
      code: `TR-${selectedDest.id.slice(-6).toUpperCase()}`,
      name: selectedDest.name,
      distanceKm: 12.8,
      elevationGainM: 850,
      destination: {
        name: selectedDest.name,
        centerLat,
        centerLng,
      },
      routeGeojson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates:
                coords.length > 1
                  ? coords
                  : [
                      [centerLng, centerLat],
                      [centerLng + 0.008, centerLat + 0.008],
                    ],
            },
          },
        ],
      },
      checkpoints: checkpoints.map((cp, idx) => ({
        id: cp.id,
        name: cp.name,
        sequence: idx + 1,
        latitude: Number(cp.latitude) || centerLat,
        longitude: Number(cp.longitude) || centerLng,
      })),
      initialCamera: {
        center: [centerLng, centerLat],
        zoom: 13.5,
        pitch: 60,
        bearing: -20,
      },
    };
  }, [selectedDest, checkpoints]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.ink} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>TẠO PUBLIC TRIP</Text>
            <Text style={styles.headerSubtitle}>BƯỚC 1/3 · THÔNG TIN CHUYẾN</Text>
          </View>
        </View>
        <View style={styles.badgeVfrs}>
          <Ionicons name="shield-checkmark" size={14} color="#125238" />
          <Text style={styles.badgeVfrsText}>VFRS-L2</Text>
        </View>
      </View>

      {/* Wizard Progress Tracker */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <View style={styles.progressLabelRow}>
            <View style={styles.progressStepCircle}>
              <Text style={styles.progressStepNum}>1</Text>
            </View>
            <Text style={styles.progressStepText}>BƯỚC 1/3: THIẾT LẬP THÔNG TIN CHUYẾN</Text>
          </View>
          <Text style={styles.progressPercent}>33%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: "33%" }]} />
        </View>
      </View>

      {/* Error Banner with helpful guidance */}
      {Boolean(submitError) && (
        <View style={styles.errorBox}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={22} color="#ba1a1a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Lưu ý từ hệ thống</Text>
            <Text style={styles.errorText}>{submitError}</Text>
            {onRetryLoadMeta && (
              <TouchableOpacity style={styles.retryBtn} onPress={onRetryLoadMeta}>
                <Ionicons name="reload" size={14} color="#125238" />
                <Text style={styles.retryBtnText}>Thử lại tải dữ liệu</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 1. CARD: THÔNG TIN CHUNG */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={20} color="#125238" />
          <Text style={styles.cardTitle}>1. THÔNG TIN CHUNG</Text>
        </View>

        {/* Trip Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tiêu đề chuyến đi *</Text>
          <TextInput
            value={form.name}
            onChangeText={(val) => onUpdateField("name", val)}
            placeholder="Ví dụ: Chinh phục Fansipan cùng Mountain Leader"
            placeholderTextColor="#707972"
            style={[styles.inputBox, errors.name && styles.inputError]}
          />
          <Text style={styles.inputHint}>
            Tên chuyến đi ngắn gọn, hấp dẫn và nêu bật đặc trưng hành trình.
          </Text>
          {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
        </View>

        {/* Trip Type: Fixed Public */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Loại hình chuyến đi</Text>
          <View style={styles.tripTypeBox}>
            <Ionicons name="radio-button-on" size={18} color="#125238" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tripTypeTitle}>Chuyến đi Công khai (PUBLIC)</Text>
              <Text style={styles.tripTypeSub}>
                Mở bán vé rộng rãi trên hệ thống, tiếp cận cộng đồng hơn 40.000 trekker.
              </Text>
            </View>
            <View style={styles.tripTypeBadge}>
              <Text style={styles.tripTypeBadgeText}>MỞ BÁN</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. CARD: THỜI GIAN & ĐIỂM TẬP KẾT ĐOÀN */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar" size={20} color="#125238" />
          <Text style={styles.cardTitle}>2. THỜI GIAN & ĐIỂM TẬP KẾT ĐOÀN</Text>
        </View>

        {/* Date constraints & Dual input */}
        <View style={styles.dateSection}>
          <View style={styles.dateSectionTop}>
            <Text style={[styles.inputLabel, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
              Lịch trình di chuyển (Ngày đi & về) *
            </Text>
            {durationInfo && (
              <View style={styles.durationPill}>
                <Ionicons name="time-outline" size={12} color="#125238" />
                <Text style={styles.durationPillText} numberOfLines={1}>
                  {durationInfo.nights === 0 ? "1 Ngày" : `${durationInfo.days}N${durationInfo.nights}Đ`}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Date Presets */}
          <View style={styles.presetsRow}>
            {quickPresets.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetChip}
                onPress={() => {
                  onUpdateField("startDate", preset.startDate);
                  onUpdateField("endDate", preset.endDate);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="flash-outline" size={13} color="#125238" />
                <Text style={styles.presetChipText}>{preset.label}</Text>
                <Text style={styles.presetDurationBadge}>{preset.durationLabel}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dateGrid}>

            {/* Start Date */}
            <View style={styles.dateCol}>
              <Text style={styles.dateSubLabel}>Ngày khởi hành *</Text>
              <TouchableOpacity
                style={[
                  styles.dateCard,
                  datePickerTarget === "start" && styles.dateCardActive,
                  errors.startDate && styles.dateCardError,
                ]}
                onPress={() => setDatePickerTarget("start")}
                activeOpacity={0.75}
              >
                <View style={styles.dateCardInputRow}>
                  <Ionicons name="calendar-outline" size={18} color="#125238" />
                  <Text
                    style={[
                      styles.dateValueText,
                      !form.startDate && styles.datePlaceholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {form.startDate || "DD/MM/YYYY"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color="#707972"
                    style={{ marginLeft: "auto" }}
                  />
                </View>
                {startDay ? (
                  <Text style={styles.dayOfWeekText}>{startDay} • Xuất phát {departureTime}</Text>
                ) : (
                  <Text style={styles.dayOfWeekSubHint}>Chạm để cuộn chọn ngày</Text>
                )}
              </TouchableOpacity>
              {errors.startDate && (
                <Text style={styles.fieldError}>{errors.startDate}</Text>
              )}
            </View>

            {/* End Date */}
            <View style={styles.dateCol}>
              <Text style={styles.dateSubLabel}>Dự kiến kết thúc *</Text>
              <TouchableOpacity
                style={[
                  styles.dateCard,
                  datePickerTarget === "end" && styles.dateCardActive,
                  errors.endDate && styles.dateCardError,
                ]}
                onPress={() => setDatePickerTarget("end")}
                activeOpacity={0.75}
              >
                <View style={styles.dateCardInputRow}>
                  <Ionicons name="flag-outline" size={18} color="#125238" />
                  <Text
                    style={[
                      styles.dateValueText,
                      !form.endDate && styles.datePlaceholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {form.endDate || "DD/MM/YYYY"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color="#707972"
                    style={{ marginLeft: "auto" }}
                  />
                </View>
                {endDay ? (
                  <Text style={styles.dayOfWeekText}>{endDay} • Kết thúc 18:00</Text>
                ) : (
                  <Text style={styles.dayOfWeekSubHint}>Chạm để cuộn chọn ngày</Text>
                )}
              </TouchableOpacity>
              {errors.endDate && <Text style={styles.fieldError}>{errors.endDate}</Text>}
            </View>
          </View>

          {/* Departure Time Input & Quick Presets */}
          <View style={styles.timeSection}>
            <View style={styles.timeSectionHeader}>
              <Text style={styles.dateSubLabel}>Giờ tập trung xuất phát *</Text>
              <Text style={styles.timePresetHint}>Gợi ý giờ khởi hành phổ biến</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeInputBox}>
                <Ionicons name="time-outline" size={17} color="#125238" />
                <TextInput
                  value={form.departureTime || "05:30"}
                  onChangeText={(val) => onUpdateField("departureTime", val)}
                  placeholder="05:30"
                  placeholderTextColor="#707972"
                  style={styles.timeInputText}
                />
                <View style={styles.timePeriodBadge}>
                  <Text style={styles.timePeriodBadgeText}>
                    {getTimePeriodLabel(form.departureTime || "05:30")}
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChipsRow}>
                {[
                  { time: "05:00", label: "05:00 Sáng" },
                  { time: "05:30", label: "05:30 Sáng" },
                  { time: "06:00", label: "06:00 Sáng" },
                  { time: "07:00", label: "07:00 Sáng" },
                  { time: "13:30", label: "13:30 Chiều" },
                  { time: "20:00", label: "20:00 Tối" },
                ].map(({ time, label }) => {
                  const isSelected = (form.departureTime || "05:30") === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[styles.timeChip, isSelected && styles.timeChipActive]}
                      onPress={() => onUpdateField("departureTime", time)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Booking Gate Configuration (Mở & Đóng Form Đăng ký) */}
          <View style={styles.bookingGateCard}>
            <View style={styles.bookingGateHeader}>
              <Ionicons name="timer-outline" size={18} color="#125238" />
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingGateTitle}>
                  Thời gian Mở & Đóng Form Đăng Ký (Booking Gate)
                </Text>
                <Text style={styles.bookingGateSub}>
                  Mặc định đóng form trước 2 ngày (48h) so với giờ khởi hành. Tối đa cho phép chỉnh sát nhất là trước 1 ngày (24h).
                </Text>
              </View>
            </View>

            {/* 3 Booking Gate Presets */}
            <View style={styles.gatePresetsRow}>
              {[
                { label: "Trước 3 ngày", value: "3" },
                { label: "Trước 2 ngày (Mặc định)", value: "2" },
                { label: "Trước 1 ngày (Tối đa)", value: "1" },
              ].map((p) => {
                const isActive = (form.bookingGateDays || "2") === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.gatePresetBtn, isActive && styles.gatePresetBtnActive]}
                    onPress={() => onUpdateField("bookingGateDays", p.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.gatePresetBtnText, isActive && styles.gatePresetBtnTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Inputs: Registration Open & Registration Deadline */}
            <View style={styles.gateInputsGrid}>
              <View style={styles.gateInputCol}>
                <Text style={styles.gateInputLabel}>Giờ mở nhận đăng ký (Tùy chọn)</Text>
                <TouchableOpacity
                  style={styles.gateInputBox}
                  onPress={() => setDatePickerTarget("regOpen")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color="#125238" />
                  <Text
                    style={[
                      styles.gateInputText,
                      !form.registrationOpenAt && { color: "#707972" },
                      { flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {form.registrationOpenAt || "Ngay khi xuất bản"}
                  </Text>
                  {form.registrationOpenAt ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        onUpdateField("registrationOpenAt", "");
                      }}
                      style={styles.clearRegOpenBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color="#ba1a1a" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={14} color="#707972" style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>

                {/* Quick Presets for Registration Open */}
                <View style={styles.regOpenChipsRow}>
                  <TouchableOpacity
                    style={[styles.regOpenChip, !form.registrationOpenAt && styles.regOpenChipActive]}
                    onPress={() => onUpdateField("registrationOpenAt", "")}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.regOpenChipText, !form.registrationOpenAt && styles.regOpenChipTextActive]}>
                      Mở ngay khi duyệt
                    </Text>
                  </TouchableOpacity>

                  {form.startDate ? (
                    <>
                      <TouchableOpacity
                        style={styles.regOpenChip}
                        onPress={() => {
                          const d = parseVnDate(form.startDate);
                          if (d) {
                            d.setDate(d.getDate() - 7);
                            onUpdateField("registrationOpenAt", formatVnDate(d));
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.regOpenChipText}>Trước 7 ngày</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.regOpenChip}
                        onPress={() => {
                          const d = parseVnDate(form.startDate);
                          if (d) {
                            d.setDate(d.getDate() - 5);
                            onUpdateField("registrationOpenAt", formatVnDate(d));
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.regOpenChipText}>Trước 5 ngày</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={styles.regOpenChip}
                    onPress={() => setDatePickerTarget("regOpen")}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.regOpenChipText}>Tự chọn ngày...</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.gateInputHint}>
                  Chạm để chọn ngày hoặc bấm các nút gợi ý nhanh bên trên mà không cần gõ tay.
                </Text>
              </View>

              <View style={styles.gateInputCol}>
                <Text style={styles.gateInputLabel}>Hạn chót đóng form đăng ký *</Text>
                <View style={[styles.gateInputBox, styles.gateInputBoxLocked]}>
                  <Ionicons name="hourglass-outline" size={16} color="#125238" />
                  <Text style={styles.gateDeadlineText} numberOfLines={1}>
                    {form.registrationDeadlineAt || calculatedDeadline}
                  </Text>
                </View>
                <Text style={styles.gateInputHint}>
                  Sau mốc này sẽ chặn tạo đơn mới. Khách đã giữ chỗ trước khi đóng form vẫn được thanh toán nốt.
                </Text>
              </View>
            </View>
          </View>

          {/* VFRS Safety Standards Box */}
          <View style={styles.vfrsRuleBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#b45309" />
            <Text style={styles.vfrsRuleText}>
              <Text style={{ fontWeight: "800" }}>Quy chuẩn an toàn VFRS: </Text>
              Chuyến đi ghép đoàn cần mở trước ngày khởi hành tối thiểu 3 ngày để đảm bảo thời gian gom đoàn, xử lý các đơn thuê trang bị (Rental Cutoff 24h) và nộp danh sách khai báo kiểm lâm.
            </Text>
          </View>

          {/* Quy tắc 3 Điều kiện Mở/Đóng Đăng ký */}
          <View style={styles.rulesCard}>
            <View style={styles.rulesCardHeader}>
              <Ionicons name="checkmark-done-circle-outline" size={18} color="#125238" />
              <Text style={styles.rulesCardTitle}>Quy tắc 3 Điều kiện Mở/Đóng Đăng Ký</Text>
            </View>
            <View style={styles.ruleItemRow}>
              <Ionicons name="checkmark" size={14} color="#125238" style={{ marginTop: 2 }} />
              <Text style={styles.ruleItemText}>
                <Text style={{ fontWeight: "700" }}>Hạn chót đăng ký: </Text>
                Tự động đóng form trước giờ khởi hành {form.bookingGateDays || 2} ngày (có thể chỉnh tối đa sát nhất trước 1 ngày).
              </Text>
            </View>
            <View style={styles.ruleItemRow}>
              <Ionicons name="checkmark" size={14} color="#125238" style={{ marginTop: 2 }} />
              <Text style={styles.ruleItemText}>
                <Text style={{ fontWeight: "700" }}>Bảo vệ giữ chỗ: </Text>
                Khách đã vào form giữ chỗ trước giờ đóng sổ vẫn được hoàn tất thanh toán trong thời gian giữ chỗ (15 phút).
              </Text>
            </View>
            <View style={styles.ruleItemRow}>
              <Ionicons name="checkmark" size={14} color="#125238" style={{ marginTop: 2 }} />
              <Text style={styles.ruleItemText}>
                <Text style={{ fontWeight: "700" }}>Sức chứa tối đa: </Text>
                Đủ số người tối đa (maxPax) hệ thống sẽ tự động chuyển trạng thái Đủ chỗ (FULL).
              </Text>
            </View>
          </View>

          <Text style={styles.dateRulesHint}>
            Ràng buộc: Không được chọn ngày trong quá khứ. Ngày khởi hành từ ngày mai trở đi và Ngày kết thúc không được trước ngày đi.
          </Text>
        </View>

        {/* 1. SỔ DROPDOWN CHỌN DESTINATION */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Điểm đến (Destination) *</Text>
          {isLoadingMeta ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#125238" />
              <Text style={styles.muted}>Đang đồng bộ danh mục điểm đến từ máy chủ...</Text>
            </View>
          ) : destinations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={28} color="#707972" />
              <Text style={styles.emptyText}>Chưa có danh sách điểm đến từ máy chủ.</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  destDropdownOpen && styles.dropdownTriggerActive,
                  errors.destinationId && styles.dropdownTriggerError,
                ]}
                onPress={() => {
                  setDestDropdownOpen((prev) => !prev);
                  setPickupDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownLeft}>
                  <View
                    style={[
                      styles.dropdownIconCircle,
                      selectedDest && styles.dropdownIconCircleSelected,
                    ]}
                  >
                    <Ionicons
                      name="location"
                      size={18}
                      color={selectedDest ? "#125238" : "#707972"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.dropdownSelectedText,
                        !selectedDest && styles.dropdownPlaceholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedDest ? selectedDest.name : "-- Chọn điểm đến trekking từ hệ thống --"}
                    </Text>
                    {selectedDest && (
                      <Text style={styles.dropdownSubText}>Tuyến Trekking Tiêu Chuẩn Quốc Gia</Text>
                    )}
                  </View>
                </View>
                <Ionicons
                  name={destDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#125238"
                />
              </TouchableOpacity>

              {destDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {destinations.map((dest) => {
                    const isSelected = form.destinationId === dest.id;
                    return (
                      <TouchableOpacity
                        key={dest.id}
                        style={[
                          styles.dropdownMenuItem,
                          isSelected && styles.dropdownMenuItemSelected,
                        ]}
                        onPress={() => {
                          onUpdateField("destinationId", dest.id);
                          setDestDropdownOpen(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.dropdownItemLeft}>
                          <Ionicons
                            name="location-outline"
                            size={18}
                            color={isSelected ? "#125238" : "#707972"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.dropdownMenuItemText,
                                isSelected && styles.dropdownMenuItemTextSelected,
                              ]}
                            >
                              {dest.name}
                            </Text>
                            <Text style={styles.dropdownMenuItemSubText}>
                              Tuyến Trekking Tiêu Chuẩn VFRS
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#125238" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
          {errors.destinationId && <Text style={styles.fieldError}>{errors.destinationId}</Text>}
        </View>

        {/* 2. SỔ DROPDOWN CHỌN ĐIỂM ĐÓN (PICKUP POINT) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Địa điểm tập kết đón đoàn *</Text>
          {!form.destinationId ? (
            <View style={styles.disabledPromptBox}>
              <Ionicons name="information-circle-outline" size={18} color="#707972" />
              <Text style={styles.disabledPromptText}>
                Vui lòng chọn Điểm đến trước
              </Text>
            </View>
          ) : pickupPoints.length === 0 ? (
            <View style={styles.disabledPromptBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#707972" />
              <Text style={styles.disabledPromptText}>
                Chưa có điểm đón nào được thiết lập cho tuyến này.
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  pickupDropdownOpen && styles.dropdownTriggerActive,
                  errors.pickupPointId && styles.dropdownTriggerError,
                ]}
                onPress={() => {
                  setPickupDropdownOpen((prev) => !prev);
                  setDestDropdownOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownLeft}>
                  <View
                    style={[
                      styles.dropdownIconCircle,
                      selectedPickup && styles.dropdownIconCircleSelected,
                    ]}
                  >
                    <Ionicons
                      name="bus"
                      size={18}
                      color={selectedPickup ? "#125238" : "#707972"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.dropdownSelectedText,
                        !selectedPickup && styles.dropdownPlaceholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedPickup ? selectedPickup.name : "-- Chọn điểm đón / tập kết --"}
                    </Text>
                    {selectedPickup && (
                      <Text style={styles.dropdownSubText}>
                        Điểm tập kết toàn đoàn trước giờ xuất phát
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons
                  name={pickupDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#125238"
                />
              </TouchableOpacity>

              {pickupDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {pickupPoints.map((pt) => {
                    const isSelected = form.pickupPointId === pt.id;
                    return (
                      <TouchableOpacity
                        key={pt.id}
                        style={[
                          styles.dropdownMenuItem,
                          isSelected && styles.dropdownMenuItemSelected,
                        ]}
                        onPress={() => {
                          onUpdateField("pickupPointId", pt.id);
                          setPickupDropdownOpen(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.dropdownItemLeft}>
                          <Ionicons
                            name="bus-outline"
                            size={18}
                            color={isSelected ? "#125238" : "#707972"}
                          />
                          <Text
                            style={[
                              styles.dropdownMenuItemText,
                              isSelected && styles.dropdownMenuItemTextSelected,
                            ]}
                          >
                            {pt.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#125238" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
          {errors.pickupPointId && <Text style={styles.fieldError}>{errors.pickupPointId}</Text>}
        </View>
      </View>

      {/* 3. CARD: QUY MÔ ĐOÀN & GIÁ VÉ ƯỚC TÍNH */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cash" size={20} color="#125238" />
          <Text style={styles.cardTitle}>3. QUY MÔ ĐOÀN & GIÁ VÉ ƯỚC TÍNH</Text>
        </View>

        {/* Min Pax Stepper (Quy mô đoàn tối thiểu) */}
        <View style={styles.inputGroup}>
          <View style={styles.slotHeader}>
            <Text style={styles.inputLabel}>Quy mô đoàn tối thiểu (minPax) *</Text>
            <Text style={[styles.slotCapTag, { backgroundColor: "#e2f6d5", color: "#163300" }]}>
              {minPaxNum} khách tối thiểu
            </Text>
          </View>

          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => handleMinPaxChange(-1)}
              activeOpacity={0.8}
            >
              <Ionicons name="remove" size={20} color="#121c2a" />
            </TouchableOpacity>

            <View style={styles.stepperDisplay}>
              <Text style={styles.stepperValue}>{minPaxNum}</Text>
              <Text style={styles.stepperSub}>Khách tối thiểu</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepperBtn, styles.stepperBtnPlus]}
              onPress={() => handleMinPaxChange(1)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.slotRuleHint}>
            Quy định VFRS: Tối thiểu từ 3 đến 10 khách để chuyến đi đủ điều kiện khởi hành.
          </Text>
          {errors.minPax && <Text style={styles.fieldError}>{errors.minPax}</Text>}
        </View>

        {/* Member Slots Stepper (Quy mô đoàn tối đa / Capacity) */}
        <View style={styles.inputGroup}>
          <View style={styles.slotHeader}>
            <Text style={styles.inputLabel}>Quy mô đoàn tối đa (maxPax / capacity) *</Text>
            <Text style={styles.slotCapTag}>{slotNum} / 30 Thành viên</Text>
          </View>

          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => handleSlotChange(-1)}
              activeOpacity={0.8}
            >
              <Ionicons name="remove" size={20} color="#121c2a" />
            </TouchableOpacity>

            <View style={styles.stepperDisplay}>
              <Text style={styles.stepperValue}>{slotNum}</Text>
              <Text style={styles.stepperSub}>Thành viên tối đa</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepperBtn, styles.stepperBtnPlus]}
              onPress={() => handleSlotChange(1)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.slotRuleHint}>
            Hạn ngạch an toàn VFRS: Tối đa 30 người / đoàn.
          </Text>
          {errors.slots && <Text style={styles.fieldError}>{errors.slots}</Text>}
        </View>

        {/* Estimated Price Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Giá vé ước tính ban đầu / người *</Text>
          <View style={styles.priceInputWrapper}>
            <TextInput
              value={form.price}
              onChangeText={(val) => onUpdateField("price", val.replace(/[^0-9]/g, ""))}
              placeholder="2850000"
              placeholderTextColor="#707972"
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Text style={styles.priceSuffix}>VNĐ</Text>
          </View>
          <Text style={styles.priceFormatted}>
            {Number(form.price || 0).toLocaleString("vi-VN")} VNĐ / người (ước tính ban đầu).
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: "#f5f4ee", padding: 10, borderRadius: 10 }}>
            <Ionicons name="information-circle-outline" size={16} color="#47672d" />
            <Text style={{ fontSize: 12, color: "#454745", flex: 1, lineHeight: 17 }}>
              Ở Bước 3, bạn sẽ dùng Bảng kê chi phí thực tế & Bộ mô phỏng tài chính để tính điểm hòa vốn và chốt giá chính thức.
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Action Button */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onProceed} activeOpacity={0.88}>
        <Text style={styles.primaryBtnText}>TIẾP TỤC: THIẾT LẬP LỘ TRÌNH</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Wheel Date Picker Modals */}
      <WheelDatePickerModal
        visible={datePickerTarget === "start"}
        title="Chọn ngày khởi hành"
        initialDate={form.startDate}
        minDate={tomorrow}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(val) => {
          onUpdateField("startDate", val);
          // Tự động gợi ý ngày kết thúc nếu ngày kết thúc trống hoặc nhỏ hơn ngày khởi hành
          const s = parseVnDate(val);
          const e = parseVnDate(form.endDate);
          if (s && (!e || e.getTime() < s.getTime())) {
            const next = new Date(s);
            next.setDate(next.getDate() + 2); // Mặc định chuyến 3N2Đ
            onUpdateField("endDate", formatVnDate(next));
          }
        }}
      />

      <WheelDatePickerModal
        visible={datePickerTarget === "end"}
        title="Chọn dự kiến kết thúc"
        initialDate={form.endDate || form.startDate}
        minDate={parseVnDate(form.startDate) || tomorrow}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(val) => {
          onUpdateField("endDate", val);
        }}
      />

      <WheelDatePickerModal
        visible={datePickerTarget === "regOpen"}
        title="Chọn ngày mở nhận đăng ký"
        initialDate={form.registrationOpenAt || form.startDate}
        minDate={new Date()}
        maxDate={parseVnDate(form.startDate) || undefined}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(val) => {
          onUpdateField("registrationOpenAt", val);
        }}
      />
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  headerTitle: {
    color: "#121c2a",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  badgeVfrs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeVfrsText: {
    color: "#002113",
    fontSize: 11,
    fontWeight: "800",
  },
  progressContainer: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    ...Shadows.card,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressStepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepNum: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  progressStepText: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  progressPercent: {
    color: "#404943",
    fontSize: 12,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#dee9fc",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#125238",
    borderRadius: 3,
  },
  errorBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ffdad6",
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ba1a1a",
  },
  errorIconWrap: {
    marginTop: 2,
  },
  errorTitle: {
    color: "#ba1a1a",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },
  errorText: {
    color: "#93000a",
    fontSize: 12,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  retryBtnText: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 16,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eff4ff",
    paddingBottom: 12,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#121c2a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  muted: {
    color: "#707972",
    fontSize: 12,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginTop: 4,
  },
  dropdownTriggerActive: {
    borderColor: "#125238",
    backgroundColor: "#ffffff",
  },
  dropdownTriggerError: {
    borderColor: "#ba1a1a",
    backgroundColor: "#ffdad6",
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dropdownIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dee9fc",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownIconCircleSelected: {
    backgroundColor: "#b1f0cd",
  },
  dropdownSelectedText: {
    color: "#121c2a",
    fontSize: 13,
    fontWeight: "700",
  },
  dropdownPlaceholderText: {
    color: "#707972",
    fontWeight: "500",
  },
  dropdownSubText: {
    color: "#404943",
    fontSize: 10,
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#c1ecd2",
    marginTop: 6,
    overflow: "hidden",
    ...Shadows.card,
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eff4ff",
  },
  dropdownMenuItemSelected: {
    backgroundColor: "#e8f5e9",
  },
  dropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dropdownMenuItemText: {
    color: "#121c2a",
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownMenuItemTextSelected: {
    color: "#125238",
    fontWeight: "800",
  },
  dropdownMenuItemSubText: {
    color: "#707972",
    fontSize: 10,
    marginTop: 2,
  },
  disabledPromptBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff4ff",
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  disabledPromptText: {
    color: "#707972",
    fontSize: 12,
    flex: 1,
  },
  destList: {
    gap: 10,
  },
  destCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: "#eff4ff",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  destCardSelected: {
    borderColor: "#125238",
    backgroundColor: "#e6eeff",
  },
  destIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#dee9fc",
    alignItems: "center",
    justifyContent: "center",
  },
  destIconBoxSelected: {
    backgroundColor: "#b1f0cd",
  },
  destName: {
    color: "#121c2a",
    fontSize: 14,
    fontWeight: "700",
  },
  destNameSelected: {
    color: "#125238",
    fontWeight: "800",
  },
  destMeta: {
    color: "#404943",
    fontSize: 11,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    color: "#121c2a",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtext: {
    color: "#707972",
    fontSize: 11,
    textAlign: "center",
    maxWidth: 260,
  },
  checkpointSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#eff4ff",
    paddingTop: 14,
  },
  checkpointSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  checkpointSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkpointSectionTitle: {
    color: "#121c2a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  checkpointCountBadge: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "800",
  },
  checkpointList: {
    gap: 8,
  },
  checkpointRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: "#f4f8f5",
    borderWidth: 1,
    borderColor: "#e0ece4",
  },
  checkpointRowSelected: {
    borderColor: "#125238",
    backgroundColor: "#ffffff",
  },
  cpLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cpPill: {
    backgroundColor: "#707972",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cpPillSelected: {
    backgroundColor: "#125238",
  },
  cpPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  cpName: {
    color: "#404943",
    fontSize: 12,
    fontWeight: "600",
  },
  cpNameSelected: {
    color: "#121c2a",
    fontWeight: "800",
  },
  cpCoords: {
    color: "#707972",
    fontSize: 10,
    marginTop: 2,
  },
  cpDefaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dee9fc",
  },
  cpDefaultBadgeActive: {
    backgroundColor: "#b1f0cd",
    borderColor: "#74d99f",
  },
  cpDefaultBadgeText: {
    color: "#707972",
    fontSize: 10,
    fontWeight: "600",
  },
  cpDefaultBadgeTextActive: {
    color: "#002113",
    fontWeight: "800",
  },
  map3DSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#eff4ff",
    paddingTop: 14,
  },
  map3DHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  map3DTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  map3DTitle: {
    color: "#121c2a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  map3DBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  map3DBadgeText: {
    color: "#002113",
    fontSize: 10,
    fontWeight: "800",
  },
  map3DContainer: {
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: "#141d13",
    borderWidth: 1,
    borderColor: "#c1ecd2",
  },
  map3DNote: {
    color: "#707972",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 6,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 14,
  },
  explanationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  charCountText: {
    color: "#707972",
    fontSize: 10,
    fontWeight: "600",
  },
  inputLabel: {
    color: "#121c2a",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputBox: {
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#121c2a",
    fontSize: 13,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#ba1a1a",
    backgroundColor: "#ffdad6",
  },
  inputHint: {
    color: "#707972",
    fontSize: 11,
    marginTop: 4,
  },
  tripTypeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#e8f5e9",
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#125238",
  },
  tripTypeTitle: {
    color: "#125238",
    fontSize: 13,
    fontWeight: "800",
  },
  tripTypeSub: {
    color: "#404943",
    fontSize: 11,
    marginTop: 2,
  },
  tripTypeBadge: {
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tripTypeBadgeText: {
    color: "#002113",
    fontSize: 10,
    fontWeight: "800",
  },
  fieldError: {
    color: "#ba1a1a",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  dateSection: {
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  dateSectionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationPillText: {
    color: "#002113",
    fontSize: 11,
    fontWeight: "800",
  },
  presetsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dee9fc",
  },
  presetChipText: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "700",
  },
  presetDurationBadge: {
    backgroundColor: "#e6eeff",
    color: "#125238",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  dateGrid: {
    flexDirection: "row",
    gap: 10,
  },
  dateCol: {
    flex: 1,
  },
  dateSubLabel: {
    color: "#404943",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateCard: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 11,
    borderWidth: 1,
    borderColor: "#dee9fc",
    ...Shadows.card,
    shadowOpacity: 0.04,
  },
  dateCardActive: {
    borderColor: "#125238",
    backgroundColor: "#f4f8f5",
  },
  dateCardError: {
    borderColor: "#ba1a1a",
    backgroundColor: "#ffdad6",
  },
  dateCardInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateValueText: {
    fontFamily: "Roboto",
    fontSize: 14,
    lineHeight: 14 * 1.5,
    fontWeight: "700",
    color: "#121c2a",
    flex: 1,
  },
  datePlaceholderText: {
    color: "#707972",
    fontWeight: "500",
  },
  dayOfWeekText: {
    fontFamily: "Roboto",
    color: "#125238",
    fontSize: 10,
    lineHeight: 10 * 1.5,
    fontWeight: "600",
    marginTop: 4,
  },
  dayOfWeekSubHint: {
    fontFamily: "Roboto",
    color: "#707972",
    fontSize: 10,
    lineHeight: 10 * 1.5,
    marginTop: 4,
    fontStyle: "italic",
  },
  dateRulesHint: {
    color: "#707972",
    fontSize: 10,
    marginTop: 8,
    fontStyle: "italic",
  },
  pickupList: {
    gap: 6,
  },
  pickupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: "#eff4ff",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pickupChipSelected: {
    borderColor: "#125238",
    backgroundColor: "#ffffff",
  },
  pickupText: {
    color: "#121c2a",
    fontSize: 12,
    fontWeight: "600",
  },
  pickupTextSelected: {
    color: "#125238",
    fontWeight: "800",
  },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotCapTag: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "800",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    padding: 8,
    marginTop: 4,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#dee9fc",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPlus: {
    backgroundColor: "#125238",
  },
  stepperDisplay: {
    alignItems: "center",
  },
  stepperValue: {
    color: "#121c2a",
    fontSize: 22,
    fontWeight: "900",
  },
  stepperSub: {
    color: "#707972",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  slotRuleHint: {
    color: "#707972",
    fontSize: 10,
    marginTop: 6,
    fontStyle: "italic",
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceInput: {
    flex: 1,
    color: "#125238",
    fontSize: 17,
    fontWeight: "800",
    padding: 0,
  },
  priceSuffix: {
    color: "#707972",
    fontSize: 12,
    fontWeight: "700",
  },
  priceFormatted: {
    color: "#125238",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#125238",
    paddingVertical: 15,
    borderRadius: Radius.sm,
    marginTop: 10,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timeSection: {
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e7f1",
  },
  timeSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timePresetHint: {
    color: "#707972",
    fontSize: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timePeriodBadge: {
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginLeft: "auto",
  },
  timePeriodBadgeText: {
    color: "#002113",
    fontSize: 10,
    fontWeight: "800",
  },
  clearRegOpenBtn: {
    marginLeft: "auto",
    padding: 2,
  },
  regOpenChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  regOpenChip: {
    backgroundColor: "#eff4ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  regOpenChipActive: {
    backgroundColor: "#125238",
    borderColor: "#125238",
  },
  regOpenChipText: {
    color: "#125238",
    fontSize: 10,
    fontWeight: "700",
  },
  regOpenChipTextActive: {
    color: "#ffffff",
  },
  timeInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ccd9ea",
    minWidth: 100,
  },
  timeInputText: {
    color: "#125238",
    fontSize: 14,
    fontWeight: "800",
    padding: 0,
    minWidth: 50,
  },
  timeChipsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  timeChip: {
    backgroundColor: "#eff4ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  timeChipActive: {
    backgroundColor: "#125238",
    borderColor: "#125238",
  },
  timeChipText: {
    color: "#121c2a",
    fontSize: 12,
    fontWeight: "600",
  },
  timeChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  bookingGateCard: {
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  bookingGateHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  bookingGateTitle: {
    color: "#125238",
    fontSize: 13,
    fontWeight: "800",
  },
  bookingGateSub: {
    color: "#404943",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  gatePresetsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  gatePresetBtn: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  gatePresetBtnActive: {
    backgroundColor: "#125238",
    borderColor: "#125238",
  },
  gatePresetBtnText: {
    color: "#404943",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  gatePresetBtnTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  gateInputsGrid: {
    gap: 10,
  },
  gateInputCol: {
    marginBottom: 4,
  },
  gateInputLabel: {
    color: "#121c2a",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  gateInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff4ff",
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  gateInputBoxLocked: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  gateInputText: {
    flex: 1,
    color: "#121c2a",
    fontSize: 12,
    fontWeight: "600",
    padding: 0,
  },
  gateDeadlineText: {
    flex: 1,
    color: "#125238",
    fontSize: 13,
    fontWeight: "800",
  },
  gateInputHint: {
    color: "#707972",
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  vfrsRuleBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: Radius.sm,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  vfrsRuleText: {
    flex: 1,
    color: "#92400e",
    fontSize: 11,
    lineHeight: 16,
  },
  rulesCard: {
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rulesCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rulesCardTitle: {
    color: "#125238",
    fontSize: 12,
    fontWeight: "800",
  },
  ruleItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  ruleItemText: {
    flex: 1,
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
  },
});
