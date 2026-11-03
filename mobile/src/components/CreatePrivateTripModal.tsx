import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

interface CreatePrivateTripModalProps {
  visible: boolean;
  onClose: () => void;
}

type ModalMode = "CREATE" | "JOIN";

export function CreatePrivateTripModal({
  visible,
  onClose,
}: CreatePrivateTripModalProps) {
  const router = useRouter();

  const { trails, trips, createPrivateTrip, joinPrivateTrip } = useApp();

  const [mode, setMode] = useState<ModalMode>("CREATE");
  const [tripName, setTripName] = useState("Chinh phục đỉnh núi cùng bạn bè");
  const [selectedTrailId, setSelectedTrailId] = useState(
    trails[1]?.id ?? trails[0]?.id ?? "",
  );
  const [capacity, setCapacity] = useState("6");
  const [startDate, setStartDate] = useState("15 Tháng 11, 2026");
  const [inviteCode, setInviteCode] = useState("");
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(
    null,
  );

  const privateTrips = useMemo(
    () => trips.filter((trip) => trip.type === "PRIVATE"),
    [trips],
  );

  function closeAndReset() {
    setCreatedTripId(null);
    setCreatedInviteCode(null);
    setInviteCode("");
    setMode("CREATE");
    onClose();
  }

  function openPrivateTrip(tripId: string) {
    closeAndReset();

    router.push({
      pathname: "/private-trips/[id]",
      params: {
        id: tripId,
      },
    } as unknown as Href);
  }

  function handleCreate() {
    if (tripName.trim().length < 5) {
      Alert.alert(
        "Tên chuyến chưa hợp lệ",
        "Tên Private Trip cần có ít nhất 5 ký tự.",
      );
      return;
    }

    const selectedTrail = trails.find((trail) => trail.id === selectedTrailId);

    if (!selectedTrail) {
      Alert.alert("Chưa chọn cung đường", "Hãy chọn một Trail để tiếp tục.");
      return;
    }

    if (!startDate.trim()) {
      Alert.alert("Chưa có ngày đi", "Hãy nhập ngày khởi hành dự kiến.");
      return;
    }

    const newTrip = createPrivateTrip({
      name: tripName.trim(),
      trailId: selectedTrail.id,
      destination: selectedTrail.region,
      startDate: startDate.trim(),
      endDate: startDate.trim(),
      durationDays: Number.parseInt(selectedTrail.duration, 10) || 2,
      capacity: Number.parseInt(capacity, 10) || 6,
    });

    setCreatedTripId(newTrip.id);
    setCreatedInviteCode(newTrip.inviteCode || "TG-PRIVATE");
  }

  function handleJoin() {
    const result = joinPrivateTrip(inviteCode);

    if (!result.ok || !result.trip) {
      Alert.alert("Không thể tham gia", result.message);
      return;
    }

    Alert.alert("Thành công", result.message, [
      {
        text: "Xem chuyến đi",
        onPress: () => openPrivateTrip(result.trip!.id),
      },
    ]);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeAndReset}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.dragHandle} />

          <TouchableOpacity style={styles.closeButton} onPress={closeAndReset}>
            <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {createdTripId && createdInviteCode ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={54}
                    color={Colors.primaryDark}
                  />
                </View>

                <Text style={styles.successTitle}>Đã tạo Private Trip!</Text>

                <Text style={styles.successDescription}>
                  Chuyến đi đã được lưu trong My Trips. Gửi mã bên dưới cho bạn
                  bè để họ tham gia đoàn.
                </Text>

                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>MÃ MỜI THÀNH VIÊN</Text>
                  <Text style={styles.codeText}>{createdInviteCode}</Text>

                  <View style={styles.secureRow}>
                    <Ionicons
                      name="shield-checkmark"
                      size={15}
                      color="#725C00"
                    />
                    <Text style={styles.secureText}>
                      Chỉ người có mã mới xem được chuyến
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => openPrivateTrip(createdTripId)}
                >
                  <Ionicons
                    name="arrow-forward-circle"
                    size={20}
                    color={Colors.onPrimary}
                  />
                  <Text style={styles.submitButtonText}>
                    Xem chi tiết và mời thành viên
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={closeAndReset}
                >
                  <Text style={styles.secondaryButtonText}>
                    Quay lại Chuyến của tôi
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.privatePill}>
                    <Ionicons name="lock-closed" size={12} color="#564500" />
                    <Text style={styles.privatePillText}>PRIVATE TRIP</Text>
                  </View>

                  <Text style={styles.title}>Đi cùng nhóm bạn của bạn</Text>

                  <Text style={styles.subtitle}>
                    Tạo một chuyến riêng hoặc nhập mã để tham gia đoàn đã có.
                  </Text>
                </View>

                <View style={styles.segmentBox}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      mode === "CREATE" && styles.segmentButtonActive,
                    ]}
                    onPress={() => setMode("CREATE")}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={17}
                      color={
                        mode === "CREATE"
                          ? Colors.onPrimary
                          : Colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        mode === "CREATE" && styles.segmentTextActive,
                      ]}
                    >
                      Tạo chuyến
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      mode === "JOIN" && styles.segmentButtonActive,
                    ]}
                    onPress={() => setMode("JOIN")}
                  >
                    <Ionicons
                      name="key-outline"
                      size={17}
                      color={
                        mode === "JOIN"
                          ? Colors.onPrimary
                          : Colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        mode === "JOIN" && styles.segmentTextActive,
                      ]}
                    >
                      Nhập mã mời
                    </Text>
                  </TouchableOpacity>
                </View>

                {mode === "CREATE" ? (
                  <View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Tên chuyến đi</Text>
                      <TextInput
                        style={styles.textInput}
                        value={tripName}
                        onChangeText={setTripName}
                        placeholder="VD: Săn mây Tà Xùa cùng Team Dev"
                        placeholderTextColor={Colors.onSurfaceVariant}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Ngày khởi hành dự kiến</Text>
                      <View style={styles.inputWithIcon}>
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={Colors.primaryDark}
                        />
                        <TextInput
                          style={styles.inputFlex}
                          value={startDate}
                          onChangeText={setStartDate}
                          placeholder="15 Tháng 11, 2026"
                          placeholderTextColor={Colors.onSurfaceVariant}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Chọn cung đường</Text>

                      <View style={styles.trailList}>
                        {trails.map((trail) => {
                          const selected = selectedTrailId === trail.id;

                          return (
                            <TouchableOpacity
                              key={trail.id}
                              style={[
                                styles.trailOption,
                                selected && styles.trailOptionSelected,
                              ]}
                              onPress={() => setSelectedTrailId(trail.id)}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={
                                  selected
                                    ? "radio-button-on"
                                    : "radio-button-off"
                                }
                                size={17}
                                color={
                                  selected
                                    ? Colors.primaryDark
                                    : Colors.onSurfaceVariant
                                }
                              />

                              <View style={styles.flexOne}>
                                <Text style={styles.trailName}>
                                  {trail.name}
                                </Text>
                                <Text style={styles.trailMeta}>
                                  {trail.region} · {trail.distanceKm} km ·{" "}
                                  {trail.difficulty}
                                </Text>
                              </View>

                              <View style={styles.durationBadge}>
                                <Text style={styles.durationText}>
                                  {trail.duration}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Số thành viên tối đa</Text>

                      <View style={styles.capacityRow}>
                        {["4", "6", "8", "12"].map((number) => (
                          <TouchableOpacity
                            key={number}
                            style={[
                              styles.capacityPill,
                              capacity === number && styles.capacityPillActive,
                            ]}
                            onPress={() => setCapacity(number)}
                          >
                            <Text
                              style={[
                                styles.capacityText,
                                capacity === number &&
                                  styles.capacityTextActive,
                              ]}
                            >
                              {number} người
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.infoNotice}>
                      <Ionicons
                        name="information-circle-outline"
                        size={19}
                        color={Colors.primaryDark}
                      />
                      <Text style={styles.infoNoticeText}>
                        Private Trip không xuất hiện công khai trong Explore.
                        Thành viên chỉ tham gia bằng mã mời.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleCreate}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="add-circle"
                        size={20}
                        color={Colors.onPrimary}
                      />
                      <Text style={styles.submitButtonText}>
                        Tạo chuyến và nhận mã mời
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={styles.joinHero}>
                      <View style={styles.joinIcon}>
                        <Ionicons
                          name="people-outline"
                          size={30}
                          color={Colors.primaryDark}
                        />
                      </View>

                      <Text style={styles.joinTitle}>
                        Bạn đã nhận được mã mời?
                      </Text>

                      <Text style={styles.joinDescription}>
                        Nhập mã do Host gửi để xem thông tin và tham gia đoàn.
                      </Text>
                    </View>

                    <TextInput
                      style={styles.codeInput}
                      value={inviteCode}
                      onChangeText={(value) =>
                        setInviteCode(value.toUpperCase())
                      }
                      placeholder="TG-XXXXX"
                      placeholderTextColor={Colors.onSurfaceVariant}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={12}
                    />

                    <Text style={styles.demoHint}>
                      Mã dùng để demo tham gia chuyến của bạn bè: TG-DEMO
                    </Text>

                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleJoin}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="enter-outline"
                        size={20}
                        color={Colors.onPrimary}
                      />
                      <Text style={styles.submitButtonText}>
                        Kiểm tra và tham gia chuyến
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {privateTrips.length > 0 ? (
                  <View style={styles.currentTripsSection}>
                    <Text style={styles.currentTripsTitle}>
                      Private Trip hiện có
                    </Text>

                    {privateTrips.slice(0, 3).map((trip) => (
                      <TouchableOpacity
                        key={trip.id}
                        style={styles.currentTripRow}
                        onPress={() => openPrivateTrip(trip.id)}
                      >
                        <View style={styles.currentTripIcon}>
                          <Ionicons
                            name="trail-sign-outline"
                            size={18}
                            color={Colors.primaryDark}
                          />
                        </View>

                        <View style={styles.flexOne}>
                          <Text
                            style={styles.currentTripName}
                            numberOfLines={1}
                          >
                            {trip.name}
                          </Text>
                          <Text style={styles.currentTripMeta}>
                            {trip.enrolledCount}/{trip.capacity} người ·{" "}
                            {trip.inviteCode}
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={Colors.primaryDark}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  container: {
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.surface,
    ...Shadows.hover,
  },
  dragHandle: {
    width: 40,
    height: 4,
    marginBottom: 10,
    alignSelf: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 34,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    paddingRight: 40,
    marginBottom: 16,
  },
  privatePill: {
    marginBottom: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.tertiaryFixed,
  },
  privatePillText: {
    color: "#564500",
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    color: Colors.onSurface,
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
  },
  segmentBox: {
    marginBottom: 18,
    padding: 3,
    flexDirection: "row",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primaryContainer,
  },
  segmentText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: Colors.onPrimary,
    fontWeight: "900",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "800",
  },
  textInput: {
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    fontSize: 13,
  },
  inputWithIcon: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  inputFlex: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 13,
  },
  trailList: {
    gap: 8,
  },
  trailOption: {
    minHeight: 62,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  trailOptionSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryPale,
  },
  trailName: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
  },
  trailMeta: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  durationBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  durationText: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "800",
  },
  capacityRow: {
    flexDirection: "row",
    gap: 7,
  },
  capacityPill: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  capacityPillActive: {
    borderColor: Colors.primaryContainer,
    backgroundColor: Colors.primaryContainer,
  },
  capacityText: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "800",
  },
  capacityTextActive: {
    color: Colors.onPrimary,
  },
  infoNotice: {
    marginBottom: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  infoNoticeText: {
    flex: 1,
    color: Colors.primaryDark,
    fontSize: 10,
    lineHeight: 15,
  },
  submitButton: {
    minHeight: 51,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    ...Shadows.hover,
  },
  submitButtonText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 46,
    marginTop: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  secondaryButtonText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "800",
  },
  successBox: {
    paddingTop: 18,
    alignItems: "center",
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  successDescription: {
    marginTop: 8,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  codeContainer: {
    width: "100%",
    marginVertical: 18,
    padding: 17,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#F5CF55",
    borderRadius: Radius.xl,
    backgroundColor: "#FFF9E6",
  },
  codeLabel: {
    color: "#725C00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  codeText: {
    marginTop: 6,
    color: "#231B00",
    fontFamily: "monospace",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 3,
  },
  secureRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secureText: {
    color: "#725C00",
    fontSize: 9,
    fontWeight: "700",
  },
  joinHero: {
    paddingVertical: 6,
    alignItems: "center",
  },
  joinIcon: {
    width: 66,
    height: 66,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 33,
    backgroundColor: Colors.primaryPale,
  },
  joinTitle: {
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "900",
  },
  joinDescription: {
    marginTop: 5,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  codeInput: {
    height: 60,
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.primaryDark,
    fontFamily: "monospace",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
  },
  demoHint: {
    marginTop: 7,
    marginBottom: 14,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    textAlign: "center",
  },
  currentTripsSection: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  currentTripsTitle: {
    marginBottom: 9,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "900",
  },
  currentTripRow: {
    minHeight: 58,
    marginBottom: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  currentTripIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  currentTripName: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "800",
  },
  currentTripMeta: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
  },
});
