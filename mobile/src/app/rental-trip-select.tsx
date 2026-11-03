import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";
import { RentalTripOption } from "@/features/rentals/types";
import { ApiError } from "@/lib/api-client";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function RentalTripSelectScreen() {
  const router = useRouter();
  const { accessToken, signOut } = useAuth();
  const { selectedTrip, selectTrip } = useRentalSelection();
  const [trips, setTrips] = useState<RentalTripOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requiresLogin, setRequiresLogin] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!accessToken) {
      setError("Bạn cần đăng nhập để chọn chuyến đi.");
      setRequiresLogin(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    setRequiresLogin(false);
    try {
      setTrips(await rentalApi.listTripOptions(accessToken));
    } catch (requestError) {
      const sessionExpired =
        requestError instanceof ApiError && requestError.status === 401;
      setRequiresLogin(sessionExpired);
      setError(
        sessionExpired
          ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải chuyến đi."
          : requestError instanceof Error
          ? requestError.message
          : "Không tải được danh sách chuyến đi.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTrips();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadTrips]);

  function chooseTrip(trip: RentalTripOption) {
    if (!trip.eligible) return;
    selectTrip(trip);
    router.back();
  }

  async function openLogin() {
    await signOut();
    router.replace("/auth/login" as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>RENTAL CONTEXT</Text>
          <Text style={styles.headerTitle}>Chọn chuyến đi</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="trail-sign" size={20} color={Colors.primaryDark} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.explanationCard}>
          <Ionicons name="information-circle" size={21} color={Colors.primaryDark} />
          <Text style={styles.explanationText}>
            Catalog có thể xem trước. Để kiểm tra tồn kho, báo giá và tạo đơn,
            TrekGo yêu cầu bạn là thành viên hợp lệ của chuyến đi.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.stateDescription}>
              Đang kiểm tra chuyến và quyền thuê...
            </Text>
          </View>
        ) : error ? (
          <StateBlock
            icon="cloud-offline-outline"
            title="Không tải được chuyến đi"
            description={error}
            actionLabel={requiresLogin ? "Đăng nhập lại" : "Thử lại"}
            onAction={() =>
              requiresLogin ? void openLogin() : void loadTrips()
            }
          />
        ) : trips.length === 0 ? (
          <StateBlock
            icon="trail-sign-outline"
            title="Bạn chưa có chuyến hợp lệ"
            description="Hãy tham gia một Public Trip hoặc tạo/tham gia Private Trip trước khi tiếp tục thuê thiết bị."
          >
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => router.replace("/(tabs)/explore" as Href)}
              >
                <Text style={styles.primaryActionText}>Khám phá chuyến đi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.replace("/(tabs)/trips" as Href)}
              >
                <Text style={styles.secondaryActionText}>Tạo Private Trip</Text>
              </TouchableOpacity>
            </View>
          </StateBlock>
        ) : (
          <>
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>Chuyến của bạn</Text>
              <Text style={styles.listCount}>{trips.length} chuyến</Text>
            </View>

            <View style={styles.tripList}>
              {trips.map((trip) => {
                const active = selectedTrip?.id === trip.id;

                return (
                  <TouchableOpacity
                    key={trip.id}
                    activeOpacity={trip.eligible ? 0.8 : 1}
                    style={[
                      styles.tripCard,
                      active && styles.tripCardSelected,
                      !trip.eligible && styles.tripCardDisabled,
                    ]}
                    onPress={() => chooseTrip(trip)}
                  >
                    <View style={styles.tripTopRow}>
                      <View
                        style={[
                          styles.typeBadge,
                          trip.type === "PRIVATE" && styles.privateBadge,
                        ]}
                      >
                        <Text style={styles.typeBadgeText}>
                          {trip.type === "PUBLIC" ? "PUBLIC TRIP" : "PRIVATE TRIP"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.eligibilityBadge,
                          !trip.eligible && styles.ineligibleBadge,
                        ]}
                      >
                        <Ionicons
                          name={trip.eligible ? "checkmark-circle" : "alert-circle"}
                          size={13}
                          color={trip.eligible ? Colors.primaryDark : Colors.error}
                        />
                        <Text
                          style={[
                            styles.eligibilityText,
                            !trip.eligible && styles.ineligibleText,
                          ]}
                        >
                          {trip.eligible ? "Được thuê" : "Chưa đủ điều kiện"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.tripTitle}>{trip.title}</Text>
                    <View style={styles.dateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={Colors.onSurfaceVariant}
                      />
                      <Text style={styles.dateText}>
                        {dateFormatter.format(new Date(trip.startAt))} –{" "}
                        {dateFormatter.format(new Date(trip.endAt))}
                      </Text>
                    </View>

                    {trip.eligible ? (
                      <View style={styles.selectRow}>
                        <Text style={styles.selectText}>
                          {active ? "Đang dùng cho giỏ thuê" : "Dùng chuyến này"}
                        </Text>
                        <Ionicons
                          name={active ? "checkmark-circle" : "arrow-forward"}
                          size={19}
                          color={Colors.primaryDark}
                        />
                      </View>
                    ) : (
                      <Text style={styles.reasonText}>
                        {trip.eligibilityReason ||
                          "API xác nhận chuyến chưa đủ điều kiện thuê."}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateBlock({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={38} color={Colors.primaryDark} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.primaryAction} onPress={onAction}>
          <Text style={styles.primaryActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  eyebrow: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 18, fontWeight: "900" },
  content: { padding: 16, paddingBottom: 40 },
  explanationCard: {
    padding: 14,
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryPale,
  },
  explanationText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 17,
  },
  centerState: { paddingVertical: 70, alignItems: "center", gap: 12 },
  stateCard: {
    marginTop: 18,
    padding: 26,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  stateIcon: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  stateTitle: {
    marginTop: 14,
    textAlign: "center",
    color: Colors.onSurface,
    fontSize: 19,
    fontWeight: "900",
  },
  stateDescription: {
    marginTop: 7,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 17,
  },
  emptyActions: { width: "100%", marginTop: 18, gap: 9 },
  primaryAction: {
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  primaryActionText: { color: Colors.onPrimaryDark, fontWeight: "900" },
  secondaryAction: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.full,
  },
  secondaryActionText: { color: Colors.primaryDark, fontWeight: "900" },
  listHeading: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listTitle: { color: Colors.onSurface, fontSize: 19, fontWeight: "900" },
  listCount: { color: Colors.onSurfaceMuted, fontSize: 11 },
  tripList: { marginTop: 12, gap: 12 },
  tripCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  tripCardSelected: { borderWidth: 2, borderColor: Colors.primaryDark },
  tripCardDisabled: { opacity: 0.72 },
  tripTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  privateBadge: { backgroundColor: Colors.tertiaryContainer },
  typeBadgeText: { color: Colors.onPrimary, fontSize: 8, fontWeight: "900" },
  eligibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  ineligibleBadge: { backgroundColor: Colors.errorContainer },
  eligibilityText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  ineligibleText: { color: Colors.error },
  tripTitle: { marginTop: 13, color: Colors.onSurface, fontSize: 16, fontWeight: "900" },
  dateRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 10 },
  selectRow: {
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  selectText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "900" },
  reasonText: {
    marginTop: 12,
    color: Colors.error,
    fontSize: 10,
    lineHeight: 15,
  },
});
