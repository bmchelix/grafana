/**
 * RTL (Right-to-Left) Utilities for Grafana UI
 *
 * This module provides utilities for RTL language support.
 *
 * PREFERRED: Use theme.isRtl when you have access to GrafanaTheme2
 * FALLBACK: Use isRtl() function when theme is not available
 *
 * Since @grafana/ui is built separately from the main app, it cannot access
 * bootData directly. Instead, it relies on the document's dir attribute which
 * is set early during app initialization based on bootData.user.language.
 */

import type { GrafanaTheme2 } from '@grafana/data';
import { IconName } from '../types/icon';

const IGNORED_PANEL_TYPES_FOR_RTL = ['table', 'bmc-table-panel', 'bmc-ade-combination-chart', 'bmc-ade-bar'];
/**
 * Checks if the current document direction is RTL
 *
 * PREFERRED: Use theme.isRtl when you have access to theme
 * This function is a fallback for cases where theme is not available
 *
 * @returns true if document direction is RTL, false otherwise
 */
export function isRtl(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const dir = document.documentElement.getAttribute('dir');
  return dir === 'rtl';
}

/**
 * Gets the current text direction as a string
 *
 * PREFERRED: Use theme.isRtl when you have access to theme
 * This function is a fallback for cases where theme is not available
 *
 * @param theme - Optional GrafanaTheme2 object (preferred)
 * @returns 'rtl' or 'ltr'
 *
 * @example
 * // With theme (preferred)
 * const direction = getTextDirection(theme);
 *
 * // Without theme (fallback)
 * const direction = getTextDirection();
 */
export function getTextDirection(theme?: GrafanaTheme2): 'rtl' | 'ltr' {
  const rtlMode = theme ? theme.isRtl : isRtl();
  return rtlMode ? 'rtl' : 'ltr';
}

/**
 * Returns one of two values based on current text direction
 *
 * PREFERRED: Use theme.isRtl when you have access to theme
 * This function is a fallback for cases where theme is not available
 *
 * @param ltrValue - Value to return in LTR mode
 * @param rtlValue - Value to return in RTL mode
 * @param theme - Optional GrafanaTheme2 object (preferred)
 * @returns The appropriate value based on current direction
 *
 * @example
 * // With theme (preferred)
 * const margin = getDirectionalValue('0 8px 0 0', '0 0 0 8px', theme);
 *
 * // Without theme (fallback)
 * const margin = getDirectionalValue('0 8px 0 0', '0 0 0 8px');
 */
export function getDirectionalValue<T>(ltrValue: T, rtlValue: T, theme?: GrafanaTheme2): T {
  const rtlMode = theme ? theme.isRtl : isRtl();
  return rtlMode ? rtlValue : ltrValue;
}

/**
 * React-Table RTL Helper
 *
 * React-table v7 hardcodes dir="ltr" in getTableProps() and getTableBodyProps().
 * This utility provides helpers to strip the dir attribute for RTL support.
 */

/**
 * Override dir attribute directly
 * Use this if you want to be more explicit in JSX
 *
 * @example
 * <div {...table.getTableProps()} {...overrideDir()} />
 * <div {...table.getTableBodyProps()} {...overrideDir()} />
 */
export function overrideDir() {
  return { dir: undefined };
}

export function directionForPanelContent(panelType?: string) {
  if (!isRtl() || !panelType || IGNORED_PANEL_TYPES_FOR_RTL.includes(panelType)) {
    return 'ltr';
  }
  return 'rtl';
}

// BMC Change: RTL Support - Helper to resolve RTL mode from various input types
/**
 * Resolves RTL mode from either a boolean, GrafanaTheme2 object, or document direction.
 *
 * @param themeOrIsRtl - Optional GrafanaTheme2 object or boolean isRtl value
 * @returns true if RTL mode, false otherwise
 *
 * @example
 * // With boolean (from useDirection hook)
 * const rtlMode = resolveRtlMode(true);
 *
 * // With theme
 * const rtlMode = resolveRtlMode(theme);
 *
 * // Without parameter (fallback to document)
 * const rtlMode = resolveRtlMode();
 */
export function resolveRtlMode(themeOrIsRtl?: GrafanaTheme2 | boolean): boolean {
  if (typeof themeOrIsRtl === 'boolean') {
    return themeOrIsRtl;
  }
  if (themeOrIsRtl) {
    return themeOrIsRtl.isRtl;
  }
  return isRtl();
}

/**
 * Icon name pairs that should be flipped for RTL support
 * Maps LTR icon name -> RTL icon name
 */
