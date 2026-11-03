import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';
import { TrekGoLogo } from './TrekGoLogo';
import { useApp } from '@/context/AppContext';

import { useRouter } from 'expo-router';

interface TopHeaderProps {
  subtitle?: string;
  onNotificationPress?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ subtitle = 'Home', onNotificationPress }) => {
  const router = useRouter();
  const { user } = useApp();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftGroup}>
        <TrekGoLogo size={26} showText={true} />
        {/* <View style={styles.badgeContainer}>
          <Text style={styles.subtitleText}>{subtitle}</Text>
        </View> */}
      </View>

      <View style={styles.rightGroup}>
        {/* Role is supplied by the authenticated API profile. */}
        <View
          style={[styles.rolePill, user.role === 'LEADER' && styles.rolePillLeader]} 
        >
          <Ionicons 
            name={user.role === 'LEADER' ? 'shield-checkmark' : 'walk'} 
            size={12} 
            color={user.role === 'LEADER' ? Colors.onPrimaryContainer : Colors.ink} 
          />
          <Text style={[styles.roleText, user.role === 'LEADER' && styles.roleTextLeader]}>
            {user.role === 'LEADER' ? 'LEADER' : 'TREKKER'}
          </Text>
        </View>

        {/* QR Scanner button */}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => router.push('/scan-qr' as any)}
          activeOpacity={0.7}
          accessibilityLabel="Quét mã QR"
        >
          <Ionicons name="qr-code-outline" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Notifications button */}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={20} color={Colors.onSurfaceVariant} />
          <View style={styles.unreadDot} />
        </TouchableOpacity>

        {/* User avatar */}
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(251, 249, 243, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeContainer: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  subtitleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  rolePillLeader: {
    backgroundColor: Colors.primaryContainer,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  roleTextLeader: {
    color: Colors.onPrimaryContainer,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  avatarWrapper: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
