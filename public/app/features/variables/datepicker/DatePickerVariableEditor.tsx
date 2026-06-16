import { ReactElement, useCallback, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DatePickerVariableModel, TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { isWeekStart, Stack, TimeRangeInput } from '@grafana/ui';
import { StoreState } from 'app/types/store';

import { VariableLegend } from '../../dashboard-scene/settings/variables/components/VariableLegend';
import { VariableEditorProps } from '../editor/types';

import { convertQuery2TimeRange, convertTimeRange2Query, getDefaultTimeRange } from './utils';

const mapStateToProps = (state: StoreState) => ({
  dashboard: state.dashboard.getModel(),
});

interface OwnProps extends VariableEditorProps<DatePickerVariableModel> {}
const connector = connect(mapStateToProps, {});
type connectedProps = ConnectedProps<typeof connector>;
type Props = OwnProps & connectedProps;

const DatePickerVariableEditorUnconnected = (props: Props): ReactElement => {
  const {
    onPropChange,
    variable: { query },
    dashboard,
  } = props;
  useEffect(() => {
    if (!query) {
      onPropChange({ propName: 'query', propValue: convertTimeRange2Query(), updateOptions: true });
    }
  });
  const updateVariable = useCallback(
    (val: TimeRange, updateOptions: boolean) => {
      onPropChange({ propName: 'query', propValue: convertTimeRange2Query(val), updateOptions });
    },
    [onPropChange]
  );
  const onChange = useCallback((val: TimeRange) => updateVariable(val, true), [updateVariable]);

  let timeRange: TimeRange;
  if (query) {
    timeRange = convertQuery2TimeRange(query, dashboard?.getTimezone());
  } else {
    timeRange = getDefaultTimeRange();
  }

  {
    /*BMC Change: To enable localization for below text*/
  }
  return (
    <Stack direction="column" gap={0.5}>
      <VariableLegend>
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.date-range.title">
          Select Time Range
        </Trans>
      </VariableLegend>
      <div>
        <TimeRangeInput
          clearable={true}
          value={timeRange}
          timeZone={dashboard?.getTimezone() ?? 'browser'}
          onChange={onChange}
          onChangeTimeZone={(tz: any) => console.log('timezone', tz)}
          hideQuickRanges={false}
          weekStart={isWeekStart(dashboard?.weekStart) ? dashboard.weekStart : undefined}
        />
      </div>
    </Stack>
  );
};

export const DatePickerVariableEditor = connector(DatePickerVariableEditorUnconnected);
