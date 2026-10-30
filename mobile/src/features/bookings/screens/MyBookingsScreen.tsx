import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { BookingCard } from "@/features/bookings/components";
import { useMyBookings } from "@/features/bookings/hooks";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "COMPLETED", label: "Đã đi" },
  { key: "CANCELLED", label: "Đã hủy" },
];

export function MyBookingsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const {
    bookings,
    total,
    isLoading,
    error,
    status,
    setStatus,
    refetch,
  } = useMyBookings();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Ionicons name="lock-closed-outline" size={54} color={Colors.primaryDark} />
          <Text style={styles.emptyTitle}>Yêu cầu đăng nhập</Text>
          <Text style={styles.emptySub}>
            Vui lòng đăng nhập để xem danh sách vé và đơn đặt chỗ của bạn.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/auth" as any)}
          >
            <Text style={styles.primaryBtnText}>Đăng nhập ngay</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt chỗ của tôi</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push("/(tabs)/explore" as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const isSelected = status === item.key;
            return (
              <TouchableOpacity
                style={[styles.tabPill, isSelected && styles.tabPillSelected]}
                onPress={() => setStatus(item.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    isSelected && styles.tabPillTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main List */}
      {isLoading && bookings.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải danh sách đặt chỗ...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
          <Text style={styles.emptyTitle}>Lỗi tải dữ liệu</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={refetch}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="ticket-outline" size={54} color={Colors.onSurfaceMuted} />
          <Text style={styles.emptyTitle}>Chưa có đặt chỗ nào</Text>
          <Text style={styles.emptySub}>
            Bạn chưa có đơn đặt chỗ nào trong trạng thái này. Khám phá các chuyến đi công khai hấp dẫn ngay hôm nay!
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(tabs)/explore" as any)}
          >
            <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Khám phá chuyến đi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={Colors.primaryDark}
            />
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPress={() =>
                router.push({
                  pathname: "/bookings/[id]",
                  params: { id: item.id },
                } as any)
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  tabsContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  tabPillSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  tabPillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
