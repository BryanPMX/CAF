// admin-portal/src/hooks/useHydrationSafe.ts
'use client';

import { useState } from 'react';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Hook to safely handle client-side only operations
 * Prevents hydration mismatches that can cause React error #310
 */
export const useHydrationSafe = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
};
