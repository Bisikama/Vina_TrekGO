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
import type { TripCheckpointDto } from '../types';

interface TripGpsCheckpointSheetProps {
  visible: boolean;
  checkpoints: TripCheckpointDto[];
  arrivedCheckpointIds: string[];
  nextCheckpointId?: string | null;
  onClose: () => void;
  onSelectCheckpoint: (cp: TripCheckpointDto) => void;
}

export function TripGpsCheckpointSheet({
  visible,
  checkpoints,
  arrivedCheckpointIds,
  nextCheckpointId,
  onClose,
  onSelectCheckpoint,
}: TripGpsCheckpointSheetProps) {
  const sorted = [...checkpoints].sort((a, b) => a.sequence - b.sequence);
  const passedCount = arrivedCheckpointIds.length;
  const totalCount = sorted.length;
  const progressPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Tiến Độ Cột Mốc</Text>
              <Text style={styles.sheetSubtitle}>
                Đã đến {passedCount}/{totalCount} mốc ({progressPercent}%)
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {sorted.map((cp, idx) => {
              const isPassed = arrivedCheckpointIds.includes(cp.id);
              const isNext = cp.id === nextCheckpointId;

              return (
                <TouchableOpacity
                  key={cp.id}
                  style={[
                    styles.cpCard,
                    isPassed && styles.cpCardPassed,
                    isNext && styles.cpCardNext,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    onSelectCheckpoint(cp);
                    onClose();
                  }}
                >
                  <View style={styles.cpLeft}>
                    {/* Sequence Badge */}
                    <View
                      style={[
                        styles.seqBadge,
                        isPassed && styles.seqBadgePassed,
                        isNext && styles.seqBadgeNext,
                      ]}
                    >
                      {isPassed ? (
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                      ) : (
                        <Text
                          style={[
                            styles.seqText,
                            isNext && { color: Colors.ink },
                          ]}
                        >
                          {cp.sequence || idx + 1}
                        </Text>
                      )}
                    </View>

                    <View style={styles.cpInfo}>
                      <Text style={styles.cpName} numberOfLines={1}>
                        {cp.name}
                      </Text>
                      <Text style={styles.cpSub}>
                        Bán kính GPS: {cp.radiusMeters}m · {cp.isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cpRight}>
                    {isPassed ? (
                      <View style={styles.badgePassed}>
                        <Text style={styles.badgePassedText}>Đã qua</Text>
                      </View>
                    ) : isNext ? (
                      <View style={styles.badgeNext}>
                        <Text style={styles.badgeNextText}>Mục tiêu</Text>
                      </View>
                    ) : (
                      <Text style={styles.upcomingText}>Sắp tới</Text>
                    )}
                  </View>
                </TouchableOpacity>
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
    maxHeight: '75%',
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
    paddingBottom: 12,
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
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e8ebe6',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.pill,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  cpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8faf7',
    padding: 14,
    borderRadius: Radius.xl, // 24px signature rounded card
    borderWidth: 1,
    borderColor: '#e8ebe6',
  },
  cpCardPassed: {
    backgroundColor: Colors.primaryPale,
    borderColor: Colors.primaryNeutral,
  },
  cpCardNext: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  cpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  seqBadge: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: '#e8ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqBadgePassed: {
    backgroundColor: Colors.positive,
  },
  seqBadgeNext: {
    backgroundColor: Colors.warning,
  },
  seqText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.ink,
  },
  cpInfo: {
    flex: 1,
  },
  cpName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
  },
  cpSub: {
    fontSize: 11,
    color: Colors.mute,
    marginTop: 2,
  },
  cpRight: {},
  badgePassed: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgePassedText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.positiveDeep,
  },
  badgeNext: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeNextText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  upcomingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.mute,
  },
});
