'use client';

import { useEffect } from 'react';

export function useRefreshOnReturn(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let lastRefresh = 0;
    const handleReturn = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastRefresh < 1000) return;
      lastRefresh = Date.now();
      refresh();
    };
    window.addEventListener('focus', handleReturn);
    window.addEventListener('online', handleReturn);
    document.addEventListener('visibilitychange', handleReturn);
    return () => {
      window.removeEventListener('focus', handleReturn);
      window.removeEventListener('online', handleReturn);
      document.removeEventListener('visibilitychange', handleReturn);
    };
  }, [enabled, refresh]);
}
