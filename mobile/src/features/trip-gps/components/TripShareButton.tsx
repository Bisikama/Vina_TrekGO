import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useTripShareAvailability } from '../hooks/useTripShareAvailability';

interface TripShareButtonProps {
  tripId: string | undefined;
  /** Set right after finishing a recording, when the merged route is still on its way. */
  expectRoute?: boolean;
  /** Runs before navigating, e.g. to close the modal hosting this button. */
  onBeforeOpen?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function TripShareButton({ tripId, expectRoute, onBeforeOpen, style }: TripShareButtonProps) {
  const router = useRouter();
  const state = useTripShareAvailability(tripId, expectRoute);
  if (state === 'hidden' || !tripId) return null;

  const ready = state === 'ready';
  return (
    <Button
      label={ready ? 'Chia sẻ chuyến đi' : 'Đang xử lý cung đường'}
      variant="secondary"
      fullWidth
      disabled={!ready}
      leftIcon={<Ionicons name="image-outline" size={18} color={Colors.inkDeep} />}
      style={style}
      onPress={() => {
        onBeforeOpen?.();
        router.push({ pathname: '/trips/[id]/share', params: { id: tripId } } as any);
      }}
    />
  );
}
