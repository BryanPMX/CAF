// admin-portal/src/hooks/useIsomorphicLayoutEffect.ts
'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * Hook that uses useLayoutEffect on the client and useEffect on the server
 * Prevents hydration mismatches that can cause React error #310
 */
export const useIsomorphicLayoutEffect = (effect: React.EffectCallback, deps?: React.DependencyList) => {
  if (typeof window !== 'undefined') {
    return useLayoutEffect(effect, deps);
  } else {
    return useEffect(effect, deps);
  }
};
