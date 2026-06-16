import { PropsWithChildren, useMemo } from 'react';

import { VariableRefresh } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

interface Props {
  onChange: (option: VariableRefresh) => void;
  refresh: VariableRefresh;
  testId?: string;
}

const getRefreshOptions = () => {
  return [
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.refresh-options.on-dash-load',
        'On dashboard load'
      ),
      // BMC change - vishaln
      // Logic must be same for both, so keeping same button to not confuse the user
      value: VariableRefresh.onDashboardLoad || VariableRefresh.onRefreshButtonClick,
      // BMC change ends
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.refresh-options.on-time-change',
        'On time range change'
      ),
      value: VariableRefresh.onTimeRangeChanged,
    },
  ];
};

export function QueryVariableRefreshSelect({ onChange, refresh, testId }: PropsWithChildren<Props>) {
  const isSmallScreen = !useMediaQueryMinWidth('sm');

  const REFRESH_OPTIONS = useMemo(() => getRefreshOptions(), []);
  const value = useMemo(
    () => REFRESH_OPTIONS.find((o) => o.value === refresh)?.value ?? REFRESH_OPTIONS[0].value,
    [REFRESH_OPTIONS, refresh]
  );

  return (
    <Field
      label={t('variables.query-variable-refresh-select.label-refresh', 'Refresh')}
      description={t(
        'variables.query-variable-refresh-select.description-update-values-variable',
        'When to update the values of this variable'
      )}
      data-testid={testId}
    >
      <RadioButtonGroup
        options={REFRESH_OPTIONS}
        onChange={onChange}
        value={value}
        size={isSmallScreen ? 'sm' : 'md'}
      />
    </Field>
  );
}
