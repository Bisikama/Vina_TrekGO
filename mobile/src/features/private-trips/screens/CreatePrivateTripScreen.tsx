import { Colors, Radius } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateTripBasicInfoStep } from "../components/CreateTripBasicInfoStep";
import { CreateTripConfigStep } from "../components/CreateTripConfigStep";
import { CreateTripTrailStep } from "../components/CreateTripTrailStep";
import { useCreatePrivateTrip } from "../hooks/useCreatePrivateTrip";
import type { PrivateTrailSource } from "../types";

// Dynamic initial trip dates (next Saturday 06:00 to Sunday 18:00, at least 48h from now)
function getDefaultTripDates() {
  const minAllowedStart = Date.now() + 2 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const day = now.getDay();
  // Next Saturday: if today is Sat (6), jump 7 days, else days until Saturday
  let daysUntilSaturday = (6 - day + 7) % 7 || 7;
  let start = new Date(now);
  start.setDate(now.getDate() + daysUntilSaturday);
  start.setHours(6, 0, 0, 0);

  if (start.getTime() < minAllowedStart) {
    start.setDate(start.getDate() + 7);
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(18, 0, 0, 0);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function CreatePrivateTripScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Wizard step: 1, 2, 3
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // LEADER bị cấm tạo private trip (server trả 403 LEADER_CANNOT_CREATE_PRIVATE_TRIP)
  useEffect(() => {
    if (user?.role === "LEADER") {
      Alert.alert(
        "Không khả dụng cho Leader",
        "Tài khoản Leader không thể tạo chuyến đi riêng. Hãy dùng tài khoản thành viên thường.",
        [{ text: "Quay lại", onPress: () => router.back() }],
      );
    }
  }, [user?.role, router]);

  // Form states
  const [selectedTrail, setSelectedTrail] = useState<PrivateTrailSource | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const initialDates = getDefaultTripDates();
  const [startAt, setStartAt] = useState(initialDates.startAt);
  const [endAt, setEndAt] = useState(initialDates.endAt);
  const [capacity, setCapacity] = useState(5);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string>("");

  // Hook for creation API mutation
  const { createTrip, loading: submitting } = useCreatePrivateTrip();

  // When trail is selected, prefill title if empty
  function handleSelectTrail(trail: PrivateTrailSource) {
    setSelectedTrail(trail);
    if (!title) {
      setTitle(`Chuyến đi: ${trail.name}`);
    }
  }

  // Validate and advance
  function handleNext() {
    if (currentStep === 1) {
      if (!selectedTrail) {
        Alert.alert("Chưa chọn tuyến", "Vui lòng chọn 1 cung đường trước khi tiếp tục.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!title.trim()) {
        Alert.alert("Thiếu tên chuyến", "Vui lòng nhập tên chuyến đi.");
        return;
      }
      if (!startAt.trim() || !endAt.trim()) {
        Alert.alert("Thiếu thời gian", "Vui lòng nhập ngày giờ bắt đầu và kết thúc.");
        return;
      }

      const minAllowedStart = Date.now() + 2 * 24 * 60 * 60 * 1000;
      const sTime = new Date(startAt).getTime();
      const eTime = new Date(endAt).getTime();

      if (isNaN(sTime) || sTime < minAllowedStart) {
        Alert.alert(
          "Thời gian không hợp lệ",
          "Thời gian khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày (48 giờ).",
        );
        return;
      }

      if (isNaN(eTime) || eTime <= sTime) {
        Alert.alert(
          "Thời gian không hợp lệ",
          "Thời gian kết thúc chuyến đi phải sau thời gian khởi hành.",
        );
        return;
      }

      setCurrentStep(3);
    }
  }

  function handleBack() {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((prev) => (prev - 1) as 1 | 2);
    }
  }

function toValidIsoDate(val: string, defaultDaysFromNow = 7): string {
  if (!val || !val.trim()) {
    const d = new Date();
    d.setDate(d.getDate() + defaultDaysFromNow);
    return d.toISOString();
  }
  const clean = val.trim();
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  const parsed2 = new Date(`${clean}T06:00:00.000Z`);
  if (!isNaN(parsed2.getTime())) {
    return parsed2.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + defaultDaysFromNow);
  return d.toISOString();
}

  // Submit create trip
  async function handleSubmit() {
    if (!selectedTrail) return;
    if (!selectedPickupPointId) {
      Alert.alert("Thiếu điểm đón", "Vui lòng chọn điểm đón cho đoàn.");
      return;
    }

    if (!selectedTrail.points || selectedTrail.points.length === 0) {
      Alert.alert(
        "Thiếu trạm dừng",
        "Cung đường này chưa có trạm dừng (checkpoint). Vui lòng chọn cung đường khác hợp lệ.",
      );
      return;
    }

    try {
      const checkpointIds = selectedTrail.points.map((p) => p.id);

      const validStartAt = toValidIsoDate(startAt, 7);
      const validEndAt = toValidIsoDate(endAt, 8);

      const minAllowedStart = Date.now() + 2 * 24 * 60 * 60 * 1000;
      const sTime = new Date(validStartAt).getTime();
      const eTime = new Date(validEndAt).getTime();

      if (isNaN(sTime) || sTime < minAllowedStart) {
        Alert.alert(
          "Thời gian không hợp lệ",
          "Thời gian khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày (48 giờ).",
        );
        return;
      }

      if (isNaN(eTime) || eTime <= sTime) {
        Alert.alert(
          "Thời gian không hợp lệ",
          "Thời gian kết thúc chuyến đi phải sau thời gian khởi hành.",
        );
        return;
      }

      const created = await createTrip({
        type: selectedTrail.type,
        trailRef: selectedTrail.id,
        destinationId: selectedTrail.destinationId,
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: validStartAt,
        endAt: validEndAt,
        pickupPointId: selectedPickupPointId,
        capacity,
        checkpointIds,
      });

      Alert.alert("Thành công", "Đã tạo chuyến đi riêng thành công!", [
        {
          text: "Xem chi tiết",
          onPress: () => {
            router.replace({
              pathname: "/private-trips/[id]",
              params: { id: created.id },
            } as any);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert("Lỗi tạo chuyến", err?.message || "Không thể tạo chuyến đi lúc này.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Tạo chuyến đi riêng</Text>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepIndicatorText}>{currentStep}/3</Text>
        </View>
      </View>

      {/* Wizard Steps indicator */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressSegment,
            currentStep >= 1 && styles.progressSegmentActive,
          ]}
        />
        <View
          style={[
            styles.progressSegment,
            currentStep >= 2 && styles.progressSegmentActive,
          ]}
        />
        <View
          style={[
            styles.progressSegment,
            currentStep >= 3 && styles.progressSegmentActive,
          ]}
        />
      </View>

      {/* Form Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentStep === 1 && (
          <CreateTripTrailStep
            selectedTrailId={selectedTrail?.id}
            onSelectTrail={handleSelectTrail}
          />
        )}

        {currentStep === 2 && (
          <CreateTripBasicInfoStep
            title={title}
            description={description}
            startAt={startAt}
            endAt={endAt}
            onChangeTitle={setTitle}
            onChangeDescription={setDescription}
            onChangeStartAt={setStartAt}
            onChangeEndAt={setEndAt}
          />
        )}

        {currentStep === 3 && (
          <CreateTripConfigStep
            capacity={capacity}
            selectedPickupPointId={selectedPickupPointId}
            destinationId={selectedTrail?.destinationId}
            onChangeCapacity={setCapacity}
            onSelectPickupPoint={setSelectedPickupPointId}
          />
        )}
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footerBar}>
        {currentStep < 3 ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Tiếp tục</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>Tạo chuyến đi</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  stepIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: Colors.surface,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  progressSegmentActive: {
    backgroundColor: Colors.primaryDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  footerBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: Colors.surface,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
