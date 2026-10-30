import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { Checkpoint } from '@/types';

interface CheckpointMissionModalProps {
  visible: boolean;
  checkpoint: Checkpoint | null;
  onClose: () => void;
  onComplete: (checkpointId: string) => void;
}

export const CheckpointMissionModal: React.FC<CheckpointMissionModalProps> = ({
  visible,
  checkpoint,
  onClose,
  onComplete,
}) => {
  const [photoTaken, setPhotoTaken] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('Sức khỏe cả nhóm tốt. Thời tiết nhiều gió.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!checkpoint) return null;

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onComplete(checkpoint.id);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header handle */}
          <View style={styles.dragHandle} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          {/* Milestone Banner */}
          <View style={styles.milestoneHeader}>
            <View style={styles.flagIconCircle}>
              <Ionicons name="flag" size={22} color="#6f5900" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.arrivalBadge}>GPS XÁC NHẬN ĐẾN ĐÍCH</Text>
                {checkpoint.elevation != null && (
                  <Text style={styles.elevationTag}>+{checkpoint.elevation}m</Text>
                )}
              </View>
              <Text style={styles.checkpointTitle}>{checkpoint.name}</Text>
            </View>
          </View>

          {/* Mission Details Box */}
          <View style={styles.missionBox}>
            <View style={styles.missionHeaderRow}>
              <Ionicons name="flag-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.missionHeadline}>Nhiệm Vụ Cột Mốc: Khảo Sát Địa Bàn</Text>
            </View>
            <Text style={styles.missionDesc}>
              {checkpoint.mission?.description || 'Chụp ảnh xác thực tại biển kiểm lâm và xác nhận tình trạng an toàn của các thành viên.'}
            </Text>

            {/* Photo Capture Simulator */}
            <View style={styles.photoContainer}>
              {photoTaken ? (
                <View style={styles.photoPreview}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80' }}
                    style={styles.photoImage}
                  />
                  <View style={styles.photoVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#0c2000" />
                    <Text style={styles.photoVerifiedText}>GPS Tagged: 11.5831°N, 108.5290°E</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.takePhotoBox}
                  onPress={() => setPhotoTaken(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={32} color={Colors.primaryDark} />
                  <Text style={styles.takePhotoText}>Chạm để chụp ảnh xác thực mốc</Text>
                  <Text style={styles.takePhotoSub}>Tự động gắn toạ độ GPS & độ cao hiện tại</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Health / Route Notes input */}
            <View style={styles.notesGroup}>
              <Text style={styles.notesLabel}>Ghi chú cho Leader & đoàn:</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Nhập ghi chú địa hình..."
              />
            </View>
          </View>

          {/* Points & Reward preview */}
          <View style={styles.rewardRow}>
            <Ionicons name="trophy" size={18} color="#b86700" />
            <Text style={styles.rewardText}>Phần thưởng: +100 Điểm Trekker & Huy hiệu mốc</Text>
          </View>

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[styles.submitButton, (!photoTaken || isSubmitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!photoTaken || isSubmitting}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done" size={20} color={Colors.onPrimary} />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Đang xác thực...' : 'Hoàn thành Checkpoint ✓'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    ...Shadows.hover,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
    alignSelf: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  flagIconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrivalBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6f5900',
    letterSpacing: 0.5,
  },
  elevationTag: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    color: Colors.onSurfaceVariant,
  },
  checkpointTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.onSurface,
    marginTop: 2,
  },
  missionBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  missionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  missionHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkDeep,
  },
  missionDesc: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 17,
    marginBottom: 12,
  },
  photoContainer: {
    marginBottom: 12,
  },
  takePhotoBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryDark,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 6,
  },
  takePhotoSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  photoPreview: {
    height: 140,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoVerifiedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200, 238, 165, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  photoVerifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0c2000',
  },
  notesGroup: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.onSurface,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff9e6',
    padding: 10,
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6f5900',
  },
  submitButton: {
    height: 50,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.hover,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
});
