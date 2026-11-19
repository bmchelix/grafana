// BMC file for dashboard personalization - Save filter values
import React, { useState } from 'react';
import { flushSync } from 'react-dom';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useSceneObjectState } from '@grafana/scenes';
import { ButtonSelect, ToolbarButton } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { getPersonalizationSrv } from 'app/features/dashboard/services/PersonalizationSrv';
import { FEATURE_CONST, getGrafanaFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';
import { PRESERVED_SCENE_STATE_KEY } from '../utils/dashboardSessionState';

import {
  TimeAndVariableChangeBehavior,
  TimeAndVariableChangeBehaviorState,
} from './behaviors/TimeAndVariablesChangeBehavior';

interface LocationReloadState {
  routeReloadCounter?: number;
}

function isLocationReloadState(state: unknown): state is LocationReloadState {
  return state !== null && typeof state === 'object';
}

function getNextRouteReloadCounter(state: unknown): number {
  if (isLocationReloadState(state) && typeof state.routeReloadCounter === 'number') {
    return state.routeReloadCounter + 1;
  }
  return 1;
}

interface UsePersonalizationActionsResult {
  isLoading: boolean;
  onSaveFilters: (behavior: TimeAndVariableChangeBehaviorState) => void;
  onResetFilters: () => void;
  onResetToDefaults: () => void;
}

function usePersonalizationActions(dashboard: DashboardScene | null, uid: string): UsePersonalizationActionsResult {
  const [isLoading, setIsLoading] = useState(false);

  const onSaveFilters = React.useCallback(
    (behavior: TimeAndVariableChangeBehaviorState) => {
      if (!dashboard) {
        return;
      }
      setIsLoading(true);
      const changes = dashboard.getDashboardChanges(true, true);
      const changedModel = changes?.changedSaveModel;

      // Check if it's a Dashboard (v1) which has templating and time properties
      const hasDashboardProps = changedModel && 'templating' in changedModel && 'time' in changedModel;

      getPersonalizationSrv()
        .saveFilters({
          uid,
          list: hasDashboardProps ? (changedModel.templating?.list ?? []) : [],
          time: hasDashboardProps ? changedModel.time : undefined,
          hasTimeRangeChanged: behavior?.hasTimeChanges,
        })
        .then(() => {
          appEvents.publish({
            type: AppEvents.alertSuccess.name,
            payload: [t('bmc.dashboard.toolbar.save-filters-success', 'Saved filter values successfully.')],
          });
        })
        .catch((e) => {
          console.error('Failed to save filter values:', e);
          appEvents.publish({
            type: AppEvents.alertError.name,
            payload: [t('bmc.dashboard.toolbar.save-filters-failure', 'Failed to save filter values.')],
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [dashboard, uid]
  );

  const onResetFilters = React.useCallback(() => {
    setIsLoading(true);
    getPersonalizationSrv()
      .resetFilters(uid)
      .then(() => {
        window.location.href = window.location.href.split('?')[0];
      })
      .catch(() => {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [t('bmc.dashboard.toolbar.reset-filters-failure', 'Failed to reset filter values.')],
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [uid]);

  // Discards the in-memory scene cache so the dashboard rebuilds from its saved model
  // (authored variable and time defaults) on an in-app reload, without a browser refresh.
  const onResetToDefaults = React.useCallback(() => {
    const stateManager = getDashboardScenePageStateManager();
    stateManager.removeSceneCache(uid);
    window.sessionStorage.removeItem(PRESERVED_SCENE_STATE_KEY);

    // Tear down the live scene before clearing the URL. Interval (and other explicit-value)
    // variables can write var-* params back to the URL on unmount; clearing search after
    // unmount avoids the new scene reading stale URL state (e.g. var-test=30m).
    flushSync(() => {
      stateManager.clearState();
    });

    const location = locationService.getLocation();
    // Clear temp URL params and bump routeReloadCounter so DashboardScenePage
    // re-fetches and rebuilds the scene with default variable values.
    locationService.replace({
      pathname: location.pathname,
      search: '',
      state: { routeReloadCounter: getNextRouteReloadCounter(location.state) },
    });
  }, [uid]);

  return { isLoading, onSaveFilters, onResetFilters, onResetToDefaults };
}

export function SaveFiltersButton({ dashboard, uid }: { dashboard: DashboardScene; uid: string }) {
  const { isLoading, onSaveFilters } = usePersonalizationActions(dashboard, uid);

  const behaviors = dashboard.state.$behaviors;
  const savePersonalizedFilter = behaviors?.find((b) => b instanceof TimeAndVariableChangeBehavior);

  // Always call the hook, but only use the result if savePersonalizedFilter exists
  const behaviorState = useSceneObjectState(savePersonalizedFilter!);
  const timeAndVariableBehavior: TimeAndVariableChangeBehaviorState | undefined = savePersonalizedFilter
    ? behaviorState
    : undefined;
  const changes = dashboard?.getDashboardChanges(true, true);

  const disabled =
    !timeAndVariableBehavior?.hasChanges || isLoading || !(changes?.hasVariableValueChanges || changes?.hasTimeChanges);

  return (
    <ToolbarButton
      icon={isLoading ? 'fa fa-spinner' : 'bmc-save-filter'}
      tooltip={t('bmc.dashboard.toolbar.save-filters', 'Save filters')}
      disabled={disabled}
      onClick={() => timeAndVariableBehavior && onSaveFilters(timeAndVariableBehavior)}
      key="save-filters-button"
    />
  );
}

export function ResetFiltersButton({ uid }: { uid: string }) {
  const { onResetFilters, onResetToDefaults } = usePersonalizationActions(null, uid);
  const resetToDefaultsEnabled = getGrafanaFeatureStatus(FEATURE_CONST.ENABLE_RESET_TO_DEFAULTS_IN_DASHBOARD);

  const options = [
    {
      label: t('bmc.dashboard.toolbar.reset-saved-filters', 'Reset saved filters'),
      value: 'reset-saved-filters',
    },
  ];

  if (resetToDefaultsEnabled) {
    options.push({
      label: t('bmc.dashboard.toolbar.reset-to-defaults', 'Reset to defaults'),
      value: 'reset-to-defaults',
    });
  }

  return (
    <ButtonSelect
      value={undefined}
      options={options}
      title={t('bmc.dashboard.toolbar.reset-saved-filters', 'Reset saved filters')}
      onChange={(item) => {
        if (item.value === 'reset-to-defaults') {
          onResetToDefaults();
        } else {
          onResetFilters();
        }
      }}
      key="reset-filters-button"
    />
  );
}
