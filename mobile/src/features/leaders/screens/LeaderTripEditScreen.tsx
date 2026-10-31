import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getLeaderPublicTripById,
  requestTripCancellation,
  updatePublicTrip,
  type LeaderPublicTrip,
} from "@/features/leaders/services/leader-public-trips.api";
import { validateTripDates } from "@/features/leaders/utils/tripDateUtils";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatIsoToVnDate(isoStr?: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "";
  }
}

function parseDateToIso(str: string, timeStr = "06:00:00"): string {
  const trimmed = str.trim();
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return new Date(`${year}-${month}-${day}T${timeStr}.000Z`).toISOString();
    }
  }
  if (trimmed.includes("-")) {
    return new Date(`${trimmed}T${timeStr}.000Z`).toISOString();
  }
  return new Date(trimmed).toISOString();
}

/** Parse "DD/MM/YYYY" + "HH:mm" theo GIỜ ĐỊA PHƯƠNG (deadline cần khớp đúng giờ leader nhập). Trả null nếu sai định dạng. */
function parseLocalDateTimeToIso(dateStr: string, timeStr: string): string | null {
  const trimmed = dateStr.trim();
  const parts = trimmed.includes("/")
    ? trimmed.split("/")
    : null;
  if (!parts || parts.length !== 3) return null;
  const [hh, mm] = timeStr.split(":");
  const local = new Date(
    Number(parts[2]),
    Number(parts[1]) - 1,
    Number(parts[0]),
    Number(hh),
    Number(mm),
    0,
    0,
  );
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function LeaderTripEditScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ tripId?: string; id?: string }>();
  const tripId = searchParams.tripId || searchParams.id;

  const { accessToken } = useAuth();

  const [trip, setTrip] = useState<LeaderPublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacity, setCapacity] = useState(15);
  const [minPax, setMinPax] = useState(5);
  const [price, setPrice] = useState("2850000");
  const [priceExplanation, setPriceExplanation] = useState("");
  // Hạn đóng form (registrationDeadlineAt) — để trống giữ nguyên giá trị hiện tại
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("12:30");

  // Modal hủy chuyến
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const loadTrip = useCallback(async () => {
    if (!tripId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getLeaderPublicTripById(tripId, accessToken);
      setTrip(res);
      setTitle(res.title || "");
      setDescription(res.description || "");
      setStartDate(formatIsoToVnDate(res.startAt));
      setEndDate(formatIsoToVnDate(res.endAt));
      setCapacity(res.capacity || 15);
      setMinPax(res.minPax || 5);
      setPrice(String(res.price || res.pricePerPax || "2850000").replace(/\D/g, ""));
      setPriceExplanation(res.priceExplanation || "");
      setDeadlineDate(formatIsoToVnDate(res.registrationDeadlineAt));
      const existingDeadline = res.registrationDeadlineAt
        ? new Date(res.registrationDeadlineAt)
        : null;
      setDeadlineTime(
        existingDeadline && !isNaN(existingDeadline.getTime())
          ? `${String(existingDeadline.getHours()).padStart(2, "0")}:${String(existingDeadline.getMinutes()).padStart(2, "0")}`
          : "12:30",
      );
    } catch (err: any) {
      setError(err?.message || "Không thể tải thông tin chuyến đi.");
    } finally {
      setLoading(false);
    }
  }, [tripId, accessToken]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  const handleCapacityChange = (delta: number) => {
    setCapacity((prev) => Math.max(1, Math.min(30, prev + delta)));
  };

  const handleSave = async () => {
    if (!tripId || !accessToken || !trip) return;

    if (!title.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tiêu đề chuyến đi.");
      return;
    }

    const dateCheck = validateTripDates(startDate, endDate);
    if (!dateCheck.isValid) {
      Alert.alert("Lỗi ngày tháng", dateCheck.startError || dateCheck.endError || "Ngày tháng không hợp lệ.");
      return;
    }

    const cleanPrice = String(price).replace(/\D/g, "");
    if (!cleanPrice) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập giá vé hợp lệ.");
      return;
    }

    // Hạn đóng form (tuỳ chọn) — chỉ gửi lên khi leader có nhập
    let deadlineIso: string | undefined;
    if (deadlineDate.trim()) {
      const trimmedTime = deadlineTime.trim() || "12:30";
      if (!/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
        Alert.alert("Lỗi giờ", "Giờ đóng form phải theo định dạng HH:mm (ví dụ 12:30).");
        return;
      }
      const [rawHour, rawMin] = trimmedTime.split(":");
      if (Number(rawHour) > 23 || Number(rawMin) > 59) {
        Alert.alert("Lỗi giờ", "Giờ đóng form không hợp lệ.");
        return;
      }
      deadlineIso =
        parseLocalDateTimeToIso(
          deadlineDate,
          `${rawHour.padStart(2, "0")}:${rawMin}`,
        ) ?? undefined;
      const deadlineObj = deadlineIso ? new Date(deadlineIso) : null;
      const startObj = new Date(parseDateToIso(startDate, "06:00:00"));
      if (!deadlineObj || isNaN(deadlineObj.getTime()) || isNaN(startObj.getTime())) {
        Alert.alert("Lỗi ngày tháng", "Ngày đóng form không hợp lệ. Định dạng: DD/MM/YYYY.");
        return;
      }
      if (deadlineObj.getTime() >= startObj.getTime()) {
        Alert.alert("Lỗi ngày tháng", "Hạn đóng form phải trước giờ khởi hành của chuyến đi.");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const startIso = parseDateToIso(startDate, "06:00:00");
      const endIso = parseDateToIso(endDate, "18:00:00");

      const updated = await updatePublicTrip(
        tripId,
        {
          expectedVersion: trip.version,
          title: title.trim(),
          description: description.trim() || null,
          priceExplanation: priceExplanation.trim() || null,
          capacity,
          price: cleanPrice,
          startAt: startIso,
          endAt: endIso,
          ...(deadlineIso ? { registrationDeadlineAt: deadlineIso } : {}),
        },
        accessToken,
      );

      setTrip(updated);
      Alert.alert(
        "Thành công",
        "Thông tin chuyến đi đã được cập nhật thành công.",
        [
          {
            text: "Xem chi tiết",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (err: any) {
      setError(err?.message || "Không thể lưu thay đổi chuyến đi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!tripId || !accessToken || !trip) return;
    if (!cancelReason.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập lý do hủy chuyến.");
      return;
    }

    setIsCancelling(true);
    try {
      await requestTripCancellation(
        tripId,
        {
          expectedVersion: trip.version,
          reason: cancelReason.trim(),
          evidenceUrls: [],
        },
        accessToken,
      );
      setShowCancelModal(false);
      setCancelReason("");
      Alert.alert(
        "Yêu cầu đã gửi",
        "Yêu cầu hủy chuyến đã được ghi nhận (CANCEL_PENDING). Ban quản trị sẽ đối soát và xử lý hoàn tiền theo quy định.",
        [
          {
            text: "Về danh sách",
            onPress: () => router.replace("/field-operations/leader-trips" as any),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert("Lỗi hủy chuyến", err?.message || "Không thể gửi yêu cầu hủy chuyến.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0e0f0c" />
          <Text style={styles.loadingText}>Đang tải thông tin chuyến đi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={48} color="#ba1a1a" />
          <Text style={styles.errorTitle}>Lỗi tải chuyến đi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => router.back()}>
            <Text style={styles.primaryActionBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const shortId = trip ? `#${trip.id.slice(0, 8).toUpperCase()}` : "";
  const canCancel = trip && (trip.status === "DRAFT" || trip.status === "OPEN" || trip.status === "FULL");

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Chỉnh sửa Chuyến đi</Text>
            <Text style={styles.headerSubtitle}>{shortId} · Phiên bản v{trip?.version}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {Boolean(error) && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#ba1a1a" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* 1. THÔNG TIN CƠ BẢN */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={18} color="#0e0f0c" />
            <Text style={styles.cardTitle}>1. THÔNG TIN CƠ BẢN</Text>
          </View>

          {/* Tiêu đề */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tiêu đề chuyến đi *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Nhập tên chuyến đi..."
              placeholderTextColor="#707972"
              style={styles.textInput}
            />
          </View>

          {/* Loại hình */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loại hình chuyến đi</Text>
            <View style={styles.fixedTypeBox}>
              <Ionicons name="shield-checkmark" size={16} color="#0e0f0c" />
              <Text style={styles.fixedTypeText}>Chuyến đi Công khai (Public Trip)</Text>
            </View>
          </View>

          {/* Mô tả */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mô tả chi tiết & Lịch trình tóm tắt</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Nhập mô tả lịch trình chi tiết..."
              placeholderTextColor="#707972"
              multiline
              numberOfLines={4}
              style={[styles.textInput, styles.multilineInput]}
            />
          </View>
        </View>

        {/* 2. LỊCH TRÌNH & THỜI GIAN */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={18} color="#0e0f0c" />
            <Text style={styles.cardTitle}>2. LỊCH TRÌNH & THỜI GIAN</Text>
          </View>

          <View style={styles.dateRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Ngày khởi hành *</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#707972"
                style={styles.textInput}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Ngày hoàn thành *</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#707972"
                style={styles.textInput}
              />
            </View>
          </View>
          <Text style={styles.inputHint}>
            Định dạng ngày: DD/MM/YYYY. Ngày kết thúc không được trước ngày khởi hành.
          </Text>
        </View>

        {/* 3. QUY MÔ ĐOÀN & CƠ CẤU GIÁ VÉ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="pricetag-outline" size={18} color="#0e0f0c" />
            <Text style={styles.cardTitle}>3. QUY MÔ ĐOÀN & CƠ CẤU GIÁ VÉ</Text>
          </View>

          {/* Số thành viên tối đa */}
          <View style={styles.inputGroup}>
            <View style={styles.stepperHeader}>
              <Text style={styles.inputLabel}>Số thành viên tối đa *</Text>
              <Text style={styles.stepperCap}>{capacity} / 30 Thành viên</Text>
            </View>
            <View style={styles.stepperBox}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleCapacityChange(-1)}
              >
                <Ionicons name="remove" size={20} color="#121c2a" />
              </TouchableOpacity>
              <View style={styles.stepperDisplay}>
                <Text style={styles.stepperVal}>{capacity}</Text>
                <Text style={styles.stepperSub}>Người</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepperBtn, styles.stepperBtnPlus]}
                onPress={() => handleCapacityChange(1)}
              >
                <Ionicons name="add" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Giá vé */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Giá tour trọn gói / người *</Text>
            <View style={styles.priceWrap}>
              <TextInput
                value={price}
                onChangeText={(v) => setPrice(v.replace(/\D/g, ""))}
                placeholder="2850000"
                placeholderTextColor="#707972"
                keyboardType="numeric"
                style={styles.priceInput}
              />
              <Text style={styles.priceUnit}>VNĐ</Text>
            </View>
            <Text style={styles.inputHint}>
              Tương đương: {Number(price || 0).toLocaleString("vi-VN")} đ / người (đã gồm bảo hiểm VFRS).
            </Text>
          </View>

          {/* Price Explanation */}
          <View style={styles.inputGroup}>
            <View style={styles.stepperHeader}>
              <Text style={styles.inputLabel}>Cơ sở tính giá & Giải trình chi phí (Nội bộ) *</Text>
              <Text style={styles.charCountText}>{priceExplanation.length}/5000</Text>
            </View>
            <TextInput
              value={priceExplanation}
              onChangeText={setPriceExplanation}
              placeholder="Chi tiết chi phí ăn uống, lán trại, porter, bảo hiểm, thù lao Mountain Leader..."
              placeholderTextColor="#707972"
              multiline
              numberOfLines={4}
              maxLength={5000}
              style={[styles.textInput, styles.multilineInput]}
            />
          </View>
        </View>

        {/* 4. HẠN ĐÓNG FORM ĐĂNG KÝ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={18} color="#0e0f0c" />
            <Text style={styles.cardTitle}>4. HẠN ĐÓNG FORM ĐĂNG KÝ</Text>
          </View>

          <View style={styles.dateRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Ngày đóng form</Text>
              <TextInput
                value={deadlineDate}
                onChangeText={setDeadlineDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#707972"
                style={styles.textInput}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Giờ đóng form</Text>
              <TextInput
                value={deadlineTime}
                onChangeText={setDeadlineTime}
                placeholder="HH:mm"
                placeholderTextColor="#707972"
                style={styles.textInput}
              />
            </View>
          </View>
          <Text style={styles.inputHint}>
            Hệ thống tự đóng sổ nhận đăng ký khi tới hạn (mặc định trước khởi hành 2 ngày, tối
            thiểu trước 1 ngày). Để trống nếu muốn giữ nguyên hạn hiện tại.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSubmitting}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
              </>
            )}
          </TouchableOpacity>

          {canCancel && (
            <TouchableOpacity
              style={styles.cancelTripBtn}
              onPress={() => {
                setShowCancelModal(true);
                setCancelReason("");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ba1a1a" />
              <Text style={styles.cancelTripBtnText}>Hủy chuyến đi này</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* MODAL: HỦY CHUYẾN ĐI */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color="#ba1a1a" />
              <Text style={styles.modalTitle}>Yêu cầu hủy chuyến đi</Text>
            </View>
            <Text style={styles.modalDesc}>
              Thao tác này sẽ chuyển chuyến đi sang trạng thái Chờ hủy (CANCEL_PENDING). Hệ thống sẽ thông báo cho các Trekker đã đăng ký và kích hoạt quy trình hoàn tiền.
            </Text>

            <Text style={styles.modalSectionLabel}>Lý do hủy chuyến (Bắt buộc) *</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ví dụ: Điều kiện thời tiết bất khả kháng có bão lớn, sạt lở đất theo cảnh báo khí tượng VFRS..."
              placeholderTextColor="#707972"
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={styles.modalInput}
            />
            <Text style={styles.charCountText}>{cancelReason.length}/2000 ký tự</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowCancelModal(false)}
                disabled={isCancelling}
              >
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmKickBtn,
                  (!cancelReason.trim() || isCancelling) && styles.disabledBtn,
                ]}
                onPress={handleConfirmCancel}
                disabled={!cancelReason.trim() || isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmKickText}>Xác nhận hủy chuyến</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8ebe6",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#707972",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  errorText: {
    fontSize: 13,
    color: "#410002",
    textAlign: "center",
  },
  primaryActionBtn: {
    backgroundColor: "#0e0f0c",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  primaryActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9e2",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#121c2a",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#707972",
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff8f7",
    borderWidth: 1,
    borderColor: "#ffdad6",
    borderRadius: 20,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#ba1a1a",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d6dbd2",
    ...Shadows.card,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#121c2a",
    letterSpacing: 0.5,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
  },
  inputHint: {
    fontSize: 11,
    color: "#707972",
    lineHeight: 15,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#d6dbd2",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#121c2a",
    backgroundColor: "#fbfcfb",
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  fixedTypeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#d1e8d5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fixedTypeText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
  },
  stepperHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperCap: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0e0f0c",
  },
  stepperBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e8ebe6",
    borderWidth: 1,
    borderColor: "#d6dbd2",
    borderRadius: 20,
    padding: 8,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d6dbd2",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPlus: {
    backgroundColor: "#0e0f0c",
    borderColor: "#0e0f0c",
  },
  stepperDisplay: {
    alignItems: "center",
  },
  stepperVal: {
    fontSize: 18,
    fontWeight: "900",
    color: "#121c2a",
  },
  stepperSub: {
    fontSize: 10,
    color: "#707972",
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6dbd2",
    borderRadius: 20,
    backgroundColor: "#fbfcfb",
    paddingHorizontal: 12,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "800",
    color: "#121c2a",
  },
  priceUnit: {
    fontSize: 12,
    fontWeight: "800",
    color: "#707972",
  },
  charCountText: {
    fontSize: 10.5,
    color: "#707972",
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0e0f0c",
    paddingVertical: 14,
    borderRadius: 20,
    ...Shadows.card,
  },
  saveBtnDisabled: {
    backgroundColor: "#a2aba3",
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cancelTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff8f7",
    borderWidth: 1,
    borderColor: "#ffdad6",
    paddingVertical: 12,
    borderRadius: 20,
  },
  cancelTripBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 10,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ba1a1a",
  },
  modalDesc: {
    fontSize: 12,
    color: "#414942",
    lineHeight: 17,
  },
  modalSectionLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#121c2a",
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d6dbd2",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: "#121c2a",
    textAlignVertical: "top",
    backgroundColor: "#fbfcfb",
    minHeight: 80,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d6dbd2",
  },
  modalCloseBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#707972",
  },
  modalConfirmKickBtn: {
    flex: 1,
    backgroundColor: "#ba1a1a",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  modalConfirmKickText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#ffffff",
  },
  disabledBtn: {
    backgroundColor: "#a2aba3",
  },
});
