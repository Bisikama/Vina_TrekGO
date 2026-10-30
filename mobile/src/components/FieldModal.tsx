import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';

interface FieldModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'success' | 'warning' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export function FieldModal({ visible, title, message, icon = 'checkmark-circle', tone = 'success', actionLabel = 'Đóng', onAction, onClose }: FieldModalProps) {
  const iconColor = tone === 'success' ? Colors.primaryDark : tone === 'warning' ? '#9b6700' : Colors.error;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={[styles.iconBox, tone === 'warning' && styles.warning, tone === 'danger' && styles.danger]}>
            <Ionicons name={icon} size={28} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryText}>Để sau</Text></Pressable>
            <Pressable style={styles.primaryButton} onPress={onAction ?? onClose}><Text style={styles.primaryText}>{actionLabel}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 15, 12, 0.48)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, padding: 24, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...Shadows.tactical },
  iconBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#e9f4de', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  warning: { backgroundColor: '#fff1c7' },
  danger: { backgroundColor: '#ffe8e5' },
  title: { color: Colors.ink, fontSize: 21, fontWeight: '800' },
  message: { color: Colors.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: Radius.sm, backgroundColor: Colors.surfaceContainerHighest },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: Radius.sm, backgroundColor: Colors.primaryDark },
  secondaryText: { color: Colors.ink, fontWeight: '800' },
  primaryText: { color: '#fff', fontWeight: '800' },
});