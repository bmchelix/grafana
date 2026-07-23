/**
 * Global Emotion Cache Patcher for RTL Support
 *
 * PROBLEM: @grafana/ui uses `@emotion/css` extensively (239+ files), which uses
 * a hardcoded global cache with key:'css'. This cache IGNORES our CacheProvider
 * and doesn't support RTL plugin.
 *
 * SOLUTION: Monkey-patch the global @emotion/css cache at runtime to inject
 * @mui/stylis-plugin-rtl when in RTL mode.
 *
 * This must run BEFORE any components mount!
 */

import createCache from '@emotion/cache';
import { cache as globalCache } from '@emotion/css';
import rtlPlugin from '@mui/stylis-plugin-rtl';

import { isRtl } from '@grafana/ui/internal';

/**
 * Patches the global @emotion/css cache with RTL support
 *
 * WARNING: This is a hack! We're replacing the internal cache object
 * of @emotion/css at runtime. This works but is fragile.
 */
export function patchGlobalEmotionCache() {
  if (!isRtl()) {
    // LTR mode - no patching needed
    return;
  }

  // Create RTL-enabled cache with same key as @emotion/css default
  const rtlCache = createCache({
    key: 'css', // MUST match @emotion/css default key
    stylisPlugins: [rtlPlugin],
  });

  // Replace all properties of the global cache individually
  // Object.assign might not work for all properties, so we copy each one
  Object.keys(rtlCache).forEach((key) => {
    // @ts-ignore - We're monkey-patching internal cache properties
    globalCache[key] = rtlCache[key];
  });

  // Also patch the prototype chain to ensure all methods are replaced
  Object.setPrototypeOf(globalCache, Object.getPrototypeOf(rtlCache));
}
