import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import type { MemberStateDto } from '../types';

interface TripGpsRosterDrawerProps {
  visible: boolean;
  members: MemberStateDto[];
  selfUserId?: string;
  onClose: () => void;
  onFocusMember: (member: MemberStateDto) => void;
}

export function TripGpsRosterDrawer({
  visible,
  members,
  selfUserId,
  onClose,
  onFocusMember,
}: TripGpsRosterDrawerProps) {
  const liveCount = members.filter((m) => m.connectionStatus ? m.connectionStatus === 'ONLINE' : m.locationStatus === 'LIVE').length;
  const offlineCount = members.filter((m) => m.connectionStatus ? m.connectionStatus === 'OFFLINE' : ['OFFLINE', 'NO_DATA'].includes(m.locationStatus)).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetContainer}>
          {/* Header handle */}
          <View style={styles.handleBar} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Thành Viên Đoàn</Text>
              <Text style={styles.sheetSubtitle}>
                Tổng số {members.length} người · {liveCount} online · {offlineCount} offline
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.memberList}>
            {members.map((m) => {
              const isSelf = m.userId === selfUserId;
              const isLeader = m.tripRole === 'LEADER';
              const isHost = m.tripRole === 'HOST';

              const statusColor =
                m.locationStatus === 'LIVE'
                  ? Colors.positive
                  : m.locationStatus === 'PAUSED' || m.locationStatus === 'STALE'
                  ? Colors.warning
                  : Colors.mute;

              const legacyStatusText =
                m.locationStatus === 'LIVE'
                  ? 'Trực tiếp'
                  : m.locationStatus === 'PAUSED'
                  ? 'Tạm dừng'
                  : m.locationStatus === 'STALE'
                  ? 'Tín hiệu yếu'
                  : m.locationStatus === 'OFFLINE'
                  ? 'Offline'
                  : 'Chưa có vị trí';
              const statusText = m.connectionStatus
                ? `${m.connectionStatus === 'ONLINE' ? 'Online' : m.connectionStatus === 'OFFLINE' ? 'Offline' : 'Chưa rõ kết nối'} · ${m.session?.status === 'PAUSED' ? 'Tạm dừng' : m.session?.status === 'STOPPED' ? 'Đã dừng' : m.locationFreshness === 'STALE' ? 'Vị trí cũ' : m.locationFreshness === 'NO_DATA' ? 'Chưa có vị trí' : 'Đang ghi'}`
                : legacyStatusText;

              const roleLabel = isHost ? 'Chủ phòng' : isLeader ? 'Leader' : 'Thành viên';
              const roleBg = isLeader ? '#fef3c7' : isHost ? Colors.primaryPale : Colors.surfaceContainer;
              const roleColor = isLeader ? '#b45309' : isHost ? Colors.inkDeep : Colors.body;

              return (
                <View key={m.userId} style={[styles.memberCard, isSelf && styles.selfCard]}>
                  <View style={styles.memberLeft}>
                    {/* Avatar circle */}
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>
                        {(m.fullName || 'U').charAt(0).toUpperCase()}
                      </Text>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.fullName || 'Người tham gia'} {isSelf ? '(Bạn)' : ''}
                        </Text>
                      </View>

                      <View style={styles.tagsRow}>
                        <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                          <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                        </View>
                        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusText}</Text>
                      </View>

                      {/* Checkpoint progress */}
                      {m.checkpointProgress?.applicable && (
                        <Text style={styles.cpProgressText}>
                          Đã qua {m.checkpointProgress.passed}/{m.checkpointProgress.total} mốc kiểm tra
                        </Text>
                      )}

                      {/* Last Location timestamp */}
                      {m.lastLocation && (
                        <Text style={styles.locationTimeText}>
                          Vị trí lúc {new Date(m.lastLocation.recordedAt).toLocaleTimeString('vi-VN')}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Locate Button */}
                  {m.lastLocation && (
                    <TouchableOpacity
                      style={styles.locateBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        onFocusMember(m);
                        onClose();
                      }}
                    >
                      <Ionicons name="navigate-outline" size={16} color={Colors.ink} />
                      <Text style={styles.locateBtnText}>Xem</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 12, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 32,
    ...Shadows.modal,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.ink,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: Colors.mute,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#e8ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8faf7',
    padding: 14,
    borderRadius: Radius.xl, // 24px signature rounded card
    borderWidth: 1,
    borderColor: '#e8ebe6',
    gap: 10,
  },
  selfCard: {
    backgroundColor: Colors.primaryPale,
    borderColor: Colors.primary,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ink,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  cpProgressText: {
    fontSize: 11,
    color: Colors.mute,
    marginTop: 4,
    fontWeight: '500',
  },
  locationTimeText: {
    fontSize: 10.5,
    color: Colors.mute,
    marginTop: 3,
    fontWeight: '500',
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  locateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
});
