// admin-portal/src/app/lib/performance.ts
// Performance optimization utilities

import { useEffect, useRef, useCallback, useState, lazy } from 'react';

// Debounce hook for performance optimization
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    }) as T,
    [callback, delay]
  );
}

// Throttle hook for performance optimization
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0);
  const lastCallTimer = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        callback(...args);
        lastCall.current = now;
      } else {
        if (lastCallTimer.current) {
          clearTimeout(lastCallTimer.current);
        }
        lastCallTimer.current = setTimeout(() => {
          callback(...args);
          lastCall.current = Date.now();
        }, delay - (now - lastCall.current));
      }
    }) as T,
    [callback, delay]
  );
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options, hasIntersected]);

  return [elementRef, isIntersecting, hasIntersected] as const;
}

// Memoization utility for expensive computations
export function useMemoizedValue<T>(
  value: T,
  deps: any[],
  equalityFn?: (prev: T, next: T) => boolean
): T {
  const ref = useRef<T>();
  const depsRef = useRef<any[]>();

  if (
    !ref.current ||
    !depsRef.current ||
    deps.length !== depsRef.current.length ||
    deps.some((dep, index) => dep !== depsRef.current![index]) ||
    (equalityFn && !equalityFn(ref.current, value))
  ) {
    ref.current = value;
    depsRef.current = deps;
  }

  return ref.current;
}

// Performance monitoring utility
export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration > 100) {
        console.warn(`Slow component render: ${componentName} took ${duration.toFixed(2)}ms`);
      }
    };
  });
}

// Lazy loading with preloading
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  preload = false
) {
  const LazyComponent = lazy(importFunc);
  
  if (preload) {
    // Preload the component
    importFunc();
  }
  
  return LazyComponent;
}

// Virtual scrolling utilities
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
  };
}

// Image optimization utilities
export function optimizeImageUrl(url: string, width: number, quality = 75): string {
  if (!url) return url;
  
  // Add Next.js image optimization parameters
  return `${url}?w=${width}&q=${quality}&format=webp`;
}

// Bundle size monitoring
export function useBundleSizeMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log('Page Load Performance:', {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
              totalTime: navEntry.loadEventEnd - navEntry.fetchStart,
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      
      return () => observer.disconnect();
    }
  }, []);
}

// Memory leak prevention
export function useCleanupEffect(cleanup: () => void, deps: any[] = []) {
  useEffect(() => {
    return cleanup;
  }, deps);
}

// Optimized event handlers
export function createOptimizedHandler<T extends Event>(
  handler: (event: T) => void,
  options: { passive?: boolean; once?: boolean } = {}
) {
  return (event: T) => {
    if (options.passive) {
      event.preventDefault = () => {};
    }
    handler(event);
  };
}
