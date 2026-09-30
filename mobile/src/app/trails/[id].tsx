import { useLocalSearchParams } from 'expo-router';

import { TrailDetailScreen } from '@/screens/trail-detail';

export default function TrailDetailRoute() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const trailId = Array.isArray(
    params.id,
  )
    ? params.id[0]
    : params.id;

  return (
    <TrailDetailScreen
      trailId={
        trailId ??
        'trail_lao_than'
      }
    />
  );
}