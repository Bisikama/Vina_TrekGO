import { FormField, Input, SurfaceCard, Textarea } from "@/components/ui";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { WheelDatePickerModal } from "@/features/leaders/components";
import { parseVnDate } from "@/features/leaders/utils/tripDateUtils";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface CreateTripBasicInfoStepProps {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  onChangeTitle: (val: string) => void;
  onChangeDescription: (val: string) => void;
  onChangeStartAt: (val: string) => void;
  onChangeEndAt: (val: string) => void;
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function padZero(n: number): string {
  return String(n).padStart(2, "0");
}

function parseIsoToParts(isoString: string): { dateStr: string; timeStr: string } {
  if (!isoString) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return {
      dateStr: `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`,
      timeStr: "06:00",
    };
  }

  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return { dateStr: "", timeStr: "06:00" };
  }

  return {
    dateStr: `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`,
    timeStr: `${padZero(d.getHours())}:${padZero(d.getMinutes())}`,
  };
}

function partsToIso(dateStr: string, timeStr: string): string | null {
  const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.includes("-") ? dateStr.split("-") : [];
  if (parts.length !== 3) return null;

  let day: number, month: number, year: number;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const [hStr, mStr] = (timeStr || "06:00").split(":");
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;

  const d = new Date(year, month, day, hours, minutes, 0, 0);
  if (isNaN(d.getTime())) return null;

  return d.toISOString();
}

function formatDisplayDate(dateStr: string): { dayName: string; formatted: string } {
  const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.includes("-") ? dateStr.split("-") : [];
  if (parts.length !== 3) return { dayName: "", formatted: dateStr || "Chọn ngày" };

  let day: number, month: number, year: number;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return { dayName: "", formatted: dateStr || "Chọn ngày" };

  const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const dayName = days[d.getDay()];
  const formatted = `${padZero(day)}/${padZero(month)}/${year}`;
  return { dayName, formatted };
}

/**
 * Tính toán thời lượng chuyến đi chính xác theo số ngày và số đêm lịch
 */
