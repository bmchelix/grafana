import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';

import { contextSrv } from 'app/core/services/context_srv';

import { DashboardScene } from '../../DashboardScene';
import { ToolbarActionProps } from '../types';

/** Query param must match bootstrap logic in public/views/index.html */
export const FORCE_RTL_QUERY_PARAM = 'forceRTL';

/** Attribute placed on elements that the strict RTL interaction gate must not intercept. */
export const STRICT_RTL_EXEMPT_ATTR = 'data-strict-rtl-exempt';

const RTL_LOCALES = ['ar', 'he'];

/**
 * Whether the force-RTL preview query is on. Prefer the real URL search string (same as index.html);
 * `locationService.getSearchObject()` coerces `forceRTL=true` to boolean `true`, so `=== 'true'` is wrong there.
 */
export function isForceRtlQueryActive(): boolean {
  if (typeof window !== 'undefined') {
    const fromSearch = new URLSearchParams(window.location.search).get(FORCE_RTL_QUERY_PARAM);
    if (fromSearch !== null) {
      return fromSearch === 'true';
    }
  }
  const v = locationService.getSearchObject()[FORCE_RTL_QUERY_PARAM];
  return v === true || v === 'true' || (contextSrv.isEditor && document.body.getAttribute('dir') === 'rtl');
}

/** Primary UI language is Arabic (editors use LTR until forceRTL preview). */
export function isArabicUiLanguageForRtlPreview(): boolean {
  const lang = (contextSrv.user?.language || '').split('-')[0].toLowerCase();
  return lang === 'ar';
}

/**
 * True when an Editor/Admin is viewing a dashboard via the forceRTL preview toggle.
 * Mirrors the bootstrap logic in public/views/index.html (rtlFromForceParam path).
 */
export function isStrictEditorRtlPreviewActive(): boolean {
  if (!isForceRtlQueryActive()) {
    return false;
  }
  const lang = (contextSrv.user?.language || '').split('-')[0].toLowerCase();
  if (RTL_LOCALES.indexOf(lang) === -1) {
    return false;
  }
  return contextSrv.isEditor;
}

/** Remove the forceRTL param and reload to exit strict RTL preview. */
export function exitStrictRtlPreview(): void {
  locationService.partial({ [FORCE_RTL_QUERY_PARAM]: undefined }, true);
  window.location.reload();
}

// BMC Change: Match home-dashboard detection used in DashboardScene.getPageNav / getDashboardUrl (not a stable uid).
export function isHomeDashboardScene(dashboard: DashboardScene): boolean {
  const { meta, uid } = dashboard.state;
  const isNew = !Boolean(uid) && locationService.getLocation().pathname === '/dashboard/new';
  return !meta.url && !meta.slug && !isNew && !meta.isSnapshot;
}

export const ForceRtlPreviewToggle = ({ dashboard }: ToolbarActionProps) => {
  if (isHomeDashboardScene(dashboard)) {
    return null;
  }

  const forceOn = isForceRtlQueryActive();
  const styles = useStyles2(getStyles);

  const tooltip = forceOn
    ? t('dashboard.toolbar.force-rtl-preview.tooltip-on', 'Right-to-Left preview is currently on. Changing this will reload the page.')
    : t(
        'dashboard.toolbar.force-rtl-preview.tooltip-off',
        'Turn on to preview the dashboard in Right-to-Left mode. The page will reload.'
      );

  const ariaLabel = t('dashboard.toolbar.force-rtl-preview.aria', 'RTL layout preview');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const next = event.target.checked;
    locationService.partial(
      {
        [FORCE_RTL_QUERY_PARAM]: next ? 'true' : undefined,
      },
      true
    );
    window.location.reload();
  };

  return (
    <Tooltip content={tooltip}>
      <div
        className={styles.wrap}
        data-testid="dashboard-scenes-force-rtl-preview"
        {...{ [STRICT_RTL_EXEMPT_ATTR]: 'true' }}
        onClick={(e) => e.stopPropagation()}
      >
        <InlineSwitch
          id="dashboard-force-rtl-preview"
          transparent
          value={forceOn}
          onChange={onChange}
          label={ariaLabel}
        />
      </div>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'inline-flex',
    alignItems: 'center',
    marginInlineEnd: theme.spacing(0.5),
  }),
});
