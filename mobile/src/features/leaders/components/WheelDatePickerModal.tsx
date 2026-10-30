import { Colors, Radius, Shadows, Typography } from "@/constants/theme";
import { formatVnDate, getDayOfWeekName, parseVnDate } from "@/features/leaders/utils/tripDateUtils";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220px
const PADDING_VERTICAL = ITEM_HEIGHT * 2; // 88px so first item sits at center

interface WheelDatePickerModalProps {
  visible: boolean;
  title?: string;
  initialDate?: string; // DD/MM/YYYY
  minDate?: Date;
  minimumDate?: Date;
  maxDate?: Date;
  onClose: () => void;
  onConfirm: (dateStr: string, dateObj: Date) => void;
}

interface WheelColumnProps<T> {
  data: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  labelExtractor: (item: T) => string;
  flex?: number;
}

function WheelColumn<T>({
  data,
  selectedIndex,
  onSelect,
  labelExtractor,
  flex = 1,
}: WheelColumnProps<T>) {
  const flatListRef = useRef<FlatList>(null);
  const isUserScrolling = useRef(false);

  // Scroll to index on mount or programmatically changed
  useEffect(() => {
    if (!isUserScrolling.current && flatListRef.current && selectedIndex >= 0 && selectedIndex < data.length) {
      try {
        flatListRef.current.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      } catch {}
    }
  }, [selectedIndex, data.length]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrolling.current = false;
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
    },
    [data.length, onSelect, selectedIndex],
  );

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  return (
    <View style={[styles.wheelCol, { flex }]}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(_, idx) => String(idx)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{
          paddingTop: PADDING_VERTICAL,
          paddingBottom: PADDING_VERTICAL,
        }}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex;
          const distance = Math.abs(index - selectedIndex);
          const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.22;
          const scale = isSelected ? 1.08 : distance === 1 ? 0.92 : 0.82;

          return (
            <TouchableOpacity
              style={styles.wheelItem}
              activeOpacity={0.7}
              onPress={() => {
                if (!isSelected) {
                  onSelect(index);
                  flatListRef.current?.scrollToOffset({
                    offset: index * ITEM_HEIGHT,
                    animated: true,
                  });
                }
              }}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  isSelected && styles.wheelItemTextSelected,
                  { opacity, transform: [{ scale }] },
                ]}
                numberOfLines={1}
              >
                {labelExtractor(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export function WheelDatePickerModal({
  visible,
  title = "Chọn ngày",
  initialDate,
  minDate,
  minimumDate,
  maxDate,
  onClose,
  onConfirm,
}: WheelDatePickerModalProps) {
  const effectiveMinDate = minDate || minimumDate;
  // Current Year range: from current year - 1 up to current year + 6
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y <= currentYear + 6; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Months 1 to 12
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  // Parse initial state or fallback to tomorrow
  const getInitialDayMonthYear = useCallback(() => {
    let d = initialDate ? parseVnDate(initialDate) : null;
    if (!d || isNaN(d.getTime())) {
      d = minDate ? new Date(minDate) : new Date();
      if (!initialDate) {
        d.setDate(d.getDate() + 1); // default tomorrow
      }
    }
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  }, [initialDate, minDate]);

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Sync state whenever modal opens
  useEffect(() => {
    if (visible) {
      const init = getInitialDayMonthYear();
      setSelectedDay(init.day);
      setSelectedMonth(init.month);
      setSelectedYear(init.year);
    }
  }, [visible, getInitialDayMonthYear]);

  // Compute days in month dynamically
  const daysInMonth = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  // Auto-clamp selected day if month changes and has fewer days (e.g. 31 -> 28 in Feb)
  useEffect(() => {
    if (selectedDay > daysInMonth.length) {
      setSelectedDay(daysInMonth.length);
    }
  }, [daysInMonth.length, selectedDay]);

  // Selected date object
  const selectedDateObj = useMemo(() => {
    const clampedDay = Math.min(selectedDay, daysInMonth.length);
    return new Date(selectedYear, selectedMonth - 1, clampedDay, 0, 0, 0, 0);
  }, [selectedYear, selectedMonth, selectedDay, daysInMonth.length]);

  // Validity check against minDate/minimumDate and maxDate
  const validationError = useMemo(() => {
    if (effectiveMinDate) {
      const minD = new Date(effectiveMinDate.getFullYear(), effectiveMinDate.getMonth(), effectiveMinDate.getDate(), 0, 0, 0, 0);
      if (selectedDateObj.getTime() < minD.getTime()) {
        return `Không được chọn trước ngày ${formatVnDate(minD)}`;
      }
    }
    if (maxDate) {
      const maxD = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59, 999);
      if (selectedDateObj.getTime() > maxD.getTime()) {
        return `Không được chọn sau ngày ${formatVnDate(maxD)}`;
      }
    }
    return null;
  }, [selectedDateObj, effectiveMinDate, maxDate]);

  const formattedDateStr = useMemo(() => {
    return formatVnDate(selectedDateObj);
  }, [selectedDateObj]);

  const dayOfWeekStr = useMemo(() => {
    return getDayOfWeekName(selectedDateObj);
  }, [selectedDateObj]);

  // Quick preset shortcuts
  const applyQuickOffset = (daysToAdd: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);
    setSelectedDay(target.getDate());
    setSelectedMonth(target.getMonth() + 1);
    setSelectedYear(target.getFullYear());
  };

  const applyNextWeekend = () => {
    const now = new Date();
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    const sat = new Date(now);
    sat.setDate(now.getDate() + daysUntilSaturday);
    setSelectedDay(sat.getDate());
    setSelectedMonth(sat.getMonth() + 1);
    setSelectedYear(sat.getFullYear());
  };

  const handleConfirm = () => {
    if (validationError) return;
    onConfirm(formattedDateStr, selectedDateObj);
    onClose();
  };

  if (!visible) return null;

  const dayIndex = Math.max(0, daysInMonth.indexOf(selectedDay));
  const monthIndex = Math.max(0, months.indexOf(selectedMonth));
  const yearIndex = Math.max(0, years.indexOf(selectedYear));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <SafeAreaView edges={["bottom"]} style={styles.sheetContainer}>
          {/* Top handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Ionicons name="calendar" size={17} color="#125238" />
              <Text style={styles.headerTitle}>{title}</Text>
            </View>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={Boolean(validationError)}
              style={[styles.confirmBtn, Boolean(validationError) && styles.confirmBtnDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>

          {/* Live Date Preview Banner */}
          <View style={styles.previewCard}>
            <View style={styles.previewLeft}>
              <Text style={styles.previewDayOfWeek}>{dayOfWeekStr}</Text>
              <Text style={styles.previewFullDate}>
                {`Ngày ${String(selectedDay).padStart(2, "0")} tháng ${String(selectedMonth).padStart(2, "0")}, năm ${selectedYear}`}
              </Text>
            </View>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{formattedDateStr}</Text>
            </View>
          </View>

          {/* Validation Error banner if invalid */}
          {validationError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#ba1a1a" />
              <Text style={styles.errorBannerText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Quick Shortcuts */}
          <View style={styles.quickShortcutsRow}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => applyQuickOffset(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>Ngày mai</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={applyNextWeekend}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>Thứ 7 này</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => applyQuickOffset(7)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>+1 tuần</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => applyQuickOffset(14)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>+2 tuần</Text>
            </TouchableOpacity>
          </View>

          {/* WHEEL CONTAINER */}
          <View style={styles.wheelWrapper}>
            {/* Center Selection Indicator Highlight Bar */}
            <View style={styles.selectionHighlight} pointerEvents="none" />

            {/* Gradient Mask Top */}
            <View style={styles.wheelMaskTop} pointerEvents="none" />

            {/* Columns Row */}
            <View style={styles.wheelColumnsRow}>
              {/* Day Column */}
              <WheelColumn
                data={daysInMonth}
                selectedIndex={dayIndex}
                onSelect={(idx) => setSelectedDay(daysInMonth[idx] || 1)}
                labelExtractor={(day) => `Ngày ${String(day).padStart(2, "0")}`}
                flex={1.1}
              />

              {/* Month Column */}
              <WheelColumn
                data={months}
                selectedIndex={monthIndex}
                onSelect={(idx) => setSelectedMonth(months[idx] || 1)}
                labelExtractor={(m) => `Tháng ${m}`}
                flex={1}
              />

              {/* Year Column */}
              <WheelColumn
                data={years}
                selectedIndex={yearIndex}
                onSelect={(idx) => setSelectedYear(years[idx] || currentYear)}
                labelExtractor={(y) => `${y}`}
                flex={0.9}
              />
            </View>

            {/* Gradient Mask Bottom */}
            <View style={styles.wheelMaskBottom} pointerEvents="none" />
          </View>

          {/* Bottom helper guidance */}
          <Text style={styles.footerNote}>
            Cuộn bánh xe hoặc chạm vào các hàng để chọn ngày chính xác
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 14, 0.55)",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "android" ? 16 : 8,
    ...Shadows.card,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 16,
  },
  handleBar: {
    width: 42,
    height: 4.5,
    backgroundColor: "#d9e3f6",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eff4ff",
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelBtnText: {
    fontFamily: "Roboto",
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: "#707972",
    fontWeight: "500",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontFamily: "Roboto",
    fontSize: 16,
    lineHeight: 16 * 1.5,
    fontWeight: "700",
    color: "#125238",
  },
  confirmBtn: {
    backgroundColor: "#125238",
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
  },
  confirmBtnDisabled: {
    backgroundColor: "#c0c9c1",
  },
  confirmBtnText: {
    fontFamily: "Roboto",
    fontSize: 14,
    lineHeight: 14 * 1.5,
    color: "#ffffff",
    fontWeight: "700",
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9ff",
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e6eeff",
  },
  previewLeft: {
    flex: 1,
  },
  previewDayOfWeek: {
    fontFamily: "Roboto",
    fontSize: 13,
    lineHeight: 13 * 1.5,
    color: "#125238",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewFullDate: {
    fontFamily: "Roboto",
    fontSize: 14,
    lineHeight: 14 * 1.5,
    color: "#121c2a",
    fontWeight: "600",
    marginTop: 2,
  },
  previewBadge: {
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  previewBadgeText: {
    fontFamily: "Roboto",
    fontSize: 13,
    lineHeight: 13 * 1.5,
    fontWeight: "700",
    color: "#002113",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffdad6",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  errorBannerText: {
    fontFamily: "Roboto",
    fontSize: 12,
    lineHeight: 12 * 1.5,
    color: "#93000a",
    fontWeight: "500",
    flex: 1,
  },
  quickShortcutsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    flex: 1,
    height: 36,
    backgroundColor: "#eff4ff",
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "#d9e3f6",
  },
  quickChipText: {
    fontFamily: "Roboto",
    fontSize: 11,
    color: "#125238",
    fontWeight: "700",
    textAlign: "center",
  },
  wheelWrapper: {
    height: CONTAINER_HEIGHT,
    marginTop: 14,
    position: "relative",
    justifyContent: "center",
  },
  selectionHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    backgroundColor: "#b1f0cd33",
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: "#125238",
    zIndex: 1,
  },
  wheelMaskTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    backgroundColor: "#ffffffcc",
    zIndex: 2,
  },
  wheelMaskBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    backgroundColor: "#ffffffcc",
    zIndex: 2,
  },
  wheelColumnsRow: {
    flexDirection: "row",
    height: CONTAINER_HEIGHT,
    zIndex: 3,
  },
  wheelCol: {
    height: CONTAINER_HEIGHT,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelItemText: {
    fontFamily: "Roboto",
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: "#404943",
    fontWeight: "500",
  },
  wheelItemTextSelected: {
    color: "#125238",
    fontWeight: "700",
    fontSize: 17,
  },
  footerNote: {
    fontFamily: "Roboto",
    fontSize: 11,
    lineHeight: 11 * 1.5,
    color: "#707972",
    textAlign: "center",
    marginTop: 8,
  },
});
