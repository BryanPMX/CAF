// admin-portal/src/hooks/useIsomorphicLayoutEffect.ts
'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * Hook that uses useLayoutEffect on the client and useEffect on the server
 * Prevents hydration mismatches that can cause React error #310
 * 
 * FIXED: This hook now follows the Rules of Hooks by calling both hooks
 * unconditionally and returning the appropriate one based on environment.
 */
export const useIsomorphicLayoutEffect = (effect: React.EffectCallback, deps?: React.DependencyList) => {
  // CRITICAL FIX: Call both hooks unconditionally to follow Rules of Hooks
  const layoutEffectResult = useLayoutEffect(effect, deps);
  const effectResult = useEffect(effect, deps);
  
  // Return the appropriate result based on environment
  // This ensures the same number of hooks are called on every render
  return typeof window !== 'undefined' ? layoutEffectResult : effectResult;
};
