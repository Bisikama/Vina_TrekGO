/**
 * Date validation and utility functions for Leader Trip Creation
 */

export function parseVnDate(str: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  const parts = trimmed.includes("/") ? trimmed.split("/") : trimmed.includes("-") ? trimmed.split("-") : [];
  
  if (parts.length === 3) {
    let day: number, month: number, year: number;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (year < 2024 || year > 2035) return null;
    if (month < 0 || month > 11) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month, day, 0, 0, 0, 0);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }
  return null;
}

export function formatVnDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function getDayOfWeekName(date: Date): string {
  const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  return days[date.getDay()];
}

export function calculateTripDuration(start: Date, end: Date): { days: number; nights: number; text: string } {
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const days = Math.max(1, diffDays);
  const nights = Math.max(0, days - 1);
  const text = nights === 0 ? "1 ngày trong ngày" : `${days}N${nights}Đ (${days} ngày ${nights} đêm)`;
  return { days, nights, text };
}

export interface DateValidationResult {
  isValid: boolean;
  startError?: string;
  endError?: string;
  durationText?: string;
  startDayName?: string;
  endDayName?: string;
}

export function validateTripDates(startDateStr: string, endDateStr: string): DateValidationResult {
  const result: DateValidationResult = { isValid: true };

  const trimmedStart = startDateStr.trim();
  const trimmedEnd = endDateStr.trim();

  if (!trimmedStart) {
    result.isValid = false;
    result.startError = "Vui lòng nhập ngày khởi hành.";
    return result;
  }

  const startDate = parseVnDate(trimmedStart);
  if (!startDate) {
    result.isValid = false;
    result.startError = "Định dạng ngày không hợp lệ. Vui lòng nhập DD/MM/YYYY.";
    return result;
  }
  result.startDayName = getDayOfWeekName(startDate);

  // Constraint 1: Ngày khởi hành không được trong quá khứ (từ ngày mai trở đi)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (startDate.getTime() < tomorrow.getTime()) {
    result.isValid = false;
    result.startError = "Không được chọn ngày trong quá khứ hoặc hôm nay. Ngày khởi hành phải từ ngày mai trở đi.";
  }

  if (!trimmedEnd) {
    result.isValid = false;
    result.endError = "Vui lòng nhập ngày kết thúc dự kiến.";
    return result;
  }

  const endDate = parseVnDate(trimmedEnd);
  if (!endDate) {
    result.isValid = false;
    result.endError = "Định dạng ngày không hợp lệ. Vui lòng nhập DD/MM/YYYY.";
    return result;
  }
  result.endDayName = getDayOfWeekName(endDate);

  // Constraint 2: Ngày kết thúc không được trong quá khứ và không được trước ngày đi
  if (endDate.getTime() < tomorrow.getTime()) {
    result.isValid = false;
    result.endError = "Không được chọn ngày trong quá khứ. Ngày kết thúc phải từ ngày mai trở đi.";
    return result;
  }

  if (endDate.getTime() < startDate.getTime()) {
    result.isValid = false;
    result.endError = "Ngày kết thúc không được trước ngày khởi hành.";
    return result;
  }

  // Constraint 3: Chuyến đi kéo dài tối đa 30 ngày
  const { days, text } = calculateTripDuration(startDate, endDate);
  if (days > 30) {
    result.isValid = false;
    result.endError = "Chuyến đi không thể kéo dài quá 30 ngày.";
    return result;
  }

  result.durationText = text;
  return result;
}

export function getQuickDatePresets(): Array<{
  label: string;
  durationLabel: string;
  startDate: string;
  endDate: string;
}> {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Preset 1: Cuối tuần này (Thứ 6 -> Chủ nhật tới)
  const thisFriday = new Date(base);
  const day = thisFriday.getDay();
  const diffToFriday = (5 - day + 7) % 7 || 7; // Next Friday
  thisFriday.setDate(thisFriday.getDate() + diffToFriday);

  const thisSunday = new Date(thisFriday);
  thisSunday.setDate(thisSunday.getDate() + 2);

  // Preset 2: Cuối tuần sau (3N2Đ)
  const nextFriday = new Date(thisFriday);
  nextFriday.setDate(nextFriday.getDate() + 7);
  const nextSunday = new Date(nextFriday);
  nextSunday.setDate(nextSunday.getDate() + 2);

  // Preset 3: 2 tuần tới (Thứ 7 - Chủ nhật: 2N1Đ)
  const nextSaturday = new Date(thisFriday);
  nextSaturday.setDate(nextSaturday.getDate() + 15);
  const nextSun2 = new Date(nextSaturday);
  nextSun2.setDate(nextSun2.getDate() + 1);

  return [
    {
      label: "Cuối tuần tới",
      durationLabel: "3N2Đ",
      startDate: formatVnDate(thisFriday),
      endDate: formatVnDate(thisSunday),
    },
    {
      label: "Tuần tiếp theo",
      durationLabel: "3N2Đ",
      startDate: formatVnDate(nextFriday),
      endDate: formatVnDate(nextSunday),
    },
    {
      label: "Tour 2N1Đ",
      durationLabel: "2N1Đ",
      startDate: formatVnDate(nextSaturday),
      endDate: formatVnDate(nextSun2),
    },
  ];
}
