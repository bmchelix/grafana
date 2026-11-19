import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

import { GrafanaTheme2, ThemeContext } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { isRtl } from '@grafana/ui/internal';

import { appEvents } from '../core';

import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Create Emotion cache with optional RTL support
 * The cache key changes based on RTL mode to prevent hydration mismatches
 *
 * CRITICAL: @mui/stylis-plugin-rtl MUST be the ONLY plugin in stylisPlugins
 * Emotion automatically includes the prefixer internally when stylisPlugins
 * is provided. Adding additional plugins manually can break the default behavior.
 */
function createEmotionCache() {
  const rtlMode = isRtl();

  return createCache({
    key: rtlMode ? 'css-rtl' : 'css',
    // BMC Change: Only add RTL plugin - Emotion handles prefixing automatically
    stylisPlugins: rtlMode ? [rtlPlugin] : undefined,
  });
}

export const ThemeProvider = ({ children, value }: { children: React.ReactNode; value: GrafanaTheme2 }) => {
  const [theme, setTheme] = useState(value);
  const [emotionCache, setEmotionCache] = useState(() => createEmotionCache());

  useEffect(() => {
    const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
      config.theme2 = event.payload;
      setTheme(event.payload);
    });

    return () => sub.unsubscribe();
  }, []);

  // BMC Change: Recreate cache if RTL mode changes (e.g., user changes locale)
  useEffect(() => {
    setEmotionCache(createEmotionCache());
  }, []);
  // BMC Change: End

  useEffect(() => {
    setTheme(value);
  }, [value]);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeContext.Provider value={theme}>
        <SkeletonTheme
          baseColor={theme.colors.emphasize(theme.colors.background.secondary)}
          highlightColor={theme.colors.emphasize(theme.colors.background.secondary, 0.1)}
          borderRadius={theme.shape.radius.default}
        >
          {children}
        </SkeletonTheme>
      </ThemeContext.Provider>
    </CacheProvider>
  );
};

export const provideTheme = <P extends {}>(component: React.ComponentType<P>, theme: GrafanaTheme2) => {
  return function ThemeProviderWrapper(props: P) {
    return <ThemeProvider value={theme}>{React.createElement(component, { ...props })}</ThemeProvider>;
  };
};
