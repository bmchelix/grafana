/**
 * Global Emotion CSS Cache RTL Patch for @grafana/ui
 *
 * PROBLEM: This package uses `@emotion/css` extensively, which has a hardcoded
 * global cache that doesn't support RTL plugins.
 *
 * SOLUTION: Patch the global cache at module load time to add RTL plugin
 * when in RTL mode.
 *
 * This runs when the package is imported, BEFORE components use the cache.
 */

import createCache from '@emotion/cache';
import { cache as globalCache } from '@emotion/css';
import rtlPlugin from '@mui/stylis-plugin-rtl';

// Check if we're in RTL mode by reading document direction
function isRtlMode(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.documentElement.dir === 'rtl';
}

/**
 * Patches the global @emotion/css cache with RTL support
 */
export function patchEmotionCacheForRTL() {
  if (!isRtlMode()) {
    // LTR mode - no patching needed
    return;
  }

  console.log('[grafana-ui RTL] Patching global Emotion cache...');

  // Create RTL-enabled cache with same key as @emotion/css default
  const rtlCache = createCache({
    key: 'css',
    stylisPlugins: [rtlPlugin],
  });

  // Replace all properties of the global cache
  Object.keys(rtlCache).forEach((key) => {
    // @ts-ignore - Monkey-patching internal cache
    globalCache[key] = rtlCache[key];
  });

  // Also patch prototype chain
  Object.setPrototypeOf(globalCache, Object.getPrototypeOf(rtlCache));

  console.log('[grafana-ui RTL] Global Emotion cache patched successfully');
}

// Auto-run the patch when this module loads
patchEmotionCacheForRTL();
