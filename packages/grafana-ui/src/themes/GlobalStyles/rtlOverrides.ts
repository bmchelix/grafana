// BMC Change: This entire file is added for RTL support
import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

/**
 * RTL Override Styles
 *
 * This file contains CSS overrides for classes that should NOT be affected
 * by the RTL (right-to-left) automatic CSS flipping.
 *
 * When the stylis RTL plugin flips CSS properties (left -> right, margin-left -> margin-right, etc.),
 * some components may break. Add overrides here to restore the original LTR behavior.
 *
 * Pattern:
 *   '[dir="rtl"] .class-name': {
 *     // Reset properties back to their LTR values
 *     left: 'auto',
 *     right: '0px',
 *   }
 */
export function getRtlOverrideStyles(theme: GrafanaTheme2) {
  // Only apply these styles in RTL mode
  if (!theme.isRtl) {
    return css({});
  }

  // eslint-disable-next-line @emotion/syntax-preference
  return css`
    .scene-resize-handle {
      /* @noflip */
      right: 0;
      /* @noflip */
      left: auto;
      /* @noflip */
      cursor: se-resize;
      padding: unset;
    }
  `;
}
