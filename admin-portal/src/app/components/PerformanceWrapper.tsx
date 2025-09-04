// admin-portal/src/app/components/PerformanceWrapper.tsx
// Performance-optimized component wrapper

import React, { memo, Suspense, lazy, useEffect, useRef } from 'react';
import { Spin } from 'antd';

interface PerformanceWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  preload?: boolean;
  threshold?: number;
  rootMargin?: string;
}

// Default loading component
const DefaultLoading = () => (
  <div className="flex justify-center items-center h-32">
    <Spin size="large" tip="Cargando..." />
  </div>
);

// Performance wrapper component
export const PerformanceWrapper = memo<PerformanceWrapperProps>(({
  children,
  fallback = <DefaultLoading />,
  preload = false,
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [isVisible, setIsVisible] = React.useState(preload);
  const [hasLoaded, setHasLoaded] = React.useState(preload);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preload) {
      setHasLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [preload, threshold, rootMargin, hasLoaded]);

  if (!isVisible) {
    return (
      <div ref={ref} className="min-h-[200px]">
        {fallback}
      </div>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <div ref={ref}>
        {children}
      </div>
    </Suspense>
  );
});

PerformanceWrapper.displayName = 'PerformanceWrapper';

// Lazy component creator with performance optimizations
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: {
    preload?: boolean;
    fallback?: React.ReactNode;
    threshold?: number;
    rootMargin?: string;
  } = {}
) {
  const LazyComponent = lazy(importFunc);
  
  const WrappedComponent = (props: React.ComponentProps<T>) => (
    <PerformanceWrapper
      preload={options.preload}
      fallback={options.fallback}
      threshold={options.threshold}
      rootMargin={options.rootMargin}
    >
      <LazyComponent {...props} />
    </PerformanceWrapper>
  );

  return WrappedComponent;
}

// Virtual list component for large datasets
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => 
            renderItem(item, startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
}

// Debounced input component
interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}

export function DebouncedInput({
  value,
  onChange,
  placeholder,
  delay = 300,
  className
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  }, [onChange, delay]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

// Performance monitoring hook
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

// Memoized component with performance monitoring
export function withPerformanceMonitoring<T extends React.ComponentType<any>>(
  Component: T,
  componentName: string
) {
  const WrappedComponent = React.memo((props: React.ComponentProps<T>) => {
    usePerformanceMonitor(componentName);
    return <Component {...props} />;
  });

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return WrappedComponent;
}
