// BMC Change: This entire file is added for bidirectional RTL/LTR support with isolated Emotion caches
import createCache, { EmotionCache } from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import React, { useMemo } from 'react';

import { ThemeContext } from '@grafana/data';

import { useTheme2 } from '../themes/ThemeContext';

import { Direction, DirectionProvider } from './DirectionContext';

// Cache instances - created lazily and reused
let ltrCache: EmotionCache | null = null;
let rtlCache: EmotionCache | null = null;

/**
 * Gets or creates an LTR Emotion cache (no RTL plugin)
 */
function getLtrCache(): EmotionCache {
  if (!ltrCache) {
    ltrCache = createCache({
      key: 'ltr',
      // No stylisPlugins - styles remain in LTR
    });
  }
  return ltrCache;
}

/**
 * Gets or creates an RTL Emotion cache (with RTL plugin)
 */
function getRtlCache(): EmotionCache {
  if (!rtlCache) {
    rtlCache = createCache({
      key: 'rtl',
      stylisPlugins: [rtlPlugin],
    });
  }
  return rtlCache;
}

interface DirectionCacheProviderProps {
  /**
   * The direction for this section.
   * 'rtl' will apply the RTL stylis plugin to flip CSS properties.
   * 'ltr' will use standard CSS without flipping.
   */
  direction: Direction;
  children: React.ReactNode;
  /**
   * If true, wraps children in a div with the dir attribute.
   * Default: true
   */
  withWrapper?: boolean;
  /**
   * Additional className for the wrapper div
   */
  className?: string;
  /**
   * Additional style for the wrapper div
   */
  style?: React.CSSProperties;
}

/**
 * DirectionCacheProvider - Provides isolated Emotion cache based on direction.
 *
 * This component creates a separate Emotion cache for RTL or LTR content,
 * ensuring that CSS-in-JS styles are correctly flipped (or not) based on
 * the direction context.
 *
 * Use this when you need truly isolated RTL/LTR sections where the CSS
 * needs to be generated differently.
 *
 * @example
 * // LTR section within an RTL app - CSS won't be flipped
 * <DirectionCacheProvider direction="ltr">
 *   <ChartComponent /> // Styles generated without RTL flipping
 * </DirectionCacheProvider>
 *
 * @example
 * // RTL section within an LTR app - CSS will be flipped
 * <DirectionCacheProvider direction="rtl">
 *   <FormComponent /> // Styles generated with RTL flipping
 * </DirectionCacheProvider>
 *
 * NOTE: Components inside DirectionCacheProvider will have their @emotion/react
 * styles processed by the direction-specific cache. However, @emotion/css (the
 * `css` function from @emotion/css) uses a global cache and is not affected by
 * CacheProvider. For @emotion/css styles, use the rtlOverrides.ts approach.
 *
 * ThemeContext is re-provided with `isRtl` aligned to this provider's direction so
 * `useTheme2().isRtl` and helpers that read theme match `useDirection()` here.
 */
function ThemeDirectionBridge({ direction, children }: { direction: Direction; children: React.ReactNode }) {
  const theme = useTheme2();
  const bridgedTheme = useMemo(
    () => ({
      ...theme,
      isRtl: direction === 'rtl',
    }),
    [theme, direction]
  );

  return <ThemeContext.Provider value={bridgedTheme}>{children}</ThemeContext.Provider>;
}

export function DirectionCacheProvider({
  direction,
  children,
  withWrapper = true,
  className,
  style,
}: DirectionCacheProviderProps) {
  const cache = useMemo(() => {
    return direction === 'rtl' ? getRtlCache() : getLtrCache();
  }, [direction]);

  return (
    <CacheProvider value={cache}>
      <DirectionProvider direction={direction} withWrapper={withWrapper} className={className} style={style}>
        <ThemeDirectionBridge direction={direction}>{children}</ThemeDirectionBridge>
      </DirectionProvider>
    </CacheProvider>
  );
}

/**
 * Hook to create a custom Emotion cache for a specific direction.
 *
 * Use this when you need more control over the cache configuration.
 *
 * @param direction - The direction for the cache
 * @param key - Optional custom cache key (default: 'ltr' or 'rtl')
 * @returns Emotion cache configured for the direction
 *
 * @example
 * const cache = useDirectionCache('rtl', 'my-rtl-section');
 * return (
 *   <CacheProvider value={cache}>
 *     <MyComponent />
 *   </CacheProvider>
 * );
 */
export function useDirectionCache(direction: Direction, key?: string): EmotionCache {
  return useMemo(() => {
    if (direction === 'rtl') {
      return createCache({
        key: key || 'rtl',
        stylisPlugins: [rtlPlugin],
      });
    }
    return createCache({
      key: key || 'ltr',
    });
  }, [direction, key]);
}