function computeDurationText(startIso: string, endIso: string): { durationText: string; isInvalid: boolean } {
  const s = new Date(startIso);
  const e = new Date(endIso);

  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return { durationText: "Chưa xác định", isInvalid: false };
  }

  const minAllowedStart = Date.now() + 2 * 24 * 60 * 60 * 1000;
  if (s.getTime() < minAllowedStart) {
    return {
      durationText: "Thời gian khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày (48 giờ).",
      isInvalid: true,
    };
  }

  const diffMs = e.getTime() - s.getTime();
  if (diffMs <= 0) {
    return { durationText: "Thời gian kết thúc chuyến đi phải sau thời gian khởi hành.", isInvalid: true };
  }

  const totalHours = Math.round(diffMs / (1000 * 60 * 60));

  const sDateOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const eDateOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const diffCalendarDays = Math.round((eDateOnly.getTime() - sDateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffCalendarDays === 0) {
    return { durationText: `Đi trong ngày • Khoảng ${totalHours} tiếng`, isInvalid: false };
  }

  const days = diffCalendarDays + 1;
  const nights = diffCalendarDays;
  const label = `${days} ngày ${nights} đêm (${days}N${nights}Đ)`;
  return { durationText: `${label} • Khoảng ${totalHours} tiếng`, isInvalid: false };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function CreateTripBasicInfoStep({
  title,
  description,
  startAt,
  endAt,
  onChangeTitle,
  onChangeDescription,
  onChangeStartAt,
  onChangeEndAt,
}: CreateTripBasicInfoStepProps) {
  // Local state for formatted inputs
  const initialStart = useMemo(() => parseIsoToParts(startAt), [startAt]);
  const initialEnd = useMemo(() => parseIsoToParts(endAt), [endAt]);

  const [startDateInput, setStartDateInput] = useState(initialStart.dateStr);
  const [startTimeInput, setStartTimeInput] = useState(initialStart.timeStr);
  const [endDateInput, setEndDateInput] = useState(initialEnd.dateStr);
  const [endTimeInput, setEndTimeInput] = useState(initialEnd.timeStr);
  const [datePickerTarget, setDatePickerTarget] = useState<"start" | "end" | null>(null);

  // Sync back if parent props change externally
  useEffect(() => {
    const s = parseIsoToParts(startAt);
    if (s.dateStr) setStartDateInput(s.dateStr);
    if (s.timeStr) setStartTimeInput(s.timeStr);
  }, [startAt]);

  useEffect(() => {
    const e = parseIsoToParts(endAt);
    if (e.dateStr) setEndDateInput(e.dateStr);
    if (e.timeStr) setEndTimeInput(e.timeStr);
  }, [endAt]);

  // Update startAt ISO
  function handleUpdateStart(date: string, time: string) {
    setStartDateInput(date);
    setStartTimeInput(time);
    const iso = partsToIso(date, time);
    if (iso) {
      onChangeStartAt(iso);
    }
  }

  // Update endAt ISO
  function handleUpdateEnd(date: string, time: string) {
    setEndDateInput(date);
    setEndTimeInput(time);
    const iso = partsToIso(date, time);
    if (iso) {
      onChangeEndAt(iso);
    }
  }

  // Handle confirm from WheelDatePickerModal
  function handleConfirmWheelDate(dateStr: string) {
    if (datePickerTarget === "start") {
      handleUpdateStart(dateStr, startTimeInput);
      // Gợi ý ngày kết thúc nếu endDate trống hoặc nhỏ hơn startDate
      const s = parseVnDate(dateStr);
      const e = parseVnDate(endDateInput);
      if (s && (!e || e.getTime() < s.getTime())) {
        const next = new Date(s);
        next.setDate(next.getDate() + 1); // Mặc định 2 ngày 1 đêm
        const nextStr = `${String(next.getDate()).padStart(2, "0")}/${String(next.getMonth() + 1).padStart(2, "0")}/${next.getFullYear()}`;
        handleUpdateEnd(nextStr, endTimeInput);
      }
    } else if (datePickerTarget === "end") {
      handleUpdateEnd(dateStr, endTimeInput);
    }
    setDatePickerTarget(null);
  }

  // Quick preset handlers
  function applyPreset(daysFromNow: number, tripDays: number, startHour = 6, endHour = 18) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + daysFromNow);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + (tripDays - 1));
    end.setHours(endHour, 0, 0, 0);

    const sParts = {
      dateStr: `${padZero(start.getDate())}/${padZero(start.getMonth() + 1)}/${start.getFullYear()}`,
      timeStr: `${padZero(startHour)}:00`,
    };
    const eParts = {
      dateStr: `${padZero(end.getDate())}/${padZero(end.getMonth() + 1)}/${end.getFullYear()}`,
      timeStr: `${padZero(endHour)}:00`,
    };

    setStartDateInput(sParts.dateStr);
    setStartTimeInput(sParts.timeStr);
    setEndDateInput(eParts.dateStr);
    setEndTimeInput(eParts.timeStr);

    onChangeStartAt(start.toISOString());
    onChangeEndAt(end.toISOString());
  }

  const minAllowedStart = useMemo(
    () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    [],
  );

  // Presets calculation (Không dùng icon tia sét / AI, chỉ gợi ý các mốc thời gian thiết thực)
  const quickPresets = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const minTime = Date.now() + 2 * 24 * 60 * 60 * 1000;

    let diffToSaturday = (6 - day + 7) % 7 || 7;
    const testSat = new Date(now);
    testSat.setDate(now.getDate() + diffToSaturday);
    testSat.setHours(6, 0, 0, 0);
    if (testSat.getTime() < minTime) {
      diffToSaturday += 7;
    }

    const diffToNextSat = diffToSaturday + 7;

    let diffToFriday = (5 - day + 7) % 7 || 7;
    const testFri = new Date(now);
    testFri.setDate(now.getDate() + diffToFriday);
    testFri.setHours(6, 0, 0, 0);
    if (testFri.getTime() < minTime) {
      diffToFriday += 7;
    }

    return [
      {
        label: "Cuối tuần tới",
        sub: "2N1Đ (T7 - CN)",
        action: () => applyPreset(diffToSaturday, 2, 6, 18),
      },
      {
        label: "Tuần sau nữa",
        sub: "2N1Đ (T7 - CN)",
        action: () => applyPreset(diffToNextSat, 2, 6, 18),
      },
      {
        label: "Tour 3N2Đ",
        sub: "Thứ 6 - CN",
        action: () => applyPreset(diffToFriday, 3, 6, 18),
      },
      {
        label: "Đi trong ngày",
        sub: "Chủ nhật (1N)",
        action: () => applyPreset(diffToSaturday + 1, 1, 5, 17),
      },
    ];
  }, []);

  const startDisplay = useMemo(() => formatDisplayDate(startDateInput), [startDateInput]);
  const endDisplay = useMemo(() => formatDisplayDate(endDateInput), [endDateInput]);

  const { durationText, isInvalid: isTimeInvalid } = useMemo(
    () => computeDurationText(startAt, endAt),
    [startAt, endAt],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 2: Thông tin chuyến đi</Text>
      <Text style={styles.stepDescription}>
        Đặt tên và ghi chú thời gian khởi hành để các thành viên nắm rõ lịch trình.
      </Text>

      {/* 1. Tên chuyến đi (Sử dụng UI Component FormField + Input chuẩn) */}
      <FormField label="Tên chuyến đi" required style={styles.field}>
        <Input
          placeholder="Ví dụ: Chuyến đi: Cung đường Cột Điện - Đỉnh Núi Bà Đen"
          value={title}
          onChangeText={onChangeTitle}
          maxLength={150}
        />
      </FormField>

      {/* 2. Mô tả / Ghi chú cho đoàn (Sử dụng Textarea chuẩn) */}
      <FormField label="Mô tả / Ghi chú cho đoàn" style={styles.field}>
        <Textarea
          placeholder="Ví dụ: Mang theo lều, đồ ăn nhẹ và 2 lít nước..."
          value={description}
          onChangeText={onChangeDescription}
          rows={3}
          maxLength={5000}
        />
      </FormField>

      {/* 3. Lịch trình chuyến đi (Chuẩn SurfaceCard & Clean UX) */}
      <SurfaceCard padding="md" style={styles.scheduleCard}>
        {/* Header mục lịch trình: Gọn gàng, loại bỏ các badge AI / tự động tính */}
        <View style={styles.scheduleHeader}>
          <View style={styles.scheduleTitleRow}>
            <View style={styles.scheduleIconWrap}>
              <Ionicons name="calendar" size={16} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.scheduleTitle}>Thời gian & Lịch trình</Text>
              <Text style={styles.scheduleSubtitle}>Chọn ngày xuất phát và dự kiến trở về</Text>
            </View>
          </View>
        </View>

        {/* Gợi ý lịch trình nhanh: Bỏ tia sét/icon AI, dùng icon lịch nhỏ tinh tế */}
        <View style={styles.presetsContainer}>
          <Text style={styles.presetsLabel}>Gợi ý lịch trình phổ biến:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}
          >
            {quickPresets.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetChip}
                onPress={preset.action}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-clear-outline" size={13} color={Colors.primary} />
                <View>
                  <Text style={styles.presetChipLabel}>{preset.label}</Text>
                  <Text style={styles.presetChipSub}>{preset.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date Time Selection: Bố cục 2 cột thoáng đãng, dễ chạm */}
        <View style={styles.dateTimeGrid}>
          {/* Cột 1: Khởi hành */}
          <View style={styles.colContainer}>
            <View style={styles.colHeader}>
              <View style={[styles.colDot, { backgroundColor: "#16A34A" }]} />
              <Text style={styles.colTitle}>Khởi hành *</Text>
            </View>

            {/* Khối chọn Ngày */}
            <TouchableOpacity
              style={styles.datePickerCard}
              onPress={() => setDatePickerTarget("start")}
              activeOpacity={0.75}
            >
              <View style={styles.dateTextGroup}>
                <Text style={styles.dayOfWeekText}>{startDisplay.dayName || "Ngày đi"}</Text>
                <Text style={styles.dateMainText}>{startDisplay.formatted}</Text>
              </View>
              <Ionicons name="chevron-down" size={15} color={Colors.primary} />
            </TouchableOpacity>

            {/* Khối chọn Giờ */}
            <View style={styles.timeSection}>
              <View style={styles.timeInputRow}>
                <Ionicons name="time-outline" size={14} color={Colors.onSurfaceVariant} />
                <Text style={styles.timeLabel}>Giờ xuất phát:</Text>
                <TextInput
                  style={styles.timeTextInput}
                  placeholder="06:00"
                  placeholderTextColor={Colors.mute}
                  value={startTimeInput}
                  onChangeText={(val) => handleUpdateStart(startDateInput, val)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>

              {/* Các mốc giờ nhanh */}
              <View style={styles.quickTimeRow}>
                {["05:30", "06:00", "07:00"].map((t) => {
                  const isSelected = startTimeInput === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.quickTimePill,
                        isSelected && styles.quickTimePillActiveStart,
                      ]}
                      onPress={() => handleUpdateStart(startDateInput, t)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.quickTimeText,
                          isSelected && styles.quickTimeTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Cột 2: Dự kiến về */}
          <View style={styles.colContainer}>
            <View style={styles.colHeader}>
              <View style={[styles.colDot, { backgroundColor: "#0284C7" }]} />
              <Text style={styles.colTitle}>Dự kiến về *</Text>
            </View>

            {/* Khối chọn Ngày */}
            <TouchableOpacity
              style={[styles.datePickerCard, styles.datePickerCardEnd]}
              onPress={() => setDatePickerTarget("end")}
              activeOpacity={0.75}
            >
              <View style={styles.dateTextGroup}>
                <Text style={[styles.dayOfWeekText, { color: "#0284C7" }]}>
                  {endDisplay.dayName || "Ngày về"}
                </Text>
                <Text style={styles.dateMainText}>{endDisplay.formatted}</Text>
              </View>
              <Ionicons name="chevron-down" size={15} color="#0284C7" />
            </TouchableOpacity>

            {/* Khối chọn Giờ */}
            <View style={styles.timeSection}>
              <View style={styles.timeInputRow}>
                <Ionicons name="time-outline" size={14} color={Colors.onSurfaceVariant} />
                <Text style={styles.timeLabel}>Giờ về:</Text>
                <TextInput
                  style={styles.timeTextInput}
                  placeholder="18:00"
                  placeholderTextColor={Colors.mute}
                  value={endTimeInput}
                  onChangeText={(val) => handleUpdateEnd(endDateInput, val)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>

              {/* Các mốc giờ nhanh */}
              <View style={styles.quickTimeRow}>
                {["16:00", "17:00", "18:00"].map((t) => {
                  const isSelected = endTimeInput === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.quickTimePill,
                        isSelected && styles.quickTimePillActiveEnd,
                      ]}
                      onPress={() => handleUpdateEnd(endDateInput, t)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.quickTimeText,
                          isSelected && styles.quickTimeTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Duration Summary Bar (Hiển thị thời lượng được tính đúng chuẩn ngày đêm) */}
        <View
          style={[
            styles.durationBar,
            isTimeInvalid && styles.durationBarError,
          ]}
        >
          <Ionicons
            name={isTimeInvalid ? "alert-circle" : "time-outline"}
            size={16}
            color={isTimeInvalid ? "#DC2626" : "#166534"}
          />
          <Text
            style={[
              styles.durationText,
              isTimeInvalid && styles.durationTextError,
            ]}
          >
            {durationText}
          </Text>
        </View>
      </SurfaceCard>

      {/* Wheel Date Picker Modals */}
      <WheelDatePickerModal
        visible={datePickerTarget === "start"}
        title="Chọn ngày khởi hành"
        initialDate={startDateInput}
        minDate={minAllowedStart}
        minimumDate={minAllowedStart}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={handleConfirmWheelDate}
      />

      <WheelDatePickerModal
        visible={datePickerTarget === "end"}
        title="Chọn ngày dự kiến về"
        initialDate={endDateInput || startDateInput}
        minDate={parseVnDate(startDateInput) || minAllowedStart}
        minimumDate={parseVnDate(startDateInput) || minAllowedStart}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={handleConfirmWheelDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 16,
  },
  field: {
    marginBottom: 14,
  },
  scheduleCard: {
    marginBottom: 16,
  },
  scheduleHeader: {
    marginBottom: 12,
  },
  scheduleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scheduleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  scheduleSubtitle: {
    fontSize: 11.5,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  presetsContainer: {
    marginBottom: 14,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  presetsScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  presetChipLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  presetChipSub: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  dateTimeGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  colContainer: {
    flex: 1,
    gap: 8,
  },
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  colDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  colTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  datePickerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  datePickerCardEnd: {
    borderColor: "#BAE6FD",
  },
  dateTextGroup: {
    flex: 1,
  },
  dayOfWeekText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 1,
  },
  dateMainText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  timeSection: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    gap: 6,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeLabel: {
    fontSize: 10.5,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  timeTextInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "800",
    color: Colors.onSurface,
    textAlign: "right",
    padding: 0,
  },
  quickTimeRow: {
    flexDirection: "row",
    gap: 4,
  },
  quickTimePill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  quickTimePillActiveStart: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickTimePillActiveEnd: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  quickTimeText: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  quickTimeTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  durationBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.md,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginTop: 4,
  },
  durationBarError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  durationText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#166534",
  },
  durationTextError: {
    color: "#DC2626",
  },
});
