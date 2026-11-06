import { Ionicons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TopHeader } from "@/components/TopHeader";
import { EmptyState, LoadingState, StatusBadge, SurfaceCard } from "@/components/ui";
import { BookingFlowButton, flowStyles } from "@/features/bookings/components/BookingFlowUI";
import { MyTripFilters, MY_TRIP_DESCRIPTIONS, MY_TRIP_LABELS } from "@/features/trips/components/MyTripFilters";
import { TripParticipationCard } from "@/features/trips/components/TripParticipationCard";
import { buildTripParticipations, selectTripParticipations, type MyTripFilter, type MyTripSource, type TripParticipation } from "@/features/trips/trip-groups";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { BookingCard } from "@/features/bookings/components";
import { useMyBookings } from "@/features/bookings/hooks";
import { DirectInviteCard } from "@/features/private-trips/components/DirectInviteCard";
import { PrivateTripCard } from "@/features/private-trips/components/PrivateTripCard";
import { useMyPrivateTrips } from "@/features/private-trips/hooks/useMyPrivateTrips";
import { useMyReceivedInvitations } from "@/features/private-trips/hooks/useMyReceivedInvitations";
import { TripCard } from "@/features/trips/components";
import { usePublicTrips } from "@/features/trips/hooks";
import { useMyTickets } from "@/features/invitations";
import { useLeaderTrips } from "@/features/leaders/hooks";

type MainTab = "MY_TRIPS" | "PUBLIC_TRIPS";


const DIFFICULTY_OPTIONS = ["Tất cả", "EASY", "MEDIUM", "HARD", "EXTREME"];
const DIFFICULTY_LABELS: Record<string, string> = {
  "Tất cả": "Tất cả",
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
  EXTREME: "Thách thức",
};



