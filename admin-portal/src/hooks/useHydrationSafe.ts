// admin-portal/src/hooks/useHydrationSafe.ts
'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to safely handle client-side only operations
 * Prevents hydration mismatches that can cause React error #310
 */
export const useHydrationSafe = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
};
