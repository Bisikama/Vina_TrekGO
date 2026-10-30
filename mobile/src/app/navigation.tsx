import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { MapLibre3DView, MapLibre3DViewRef, MapCheckpoint, MapCoordinate, MapGroupMember } from '@/components/map/MapLibre3DView';
import { TrekGoLogo } from '@/components/TrekGoLogo';
import {
  TripGpsCheckpointSheet,
  TripGpsResultModal,
  TripGpsRosterDrawer,
  useTripGps,
  MemberStateDto,
  TripCheckpointDto,
} from '@/features/trip-gps';
import { distanceMeters } from '@/utils/gpsProcessor';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tripId?: string;
    tripType?: 'PUBLIC' | 'PRIVATE';
    tripTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const effectiveTripId = params.tripId || '';
  const effectiveTitle = params.tripTitle || 'GPS chuyến đi';

  const mapRef = useRef<MapLibre3DViewRef>(null);

  const {
    context,
    gpsState,
    session,
    myMemberState,
    otherMembers,
    plannedRouteCoords,
    liveRouteCoords,
    summaryRouteCoords,
    currentLocation,
    checkpoints,
    arrivedCheckpointIds,
    nextCheckpoint,
    deviation,
    stats,
    actualRoute,
    loading,
    syncing,
    syncStatus,
    syncNow,
    isV2,
    rejectedSampleCount,
    error,
    socketConnected,
    isSimulated,
    isMapMatchingEnabled,
    toggleMapMatching,
    startRecording,
    pauseRecording,
    resumeRecording,
    finishRecording,
    refreshState,
  } = useTripGps(effectiveTripId);

  // Modals state
  const [rosterDrawerVisible, setRosterDrawerVisible] = useState(false);
  const [checkpointSheetVisible, setCheckpointSheetVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const finishActionLockedRef = useRef(false);
  const [finishActionPending, setFinishActionPending] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const controlsDisabled = loading || finishActionPending;

  // Map interaction state (Learned from Personal Trail & TuongTacTrenMap.md)
  // 1. Follow Mode ON by default; automatically turns OFF when user gestures/pans/zooms
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  // 2. Default to 2D for live GPS tracking to eliminate 3D terrain distortion and overhead
  const [is3DMode, setIs3DMode] = useState(false);
  const [currentBearing, setCurrentBearing] = useState(0);

  // Selected Checkpoint / Member for on-map Quick Card
  const [selectedCp, setSelectedCp] = useState<TripCheckpointDto | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberStateDto | null>(null);

  // Map Checkpoints
  const mapCheckpoints = useMemo<MapCheckpoint[]>(() => {
    return checkpoints.map((cp) => ({
      id: cp.id,
      name: cp.name,
      order: cp.sequence,
      latitude: cp.latitude,
      longitude: cp.longitude,
      status: arrivedCheckpointIds.includes(cp.id) ? 'COMPLETED' : 'PENDING',
    }));
  }, [checkpoints, arrivedCheckpointIds]);

  // Map Group Members
  const mapGroupMembers = useMemo<MapGroupMember[]>(() => {
    const list = gpsState?.members || [];
    return list
      .filter((m) => m.lastLocation?.latitude != null && m.lastLocation?.longitude != null)
      .map((m) => ({
        userId: m.userId,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        tripRole: m.tripRole,
        locationStatus: m.locationStatus,
        connectionStatus: m.connectionStatus,
        sessionId: m.session?.id,
        locationVersion: m.locationVersion,
        recordedAt: m.lastLocation!.recordedAt,
        latitude: m.lastLocation!.latitude,
        longitude: m.lastLocation!.longitude,
        isSelf: m.userId === gpsState?.selfUserId,
      }));
  }, [gpsState]);

  // Map Current Position (Ưu tiên: GPS thực tế -> Server State -> Điểm đầu cung đường kế hoạch)
  const mapCurrentPosition = useMemo<MapCoordinate | null>(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        elevation: currentLocation.altitudeM ?? undefined,
      };
    }
    if (myMemberState?.lastLocation) {
      return {
        latitude: myMemberState.lastLocation.latitude,
        longitude: myMemberState.lastLocation.longitude,
        elevation: myMemberState.lastLocation.altitudeM ?? undefined,
      };
    }
    if (plannedRouteCoords && plannedRouteCoords.length > 0) {
      return {
        longitude: plannedRouteCoords[0][0],
        latitude: plannedRouteCoords[0][1],
      };
    }
    return null;
  }, [currentLocation, myMemberState, plannedRouteCoords]);

  // Helper tính khoảng cách từ vị trí người dùng tới toạ độ đích
  const getDistanceToUser = useCallback(
    (lat: number, lng: number): string | null => {
      if (!mapCurrentPosition) return null;
      const d = distanceMeters(
        { latitude: mapCurrentPosition.latitude, longitude: mapCurrentPosition.longitude },
        { latitude: lat, longitude: lng }
      );
      if (d >= 1000) return `${(d / 1000).toFixed(1)} km`;
      return `${Math.round(d)} m`;
    },
    [mapCurrentPosition]
  );

  // 1. Khi người dùng chủ động vuốt, zoom, xoay trên bản đồ -> Tắt Follow Mode
  const handleUserMapInteraction = useCallback(() => {
    setIsFollowingUser(false);
  }, []);

  // 2. Khi bấm Định vị tôi -> Bật lại Follow Mode và trượt camera về người dùng
  const handleCenterOnMe = useCallback(() => {
    setIsFollowingUser(true);
    setSelectedCp(null);
    setSelectedMember(null);
    if (mapCurrentPosition) {
      mapRef.current?.centerOnUser(mapCurrentPosition.longitude, mapCurrentPosition.latitude, 16.5);
    } else {
      mapRef.current?.centerOnUser(undefined, undefined, 16.5);
    }
  }, [mapCurrentPosition]);

  // 3. Khi bấm La bàn -> Reset về hướng Bắc và bật lại Follow Mode
  const handleResetNorth = useCallback(() => {
    mapRef.current?.resetCamera();
    setIsFollowingUser(true);
  }, []);

  // 4. Chuyển đổi 2D/3D Terrain
  const handleToggle3D = useCallback(() => {
    mapRef.current?.toggle3D();
    setIs3DMode((prev) => !prev);
  }, []);

  // 5. Fit toàn bộ đoàn & route vào khung hình
  const handleFitAll = useCallback(() => {
    setIsFollowingUser(false);
    setSelectedCp(null);
    setSelectedMember(null);
    const coords: [number, number][] = [];
    if (plannedRouteCoords.length > 0) {
      if (Array.isArray(plannedRouteCoords[0]) && typeof plannedRouteCoords[0][0] === 'number') {
        coords.push(...(plannedRouteCoords as [number, number][]));
      }
    }
    mapGroupMembers.forEach((m) => coords.push([m.longitude, m.latitude]));
    if (mapCurrentPosition) {
      coords.push([mapCurrentPosition.longitude, mapCurrentPosition.latitude]);
    }

    if (coords.length >= 2) {
      const minLng = Math.min(...coords.map((c) => c[0]));
      const maxLng = Math.max(...coords.map((c) => c[0]));
      const minLat = Math.min(...coords.map((c) => c[1]));
      const maxLat = Math.max(...coords.map((c) => c[1]));
      mapRef.current?.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        50
      );
    }
  }, [plannedRouteCoords, mapGroupMembers, mapCurrentPosition]);

  // 6. Nhấn vào Checkpoint trên bản đồ -> Ease camera, tắt Follow Mode, hiện Quick Card
  const handleCheckpointPress = useCallback(
    (cpId: string) => {
      const cp = checkpoints.find((c) => c.id === cpId);
      if (cp) {
        setIsFollowingUser(false);
        setSelectedCp(cp);
        setSelectedMember(null);
        mapRef.current?.easeTo(cp.longitude, cp.latitude);
      }
    },
    [checkpoints]
  );

  // 7. Nhấn vào Member trên bản đồ -> Ease camera, tắt Follow Mode, hiện Quick Card
  const handleMemberPress = useCallback(
    (userId: string, fullName: string) => {
      const mem = gpsState?.members.find((m) => m.userId === userId);
      if (mem && mem.lastLocation) {
        setIsFollowingUser(false);
        setSelectedMember(mem);
        setSelectedCp(null);
        mapRef.current?.easeTo(mem.lastLocation.longitude, mem.lastLocation.latitude);
      }
    },
    [gpsState]
  );

  // Focus on specific member on map từ Roster Drawer
  const handleFocusMember = useCallback((member: MemberStateDto) => {
    if (member.lastLocation) {
      setIsFollowingUser(false);
      setSelectedMember(member);
      setSelectedCp(null);
      mapRef.current?.flyTo(member.lastLocation.longitude, member.lastLocation.latitude, 16);
    }
  }, []);

  // SOS Emergency Alert
  const handleSOS = useCallback(() => {
    const lat = mapCurrentPosition?.latitude?.toFixed(4) || '11.5831';
    const lng = mapCurrentPosition?.longitude?.toFixed(4) || '108.5290';
    Alert.alert(
      'PHÁT TÍN HIỆU SOS KHẨN CẤP',
      `Đang gửi toạ độ GPS (${lat}°N, ${lng}°E) của bạn tới Ban Quản Lý Rừng & Trạm Cứu Hộ TrekGo gần nhất qua tần số vệ tinh & SMS khẩn.`,
      [{ text: 'Đã nhận tín hiệu' }]
    );
  }, [mapCurrentPosition]);

  // VHF Radio Channel
  const handleRadio = useCallback(() => {
    Alert.alert(
      'Kênh Bộ Đàm VHF Đoàn Trek',
      `Kênh 01 (Tần số 146.520 MHz) · Sóng ổn định · Đoàn có ${gpsState?.members?.length || 1} thiết bị trong vùng phủ sóng.`,
      [{ text: 'Đóng' }]
    );
  }, [gpsState]);

  // Session Control Actions with Alerts
  const handleStart = useCallback(async () => {
    if (loading || finishActionLockedRef.current) return;
    await startRecording();
  }, [startRecording, loading]);

  const handlePause = useCallback(async () => {
    if (loading || finishActionLockedRef.current) return;
    Alert.alert('Tạm dừng ghi GPS?', 'Phiên ghi sẽ được đánh dấu tạm dừng. Bạn có thể tiếp tục bất cứ lúc nào.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Tạm dừng', onPress: pauseRecording },
    ]);
  }, [pauseRecording, loading]);

  const handleResume = useCallback(async () => {
    if (loading || finishActionLockedRef.current) return;
    await resumeRecording();
  }, [resumeRecording, loading]);

  const handleFinish = useCallback(async () => {
    if (loading || finishActionLockedRef.current) return;
    finishActionLockedRef.current = true;
    setFinishActionPending(true);
    const unlock = () => {
      finishActionLockedRef.current = false;
      setFinishActionPending(false);
      setIsFinishing(false);
    };
    Alert.alert(
      'Kết thúc phiên ghi GPS?',
      'Dữ liệu đã ghi sẽ được lưu. Bạn có thể ghi tiếp bằng phiên mới khi chuyến còn cho phép ghi. Thao tác này không kết thúc chuyến đi.',
      [
        { text: 'Hủy', style: 'cancel', onPress: unlock },
        {
          text: 'Kết thúc & Lưu',
          style: 'destructive',
          onPress: async () => {
            setIsFinishing(true);
            try {
              if (await finishRecording()) setResultModalVisible(true);
            } finally {
              unlock();
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [finishRecording, loading]);

  const isSessionActive = session?.status === 'ACTIVE';
  const isSessionPaused = session?.status === 'PAUSED';
  const isSessionStopped = session?.status === 'STOPPED' || !session;

  return (
    <View style={styles.screenContainer}>
      <StatusBar style="dark" />

      {/* 1. TOP HUD BAR — Wrapped seamlessly with Top Inset */}
      <View style={[styles.topHudBar, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <View style={styles.topHudLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.ink} />
          </TouchableOpacity>
          <TrekGoLogo size={24} showText={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hudTitle} numberOfLines={1}>
              {effectiveTitle}
            </Text>
            <Text style={styles.hudSubtitle} numberOfLines={1}>
              {params.tripType ? `${params.tripType} TRIP` : 'TREK HUD'} · {isSessionActive ? 'ĐANG GHI' : isSessionPaused ? 'TẠM DỪNG' : 'CHẾ ĐỘ GPS'}
            </Text>
          </View>
        </View>

        <View style={styles.topHudRight}>
          {/* Socket & Sync indicator */}
          <View style={styles.statusPill}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: socketConnected ? Colors.positive : Colors.warning },
              ]}
            />
            <Text style={styles.statusPillText}>
              {socketConnected ? 'LIVE' : 'POLLING'}
            </Text>
          </View>

          {/* Fake GPS Pill if active */}
          {isSimulated && (
            <View style={styles.simPill}>
              <Text style={styles.simPillText}>FAKE GPS</Text>
            </View>
          )}

          {/* GPS Accuracy */}
          <View style={styles.accuracyBadge}>
            <Ionicons name="navigate" size={11} color={Colors.positiveDeep} />
            <Text style={styles.accuracyText}>±{stats.accuracyM}m</Text>
          </View>
        </View>
      </View>

      {/* Error notification if any */}
      {error && (
        <View style={styles.errorNotice}>
          <Ionicons name="alert-circle" size={16} color={Colors.negative} />
          <Text style={styles.errorNoticeText}>{error}</Text>
        </View>
      )}

      {/* 2. MAP AREA (Chiếm 2/3 không gian màn hình, tối đa tầm nhìn như Personal Trail) */}
      <View style={styles.mapArea}>
        <MapLibre3DView
          ref={mapRef}
          is3D={is3DMode}
          pitch={is3DMode ? 60 : 0}
          dragRotate={true}
          showControls={false}
          showEndpoints={false}
          autoCenterOnUser={true}
          fitOnPlannedRouteUpdate={false}
          followUser={isFollowingUser && isSessionActive && !isSessionPaused}
          onUserInteraction={handleUserMapInteraction}
          onBearingChange={setCurrentBearing}
          plannedRoute={plannedRouteCoords}
          traveledRoute={liveRouteCoords}
          currentPosition={mapCurrentPosition}
          checkpoints={mapCheckpoints}
          groupMembers={mapGroupMembers}
          onCheckpointPress={handleCheckpointPress}
          onMemberPress={handleMemberPress}
        />

        {/* Floating Map Controls — Clean single layer, no overlapping */}
        <View style={styles.mapFloatingControls}>
          <TouchableOpacity
            style={[styles.mapIconBtn, is3DMode && styles.mapIconBtnActive]}
            onPress={handleToggle3D}
            activeOpacity={0.85}
          >
            <Text style={[styles.map3DText, is3DMode && styles.map3DTextActive]}>
              {is3DMode ? '3D' : '2D'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapIconBtn} onPress={handleResetNorth} activeOpacity={0.85}>
            <View style={{ transform: [{ rotate: `${-currentBearing}deg` }] }}>
              <Ionicons
                name="compass"
                size={20}
                color={currentBearing !== 0 ? Colors.primaryDark : Colors.ink}
              />
            </View>
          </TouchableOpacity>

          {/* Nút bật/tắt Map Matching (Snap vào tim đường) */}
          <TouchableOpacity
            style={[styles.mapIconBtn, isMapMatchingEnabled && styles.mapIconBtnMatchActive]}
            onPress={() => toggleMapMatching()}
            activeOpacity={0.85}
          >
            <Ionicons
              name="git-commit-outline"
              size={20}
              color={isMapMatchingEnabled ? '#ffffff' : Colors.ink}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapIconBtn,
              isFollowingUser && isSessionActive && !isSessionPaused && styles.mapIconBtnFollowActive,
            ]}
            onPress={handleCenterOnMe}
            activeOpacity={0.85}
          >
            <Ionicons
              name={
                isFollowingUser && isSessionActive && !isSessionPaused
                  ? 'navigate'
                  : 'locate'
              }
              size={20}
              color={
                isFollowingUser && isSessionActive && !isSessionPaused
                  ? Colors.onPrimary
                  : Colors.ink
              }
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapIconBtn} onPress={handleFitAll} activeOpacity={0.85}>
            <Ionicons name="scan" size={20} color={Colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Interactive Checkpoint Card Preview on map */}
        {selectedCp && (
          <View style={styles.mapPreviewCard}>
            <View style={styles.previewCardHeader}>
              <View style={styles.previewBadgeRow}>
                <View style={styles.previewSequenceCircle}>
                  <Text style={styles.previewSequenceText}>{selectedCp.sequence}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle} numberOfLines={1}>{selectedCp.name}</Text>
                  <Text style={styles.previewSubtitle}>
                    {arrivedCheckpointIds.includes(selectedCp.id) ? '✓ Đã đến mốc' : 'Chưa đến'}
                    {getDistanceToUser(selectedCp.latitude, selectedCp.longitude)
                      ? ` · Cách bạn ${getDistanceToUser(selectedCp.latitude, selectedCp.longitude)}`
                      : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setSelectedCp(null)}
              >
                <Ionicons name="close" size={16} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.previewActionRow}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => {
                  setSelectedCp(null);
                  setCheckpointSheetVisible(true);
                }}
              >
                <Text style={styles.previewActionText}>Xem danh sách mốc →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewLocateBackBtn}
                onPress={handleCenterOnMe}
              >
                <Ionicons name="navigate" size={13} color={Colors.onPrimary} />
                <Text style={styles.previewLocateBackText}>Về GPS của tôi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Interactive Member Card Preview on map */}
        {selectedMember && (
          <View style={styles.mapPreviewCard}>
            <View style={styles.previewCardHeader}>
              <View style={styles.previewBadgeRow}>
                <View style={styles.memberAvatarCircle}>
                  <Text style={styles.memberAvatarText}>
                    {(selectedMember.fullName || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.previewTitle} numberOfLines={1}>{selectedMember.fullName}</Text>
                    <View style={[styles.roleMiniBadge, selectedMember.tripRole === 'LEADER' && styles.roleLeaderBadge]}>
                      <Text style={styles.roleMiniText}>{selectedMember.tripRole}</Text>
                    </View>
                  </View>
                  <Text style={styles.previewSubtitle}>
                    Trạng thái: {selectedMember.locationStatus}
                    {selectedMember.lastLocation && getDistanceToUser(selectedMember.lastLocation.latitude, selectedMember.lastLocation.longitude)
                      ? ` · Cách bạn ${getDistanceToUser(selectedMember.lastLocation.latitude, selectedMember.lastLocation.longitude)}`
                      : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setSelectedMember(null)}
              >
                <Ionicons name="close" size={16} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.previewActionRow}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => {
                  setSelectedMember(null);
                  setRosterDrawerVisible(true);
                }}
              >
                <Text style={styles.previewActionText}>Xem cả đoàn →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewLocateBackBtn}
                onPress={handleCenterOnMe}
              >
                <Ionicons name="navigate" size={13} color={Colors.onPrimary} />
                <Text style={styles.previewLocateBackText}>Về GPS của tôi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Syncing spinner badge */}
        {syncing && !isV2 && (
          <View style={styles.syncingBadge}>
            <ActivityIndicator size="small" color={Colors.ink} />
            <Text style={styles.syncingText}>Đang đồng bộ SQLite...</Text>
          </View>
        )}
      </View>

      {/* 3. COMPACT DASHBOARD & CONTROLS PANEL (~1/3 màn hình, thiết kế Scandinavian Wise) */}
      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {isV2 && session?.status === 'STOPPED' && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={syncStatus === 'SYNCED' ? 'Đã đồng bộ lịch sử GPS' : 'Đồng bộ lịch sử GPS'}
            accessibilityState={{ disabled: syncing || syncStatus === 'PROCESSING', busy: syncing || syncStatus === 'PROCESSING' }}
            activeOpacity={0.8}
            style={[
              styles.syncAction,
              syncStatus === 'SYNCED' && styles.syncActionComplete,
              (syncing || syncStatus === 'PROCESSING') && styles.syncActionBusy,
              syncStatus === 'NEEDS_ATTENTION' && styles.syncActionAttention,
            ]}
            disabled={syncing || syncStatus === 'PROCESSING'}
            onPress={() => { void syncNow(); }}
          >
            <View style={styles.syncActionIcon}>
              {syncing || syncStatus === 'PROCESSING' ? (
                <ActivityIndicator size="small" color={Colors.inkDeep} />
              ) : (
                <Ionicons name={syncStatus === 'SYNCED' ? 'checkmark-circle-outline' : syncStatus === 'NEEDS_ATTENTION' ? 'alert-circle-outline' : 'cloud-upload-outline'} size={24} color={Colors.inkDeep} />
              )}
            </View>
            <View style={styles.syncActionContent}>
              <Text style={styles.syncActionTitle}>
                {syncStatus === 'SYNCED' ? 'Đã đồng bộ' : syncStatus === 'PROCESSING' ? 'Đang xử lý lịch sử' : syncing ? 'Đang đồng bộ…' : syncStatus === 'NEEDS_ATTENTION' || syncStatus === 'WAITING_NETWORK' ? 'Đồng bộ lại' : 'Đồng bộ ngay'}
              </Text>
              <Text style={styles.syncActionDescription}>
                {syncStatus === 'SYNCED' ? 'Lịch sử đã được máy chủ xử lý.' : syncStatus === 'PROCESSING' ? 'Máy chủ đang tổng hợp hành trình.' : syncing ? 'Đang gửi lịch sử GPS lên máy chủ.' : syncStatus === 'WAITING_NETWORK' ? 'Đã lưu trên máy. Chờ kết nối để gửi.' : syncStatus === 'NEEDS_ATTENTION' ? 'Cần kiểm tra. Nhấn để thử đồng bộ lại.' : 'Gửi lịch sử GPS đã lưu trên máy.'}
              </Text>
            </View>
            {!syncing && syncStatus !== 'PROCESSING' && <Ionicons name="chevron-forward" size={20} color={Colors.inkDeep} />}
          </TouchableOpacity>
        )}
        {/* CRITICAL ROUTE DEVIATION WARNING BAR (If deviated) */}
        {deviation.isDeviated && (
          <View style={styles.deviationCardCompact}>
            <Ionicons name="warning" size={16} color={Colors.negative} />
            <Text style={styles.deviationTextCompact} numberOfLines={1}>
              LỆCH TUYẾN: Lệch ~{deviation.distanceM ? Math.round(deviation.distanceM) : 60}m khỏi cung đường đoàn!
            </Text>
            <TouchableOpacity style={styles.reconnectBtnCompact} onPress={handleCenterOnMe}>
              <Text style={styles.reconnectBtnTextCompact}>Xem đường</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* COMPACT TELEMETRY DASHBOARD */}
        <View style={styles.compactDashboard}>
          {/* Row 1: Primary Telemetry 3-Column Box (Quãng đường, Vận tốc, Độ cao) */}
          <View style={styles.compactStatsBox}>
            <View style={styles.compactStatCol}>
              <Text style={styles.compactStatLabel}>QUÃNG ĐƯỜNG</Text>
              <View style={styles.compactStatValRow}>
                <Text style={styles.compactStatVal}>{stats.distanceKm}</Text>
                <Text style={styles.compactStatUnit}>km</Text>
              </View>
            </View>

            <View style={styles.compactDivider} />

            <View style={styles.compactStatCol}>
              <Text style={styles.compactStatLabel}>VẬN TỐC</Text>
              <View style={styles.compactStatValRow}>
                <Text style={styles.compactStatVal}>{stats.speedKmh}</Text>
                <Text style={styles.compactStatUnit}>km/h</Text>
              </View>
            </View>

            <View style={styles.compactDivider} />

            <View style={styles.compactStatCol}>
              <Text style={styles.compactStatLabel}>THỜI GIAN GHI</Text>
              <View style={styles.compactStatValRow}>
                <Text style={styles.compactStatVal}>{stats.recordingTime}</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Quick Access Pills (Checkpoints & Roster Đoàn) */}
          <View style={styles.quickPillsRow}>
            <TouchableOpacity
              style={styles.quickPillBtn}
              activeOpacity={0.8}
              onPress={() => setCheckpointSheetVisible(true)}
            >
              <Ionicons name="flag" size={13} color={Colors.tertiary} />
              <Text style={styles.quickPillText} numberOfLines={1}>
                Mốc {arrivedCheckpointIds.length}/{checkpoints.length} · {nextCheckpoint ? nextCheckpoint.name : 'Về đích'}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.mute} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickPillBtn}
              activeOpacity={0.8}
              onPress={() => setRosterDrawerVisible(true)}
            >
              <Ionicons name="people" size={13} color={Colors.ink} />
              <Text style={styles.quickPillText}>
                Đoàn: {gpsState?.members?.length || 1} TV
              </Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.mute} />
            </TouchableOpacity>
          </View>
        </View>

      {/* 7. STICKY BOTTOM ACTION CONTROLS — Wise Design 24px Pill Buttons */}
      <View style={styles.bottomControlsBar}>
        {/* If Not Started (Stopped or no session) */}
        {isSessionStopped && (
          <TouchableOpacity
            style={styles.primaryPillBtn}
            activeOpacity={0.88}
            onPress={handleStart}
            disabled={controlsDisabled || !(context?.permissions.canStartNewSession ?? context?.permissions.canRecord)}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={Colors.onPrimary} />
                <Text style={styles.primaryPillText}>{!(context?.permissions.canStartNewSession ?? context?.permissions.canRecord)
                  ? (context?.tripStatus === 'COMPLETED' ? 'Chuyến đi đã kết thúc' : 'Chưa được phép ghi GPS')
                  : session?.status === 'STOPPED' ? 'Ghi tiếp hành trình' : 'Bắt đầu ghi GPS'}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* If Active */}
        {isSessionActive && (
          <View style={styles.activeActionsRow}>
            <TouchableOpacity
              style={styles.pauseBtn}
              activeOpacity={0.85}
              onPress={handlePause}
              disabled={controlsDisabled}
            >
              <Ionicons name="pause" size={18} color={Colors.ink} />
              <Text style={styles.pauseBtnText}>Tạm dừng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishBtn, controlsDisabled && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleFinish}
              disabled={controlsDisabled}
            >
              {isFinishing ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="stop" size={18} color="#ffffff" />}
              <Text style={styles.finishBtnText}>{isFinishing ? 'Đang kết thúc…' : 'Kết thúc'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* If Paused */}
        {isSessionPaused && (
          <View style={styles.activeActionsRow}>
            <TouchableOpacity
              style={styles.resumeBtn}
              activeOpacity={0.88}
              onPress={handleResume}
              disabled={controlsDisabled}
            >
              <Ionicons name="play" size={18} color={Colors.onPrimary} />
              <Text style={styles.resumeBtnText}>Tiếp tục ghi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishBtn, controlsDisabled && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleFinish}
              disabled={controlsDisabled}
            >
              {isFinishing ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="stop" size={18} color="#ffffff" />}
              <Text style={styles.finishBtnText}>{isFinishing ? 'Đang kết thúc…' : 'Kết thúc'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tactile SOS & Radio Buttons */}
        <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8}>
          <Ionicons name="alert" size={20} color={Colors.negative} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.radioButton} onPress={handleRadio} activeOpacity={0.8}>
          <Ionicons name="radio" size={18} color={Colors.ink} />
        </TouchableOpacity>
      </View>
    </View>

      {/* Roster Drawer Modal */}
      <TripGpsRosterDrawer
        visible={rosterDrawerVisible}
        members={gpsState?.members || []}
        selfUserId={gpsState?.selfUserId}
        onClose={() => setRosterDrawerVisible(false)}
        onFocusMember={handleFocusMember}
      />

      {/* Checkpoints Sheet Modal */}
      <TripGpsCheckpointSheet
        visible={checkpointSheetVisible}
        checkpoints={checkpoints}
        arrivedCheckpointIds={arrivedCheckpointIds}
        nextCheckpointId={nextCheckpoint?.id}
        onClose={() => setCheckpointSheetVisible(false)}
        onSelectCheckpoint={(cp) => {
          mapRef.current?.flyTo(cp.longitude, cp.latitude, 16);
        }}
      />

      {/* Trip Result Summary Modal */}
      <TripGpsResultModal
        visible={resultModalVisible}
        actualRoute={actualRoute}
        liveRouteCoords={summaryRouteCoords}
        stats={stats}
        syncStatus={isV2 ? syncStatus : undefined}
        rejectedSampleCount={rejectedSampleCount}
        onClose={() => setResultModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2ee',
  },
  topHudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#e8ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.ink,
    maxWidth: 180,
  },
  hudSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.mute,
    letterSpacing: 0.5,
  },
  topHudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e8ebe6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.ink,
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.positiveDeep,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffdad6',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.negative,
    flex: 1,
  },
  mapArea: {
    flex: 1,
    backgroundColor: '#141d13',
    position: 'relative',
  },
  mapFloatingControls: {
    position: 'absolute',
    right: 14,
    top: 14,
    gap: 8,
    zIndex: 10,
  },
  mapIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  map3DText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.ink,
  },
  mapIconBtnActive: {
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  map3DTextActive: {
    color: Colors.onPrimary,
  },
  mapIconBtnFollowActive: {
    backgroundColor: Colors.primary, // Wise Lime Green (#9fe870)
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  mapIconBtnSimActive: {
    backgroundColor: '#ff9800',
    borderWidth: 1.5,
    borderColor: '#e65100',
  },
  mapIconBtnMatchActive: {
    backgroundColor: Colors.primaryDark,
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  simPill: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  simPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#e65100',
    letterSpacing: 0.5,
  },
  mapFollowBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    ...Shadows.card,
    zIndex: 10,
  },
  mapFollowDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  mapFollowText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.ink,
  },
  mapPreviewCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: Radius.xl, // 24px Wise card
    padding: 14,
    ...Shadows.modal,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#e8ebe6',
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  previewSequenceCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSequenceText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.ink,
  },
  memberAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.ink,
  },
  previewSubtitle: {
    fontSize: 11,
    color: Colors.mute,
    marginTop: 2,
    fontWeight: '600',
  },
  previewCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: '#e8ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e8ebe6',
    gap: 8,
  },
  previewActionBtn: {
    paddingVertical: 4,
  },
  previewActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  previewLocateBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  previewLocateBackText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
  roleMiniBadge: {
    backgroundColor: '#e8ebe6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  roleLeaderBadge: {
    backgroundColor: '#fed018',
  },
  roleMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.ink,
  },
  syncingBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    ...Shadows.card,
  },
  syncingText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ink,
  },
  syncAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
  },
  syncActionComplete: {
    backgroundColor: Colors.primaryPale,
  },
  syncActionBusy: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  syncActionAttention: {
    backgroundColor: Colors.tertiaryFixed,
  },
  syncActionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncActionContent: {
    flex: 1,
    gap: 2,
  },
  syncActionTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: Colors.inkDeep,
  },
  syncActionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.body,
  },
  bottomPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: Radius.xl, // 24px signature rounded top corners
    borderTopRightRadius: Radius.xl,
    marginTop: -20, // Overlap onto the map so rounded corners sit seamlessly on the map
    zIndex: 10,
    paddingTop: 12,
    ...Shadows.modal,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  deviationCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: Colors.negative,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deviationTextCompact: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.negative,
  },
  reconnectBtnCompact: {
    backgroundColor: Colors.negative,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  reconnectBtnTextCompact: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  compactDashboard: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12, // Khoảng cách thở thoáng giữa hàng mốc/đoàn và hàng nút hành động
  },
  compactStatsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f7f5',
    borderRadius: Radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e8ebe6',
  },
  compactStatCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e1e5de',
  },
  compactStatLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: Colors.mute,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compactStatValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  compactStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.ink,
  },
  compactStatUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mute,
  },
  quickPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f6f7f5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#e8ebe6',
  },
  quickPillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ink,
  },
  bottomControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: '#ffffff',
  },
  primaryPillBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.xl, // 24px pill-rectangle
    backgroundColor: Colors.primary, // Wise lime green (#9fe870)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryPillText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.onPrimary,
  },
  activeActionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  pauseBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: '#e8ebe6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pauseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
  },
  resumeBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resumeBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.onPrimary,
  },
  finishBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  sosButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: '#ffdad6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: '#e8ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