const iconFlipMap: Partial<Record<IconName, IconName>> = {
  // Angle icons
  'angle-left': 'angle-right',
  'angle-right': 'angle-left',
  'angle-double-left': 'angle-double-right',
  'angle-double-right': 'angle-double-left',

  // Arrow icons
  'arrow-left': 'arrow-right',
  'arrow-right': 'arrow-left',
  'arrow-from-right': 'arrow-from-right', // No left variant, keep as-is or use CSS transform
  'arrow-to-right': 'arrow-to-right', // No left variant, keep as-is or use CSS transform

  // Alignment icons
  'align-left': 'align-right',
  'align-right': 'align-left',
  'horizontal-align-left': 'horizontal-align-right',
  'horizontal-align-right': 'horizontal-align-left',

  // Grafana specific pane icons
  'gf-movepane-left': 'gf-movepane-right',
  'gf-movepane-right': 'gf-movepane-left',

  // Navigation icons
  forward: 'backward',
  backward: 'forward',

  // Sign in/out (enter/exit direction)
  signin: 'signout',
  signout: 'signin',

  // Corner icons
  'corner-down-right-alt': 'corner-down-right-alt', // No left variant available
};

/**
 * Flips a directional icon name for RTL support
 *
 * This function swaps left/right directional icons when in RTL mode.
 * For example, 'arrow-left' becomes 'arrow-right' in RTL mode.
 *
 * @param iconName - The original icon name
 * @param themeOrIsRtl - Optional GrafanaTheme2 object or boolean isRtl value (from useDirection hook)
 * @returns The flipped icon name if in RTL mode and a flip mapping exists, otherwise the original icon name
 *
 * @example
 * // With theme (preferred)
 * const icon = getDirectionalIcon('arrow-left', theme);
 * // Returns 'arrow-right' in RTL mode, 'arrow-left' in LTR mode
 *
 * // With useDirection hook (for context-aware direction)
 * const { isRtl } = useDirection();
 * const icon = getDirectionalIcon('arrow-left', isRtl);
 *
 * // Without theme (fallback to document direction)
 * const icon = getDirectionalIcon('angle-right');
 * // Returns 'angle-left' in RTL mode, 'angle-right' in LTR mode
 */
// BMC Change: RTL Support - Added support for boolean isRtl parameter from useDirection hook
export function getDirectionalIcon(iconName: IconName, themeOrIsRtl?: GrafanaTheme2 | boolean): IconName {
  const rtlMode = resolveRtlMode(themeOrIsRtl);

  if (!rtlMode) {
    return iconName;
  }

  return iconFlipMap[iconName] ?? iconName;
}

/**
 * Checks if an icon should be CSS-flipped for RTL support
 *
 * Some icons don't have a mirrored variant but should be visually flipped
 * using CSS transform. This function identifies such icons.
 *
 * @param iconName - The icon name to check
 * @returns true if the icon should be CSS-flipped in RTL mode
 *
 * @example
 * // Use with CSS
 * const shouldFlip = shouldCssFlipIcon('external-link-alt');
 * // Apply transform: scaleX(-1) if true and in RTL mode
 */
export function shouldCssFlipIcon(iconName: string): boolean {
  const cssFlipIcons = [
    'external-link-alt',
    'arrow-from-right',
    'arrow-to-right',
    'corner-down-right-alt',
    'enter',
    'import',
    'share-alt',
    'drilldown',
  ];

  return cssFlipIcons.includes(iconName);
}

/**
 * Gets the CSS transform style for RTL icon flipping
 *
 * @param iconName - The icon name to check
 * @param themeOrIsRtl - Optional GrafanaTheme2 object or boolean isRtl value (from useDirection hook)
 * @returns CSS transform string if icon should be flipped, undefined otherwise
 *
 * @example
 * // With theme
 * const transform = getIconFlipTransform('external-link-alt', theme);
 *
 * // With useDirection hook (for context-aware direction)
 * const { isRtl } = useDirection();
 * const transform = getIconFlipTransform('external-link-alt', isRtl);
 * // Returns 'scaleX(-1)' in RTL mode for applicable icons
 */
// BMC Change: RTL Support - Added support for boolean isRtl parameter from useDirection hook
export function getIconFlipTransform(iconName: string, themeOrIsRtl?: GrafanaTheme2 | boolean): string | undefined {
  const rtlMode = resolveRtlMode(themeOrIsRtl);

  if (rtlMode && shouldCssFlipIcon(iconName)) {
    return 'scaleX(-1)';
  }

  return undefined;
}