export default function TripsScreen() {
  const router = useRouter();
  const { user } = useApp();
  const { user: authUser, accessToken } = useAuth();
  const isLeader = authUser?.role === "LEADER" || user?.role === "LEADER";

  const [mainTab, setMainTab] = useState<MainTab>("MY_TRIPS");
  const [activeFilter, setActiveFilter] = useState<MyTripFilter>("UPCOMING");
  const [tripSource, setTripSource] = useState<MyTripSource>("ALL");
  const [invitationView, setInvitationView] = useState<"PENDING" | "HANDLED">("PENDING");
  const [publicSearch, setPublicSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("Tất cả");

  // Real backend bookings & public trips & private trips
  const {
    bookings,
    isLoading: loadingBookings,
    refetch: refetchBookings,
  } = useMyBookings();

  const {
    trips: backendPrivateTrips,
    loading: loadingPrivateTrips,
    refetch: refetchPrivateTrips,
  } = useMyPrivateTrips(true);

  const {
    invitations: receivedInvitations,
    loading: loadingInvitations,
    acceptingId,
    decliningId,
    refetch: refetchInvitations,
    accept: acceptInvitation,
    decline: declineInvitation,
  } = useMyReceivedInvitations();

  const {
    trips: publicTripsList,
    loading: loadingPublicTrips,
    loadingMore: loadingMorePublicTrips,
    refresh: refreshPublicTrips,
    loadMore: loadMorePublicTrips,
  } = usePublicTrips({ pageSize: 50 });

  const {
    tickets: myTickets,
    loading: loadingTickets,
    refetch: refetchTickets,
  } = useMyTickets();

  // Leader public trips (nếu user là Leader)
  const {
    trips: leaderTrips,
    loading: loadingLeaderTrips,
    fetchMyTrips,
  } = useLeaderTrips(accessToken);

  useEffect(() => {
    if (isLeader && accessToken) {
      void fetchMyTrips(1, 50);
    }
  }, [isLeader, accessToken, fetchMyTrips]);

  // Tải thêm trang kế tiếp khi cuộn gần đáy (chỉ áp dụng cho tab PUBLIC_TRIPS)
  const loadMoreLockRef = useRef(false);
  const handlePublicTripsScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (mainTab !== "PUBLIC_TRIPS") return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromEnd =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromEnd > 600 || loadMoreLockRef.current) return;
      loadMoreLockRef.current = true;
      void loadMorePublicTrips().finally(() => {
        loadMoreLockRef.current = false;
      });
    },
    [mainTab, loadMorePublicTrips],
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const promises: Promise<unknown>[] = [
      refetchBookings(),
      refreshPublicTrips(),
      refetchPrivateTrips(),
      refetchInvitations(),
      refetchTickets(),
    ];
    if (isLeader && accessToken) {
      promises.push(fetchMyTrips(1, 50));
    }
    await Promise.allSettled(promises);
    setRefreshing(false);
  }, [
    refetchBookings,
    refreshPublicTrips,
    refetchPrivateTrips,
    refetchInvitations,
    refetchTickets,
    isLeader,
    accessToken,
    fetchMyTrips,
  ]);

  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();

  // Synchronize URL search params if navigated from Home shortcuts
  useEffect(() => {
    if (params.tab === "PUBLIC_TRIPS") {
      setMainTab("PUBLIC_TRIPS");
    } else if (params.tab === "MY_TRIPS") {
      setMainTab("MY_TRIPS");
    }

    if (params.filter === "PRIVATE") {
      setTripSource("PRIVATE");
      setActiveFilter("UPCOMING");
    } else if (["UPCOMING", "PENDING", "HISTORY", "CANCELLED", "INACTIVE", "INVITATIONS"].includes(params.filter ?? "")) {
      setTripSource("ALL");
      setActiveFilter(params.filter as MyTripFilter);
    }
  }, [params.tab, params.filter]);

  // Refetch private trips, bookings, invitations & tickets automatically on focus
  useFocusEffect(
    useCallback(() => {
      void refetchBookings();
      void refetchPrivateTrips();
      void refetchInvitations();
      void refetchTickets();
    }, [refetchBookings, refetchPrivateTrips, refetchInvitations, refetchTickets]),
  );

  const displayedPublicTrips = useMemo(() => {
    return publicTripsList.filter((t) => {
      const matchesSearch =
        !publicSearch.trim() ||
        t.title.toLowerCase().includes(publicSearch.toLowerCase()) ||
        (t.destination?.name || "").toLowerCase().includes(publicSearch.toLowerCase());

      const tripDiff = t.routes?.[0]?.snapshotDifficulty;
      const matchesDifficulty =
        selectedDifficulty === "Tất cả" || tripDiff === selectedDifficulty;

      return matchesSearch && matchesDifficulty;
    });
  }, [publicTripsList, publicSearch, selectedDifficulty]);

  // Map lookup trip status từ publicTripsList hoặc leaderTrips (Frontend Fallback vì API /bookings không select trip.status)
  const tripStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    publicTripsList.forEach((t) => {
      if (t?.id && t?.status) map.set(t.id, t.status);
    });
    leaderTrips.forEach((t) => {
      if (t?.id && t?.status) map.set(t.id, t.status);
    });
    return map;
  }, [publicTripsList, leaderTrips]);

  // Enrich bookings with trip.status from tripStatusMap if missing
  const enrichedBookings = useMemo(() => {
    return bookings.map((b) => {
      const tripId = b.trip?.id || (b as any).tripId;
      const statusFromMap = tripId ? tripStatusMap.get(tripId) : undefined;
      const effectiveTripStatus = b.trip?.status || statusFromMap;
      if (effectiveTripStatus && (!b.trip || b.trip.status !== effectiveTripStatus)) {
        return {
          ...b,
          trip: {
            ...b.trip,
            status: effectiveTripStatus,
          },
        };
      }
      return b;
    });
  }, [bookings, tripStatusMap]);

  const enrichedTickets = useMemo(() => myTickets.map((ticket) => {
    const status = ticket.trip.status || tripStatusMap.get(ticket.trip.id);
    return status && status !== ticket.trip.status ? { ...ticket, trip: { ...ticket.trip, status } } : ticket;
  }), [myTickets, tripStatusMap]);

  // Reclassify only the presentation; booking and invitation APIs remain unchanged.
  const participations = buildTripParticipations({
    bookings: enrichedBookings,
    tickets: enrichedTickets,
    privateTrips: backendPrivateTrips,
    leaderTrips: isLeader ? leaderTrips : [],
  });
  const selectedTrips = selectTripParticipations(participations, tripSource);
  const visibleTrips = selectedTrips.entries.filter((entry) => entry.group === activeFilter);
  const listLoading = (tripSource !== "PRIVATE" && (loadingBookings || loadingTickets || (isLeader && loadingLeaderTrips)))
    || (tripSource !== "PUBLIC" && loadingPrivateTrips);
  const pendingInvitations = receivedInvitations.filter((inv) => inv.status === "PENDING");

  function openTripDetail(tripId: string) {
    router.push({
      pathname: "/trips/[id]",
      params: {
        id: tripId,
      },
    } as unknown as Href);
  }

  function renderFilters() {
    return <MyTripFilters selected={activeFilter} source={tripSource} counts={selectedTrips.counts}
      onSelect={setActiveFilter} onSource={setTripSource}
      onBookings={() => router.push("/bookings" as Href)}
      onTransactions={() => router.push("/bookings/transactions" as Href)} />;
  }

  function renderParticipation(entry: TripParticipation) {
    if (entry.kind === "booking") return <View key={entry.key}>
      <BookingCard booking={entry.data} onPress={() => {
        if (["UPCOMING", "HISTORY"].includes(entry.group) && entry.data.trip?.id) {
          openTripDetail(entry.data.trip.id);
        } else {
          router.push({ pathname: "/bookings/[id]", params: { id: entry.data.id } });
        }
      }} />
    </View>;
    if (entry.kind === "private") {
      const trip = entry.data;
      const membershipLabel = trip.viewer?.membershipStatus === "LEFT" ? "Đã rời nhóm" : trip.viewer?.membershipStatus === "REMOVED" ? "Không còn trong nhóm" : "Vắng mặt";
      return <View key={entry.key} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <StatusBadge label="Chuyến riêng" tone="neutral" size="sm" />
          {entry.group === "INACTIVE" && <StatusBadge label={membershipLabel} tone="neutral" size="sm" />}
        </View>
        <PrivateTripCard trip={trip} onPress={() => {
          if (trip.id.startsWith("trip-")) openTripDetail(trip.id);
          else router.push({ pathname: "/private-trips/[id]", params: { id: trip.id } } as Href);
        }} />
      </View>;
    }
    return <TripParticipationCard key={entry.key} entry={entry} onPress={() => {
      if (entry.kind === "ticket") router.push({ pathname: "/trips/[id]/ticket", params: { id: entry.data.id } });
      else router.push({ pathname: "/field-operations/leader-trip-detail", params: { id: entry.data.id } } as Href);
    }} />;
  }

  function renderParticipationList() {
    const canManagePrivate = activeFilter === "UPCOMING" && tripSource !== "PUBLIC";
    return <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text style={flowStyles.heading}>{MY_TRIP_LABELS[activeFilter]} · {visibleTrips.length}</Text>
        <Text style={flowStyles.muted}>{MY_TRIP_DESCRIPTIONS[activeFilter]}</Text>
      </View>
      {listLoading && visibleTrips.length === 0 ? <LoadingState message="Đang tải chuyến đi..." />
        : visibleTrips.length === 0 ? <SurfaceCard style={flowStyles.card}>
          <EmptyState title="Chưa có chuyến trong nhóm này" description="Thử chọn trạng thái hoặc loại chuyến khác." />
          {activeFilter === "UPCOMING" && <BookingFlowButton label="Khám phá chuyến đi" onPress={() => setMainTab("PUBLIC_TRIPS")} />}
        </SurfaceCard>
        : <View>{visibleTrips.map(renderParticipation)}</View>}
      {canManagePrivate && <SurfaceCard style={flowStyles.card}>
        <Text style={flowStyles.heading}>Đi cùng nhóm riêng</Text>
        <BookingFlowButton label="Tạo chuyến đi riêng" onPress={() => router.push("/private-trips/create" as Href)} />
        <BookingFlowButton label="Quét mã / Nhập mã mời" appearance="outline" onPress={() => router.push("/private-trips" as Href)} />
      </SurfaceCard>}
    </View>;
  }

  function renderPublicTripsTab() {
    return (
      <View style={{ flex: 1 }}>
        {/* Leader Create Public Trip Banner (If Leader) */}
        {isLeader && (
          <TouchableOpacity
            style={styles.leaderCreateBanner}
            onPress={() =>
              router.push("/field-operations/leader-create-trip" as any)
            }
            activeOpacity={0.88}
          >
            <View style={styles.leaderCreateIconBox}>
              <Ionicons name="add" size={22} color={Colors.onPrimary} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.leaderCreateTitle}>Tạo Public Trip mới</Text>
              <Text style={styles.leaderCreateSub}>
                Khảo sát cung đường, thiết lập mốc GPS và mở bán vé cho cộng đồng
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        )}

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={Colors.onSurfaceVariant}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm chuyến, địa danh..."
              placeholderTextColor={Colors.mute}
              value={publicSearch}
              onChangeText={setPublicSearch}
            />
            {publicSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPublicSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={Colors.mute} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Difficulty Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.difficultyRow}
        >
          {DIFFICULTY_OPTIONS.map((d) => {
            const active = selectedDifficulty === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.diffChip, active && styles.diffChipActive]}
                onPress={() => setSelectedDifficulty(d)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.diffChipText,
                    active && styles.diffChipTextActive,
                  ]}
                >
                  {DIFFICULTY_LABELS[d] || d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results Counter & Reset Filter */}
        <View style={styles.resultCountRow}>
          <Text style={styles.resultCountText}>
            {loadingPublicTrips
              ? "Đang tải chuyến công khai..."
              : `Có ${displayedPublicTrips.length} chuyến mở bán`}
          </Text>
          {(selectedDifficulty !== "Tất cả" || publicSearch.trim().length > 0) && (
            <TouchableOpacity
              onPress={() => {
                setSelectedDifficulty("Tất cả");
                setPublicSearch("");
              }}
            >
              <Text style={styles.resetFilterText}>Xóa bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Trips List / Empty / Loading */}
        {loadingPublicTrips && publicTripsList.length === 0 ? (
          <LoadingState
            label="Đang tải danh sách chuyến đi mở bán..."
            style={{ paddingVertical: 40 }}
          />
        ) : displayedPublicTrips.length === 0 ? (
          <EmptyState
            icon={
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="compass-outline"
                  size={34}
                  color={Colors.primaryDark}
                />
              </View>
            }
            title="Không tìm thấy chuyến đi phù hợp"
            description={
              publicSearch.trim() || selectedDifficulty !== "Tất cả"
                ? "Thử thay đổi từ khóa tìm kiếm hoặc chọn mức độ khó khác."
                : "Hiện tại chưa có chuyến đi công khai nào đang mở bán."
            }
          />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {displayedPublicTrips.map((pt) => (
              <TripCard
                key={pt.id}
                trip={pt}
                onPress={() => openTripDetail(pt.id)}
              />
            ))}
            {loadingMorePublicTrips && (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={Colors.primaryDark}
              />
            )}
          </View>
        )}
      </View>
    );
  }

  function renderMyInvitations() {
    return <>
      <View style={{ marginHorizontal: 16, marginVertical: 12, gap: 12 }}>
        <Text style={flowStyles.heading}>Lời mời tham gia</Text>
        <Text style={flowStyles.muted}>{MY_TRIP_DESCRIPTIONS.INVITATIONS}</Text>
        <SurfaceCard style={flowStyles.card}>
          <Ionicons name="ticket-outline" size={24} color={Colors.ink} />
          <Text style={flowStyles.heading}>Vé được gửi cho bạn</Text>
          <Text style={flowStyles.body}>Xem và trả lời lời mời nhận vé chuyến công khai.</Text>
          <BookingFlowButton label="Mở lời mời vé" onPress={() => router.push("/invitations" as Href)} />
        </SurfaceCard>
        <Text style={flowStyles.heading}>Lời mời chuyến riêng</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([['PENDING', `Chờ trả lời (${pendingInvitations.length})`], ['HANDLED', 'Đã xử lý']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: invitationView === value }} onPress={() => setInvitationView(value)} style={{ flex: 1, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: invitationView === value ? '#9fe870' : '#ffffff' }}><Text style={{ fontSize: 13, fontWeight: '700', color: '#0e0f0c' }}>{label}</Text></Pressable>)}
        </View>
      </View>
      {renderInvitationsInbox()}
    </>;
  }

  function renderInvitationsInbox() {
    const visibleInvitations = receivedInvitations.filter((inv) => invitationView === "PENDING" ? inv.status === "PENDING" : inv.status !== "PENDING");
    if (loadingInvitations && receivedInvitations.length === 0) {
      return (
        <View style={[styles.emptyState, { paddingVertical: 40 }]}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={[styles.emptyDescription, { marginTop: 12 }]}>
            Đang tải hộp thư lời mời...
          </Text>
        </View>
      );
    }

    if (visibleInvitations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="mail-unread-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>
          <Text style={styles.emptyTitle}>{invitationView === "PENDING" ? "Không có lời mời chờ trả lời" : "Chưa có lời mời đã xử lý"}</Text>
          <Text style={styles.emptyDescription}>
            {invitationView === "PENDING" ? "Lời mời chuyến riêng mới sẽ xuất hiện ở đây." : "Lời mời đã nhận, từ chối hoặc hết hạn sẽ xuất hiện ở đây."}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        {invitationView === "PENDING" && pendingInvitations.length > 0 && (
          <View style={styles.invitationInboxNotice}>
            <Ionicons name="mail-unread-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.invitationInboxNoticeText}>
              Bạn có <Text style={{ fontWeight: "800" }}>{pendingInvitations.length}</Text> lời mời đang chờ bạn phản hồi.
            </Text>
          </View>
        )}

        {visibleInvitations.map((inv) => (
          <DirectInviteCard
            key={inv.id}
            invitation={inv}
            isAccepting={acceptingId === inv.id}
            isDeclining={decliningId === inv.id}
            onAccept={async () => {
              const res = await acceptInvitation(inv.id);
              if (res?.canEnterRoom && res.tripId) {
                router.push({
                  pathname: "/private-trips/[id]/room",
                  params: { id: res.tripId },
                } as any);
              }
            }}
            onDecline={async (_id, reason) => {
              await declineInvitation(inv.id, reason);
            }}
            onEnterRoom={(targetTripId) => {
              router.push({
                pathname: "/private-trips/[id]/room",
                params: { id: targetTripId },
              } as any);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Chuyến đi" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handlePublicTripsScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryDark}
            colors={[Colors.primaryDark]}
          />
        }
      >
        <View style={styles.segmentContainer}>
          <View style={styles.segmentBox}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                mainTab === "MY_TRIPS" && styles.segmentBtnActive,
              ]}
              onPress={() => setMainTab("MY_TRIPS")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="briefcase"
                size={16}
                color={
                  mainTab === "MY_TRIPS"
                    ? Colors.ink
                    : Colors.onSurfaceVariant
                }
              />
              <Text
                style={
                  mainTab === "MY_TRIPS"
                    ? styles.segmentBtnTextActive
                    : styles.segmentBtnText
                }
              >
                Chuyến của tôi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                mainTab === "PUBLIC_TRIPS" && styles.segmentBtnActive,
              ]}
              onPress={() => setMainTab("PUBLIC_TRIPS")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="compass"
                size={16}
                color={
                  mainTab === "PUBLIC_TRIPS"
                    ? Colors.ink
                    : Colors.onSurfaceVariant
                }
              />
              <Text
                style={
                  mainTab === "PUBLIC_TRIPS"
                    ? styles.segmentBtnTextActive
                    : styles.segmentBtnText
                }
              >
                Khám phá
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {mainTab === "MY_TRIPS" ? (
          <>
            {renderFilters()}
            {activeFilter === "INVITATIONS" ? renderMyInvitations() : renderParticipationList()}
          </>
        ) : (
          renderPublicTripsTab()
        )}
      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8ebe6",
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  segmentBox: {
    padding: 3,
    flexDirection: "row",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primaryContainer,
    ...Shadows.card,
  },
  segmentBtnText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentBtnTextActive: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    marginHorizontal: 16,
    paddingHorizontal: 24,
    paddingVertical: 42,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: Colors.primaryPale,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: 7,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.onSurface,
    padding: 0,
  },
  difficultyRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  diffChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  diffChipActive: {
    backgroundColor: Colors.primaryDark,
  },
  diffChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  diffChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resultCountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.secondary,
  },
  leaderCreateBanner: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.secondaryContainer,
  },
  leaderCreateIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  leaderCreateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  leaderCreateSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 15,
  },
  invitationInboxNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  invitationInboxNoticeText: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: "500",
    flex: 1,
  },
});
