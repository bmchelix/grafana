import { TimeRange } from '@grafana/data';
import {
  CustomVariableValue,
  formatRegistry,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneVariable,
  SceneVariableState,
  SceneVariableValueChangedEvent,
  VariableCustomFormatterFn,
  VariableValue,
} from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { convertQuery2TimeRange, convertTimeRange2Query } from 'app/features/variables/datepicker/utils';

import { DatePickerSelect } from './DatePickerSelect';

export interface DatePickerVariableState extends SceneVariableState {
  value: string;
}

export class DateRangeValue implements CustomVariableValue {
  constructor(
    public from: string,
    public to: string,
    private variable: DatePickerVariable
  ) {}

  getEmptyValue(): string {
    const isArAllValuesEnabled = getFeatureStatus('bhd-ar-all-values') || getFeatureStatus('bhd-ar-all-values-v2');
    const GUID = 'ARJDBC6460AC66AB204CA7BE8869BB9AF532F9';
    return isArAllValuesEnabled ? GUID : '';
  }

  formatter(formatNameOrFn?: string | VariableCustomFormatterFn): string {    
    if (formatNameOrFn === 'from') {
      return this.from || this.getEmptyValue();
    }
    if (formatNameOrFn === 'to') {
      return this.to || this.getEmptyValue();
    }
    const defaultVal = `From: ${this.from} - To: ${this.to}`;
    if (typeof formatNameOrFn === 'function') {
      return formatNameOrFn(defaultVal, {});
    }
    let formatter = formatNameOrFn ? formatRegistry.getIfExists(formatNameOrFn as string) : undefined;
    if (!formatter) {
      console.error(`Variable format ${formatNameOrFn} not found. Using glob format as fallback.`);
      formatter = formatRegistry.get(VariableFormatID.Glob);
    }

    return formatter.formatter(defaultVal, [], this.variable);    
  }
}

export class DatePickerVariable
  extends SceneObjectBase<DatePickerVariableState>
  implements SceneVariable<DatePickerVariableState>
{
  public constructor(initialState: Partial<DatePickerVariableState>) {
    super({
      type: 'datepicker',
      value: '',
      name: '',
      ...initialState,
    });
    this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: () => [this.getKey()] });
  }

  public getValue(): VariableValue {
    const range = convertQuery2TimeRange(this.state.value);
    return new DateRangeValue(range.from?.toISOString?.(), range.to?.toISOString?.(), this);
  }

  public getTimeRange(): TimeRange {
    return convertQuery2TimeRange(this.state.value);
  }

  public setValue(newValue: TimeRange) {
    const query = convertTimeRange2Query(newValue);
    if (query !== this.state.value) {
      this.setState({ value: query });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }

  private getKey(): string {
    return `var-${this.state.name}`;
  }

  public getUrlState() {
    return { [this.getKey()]: this.state.value };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const val = values[this.getKey()];
    if (typeof val === 'string') {
      this.setState({ value: val });
    }
  }

  public static Component = ({ model }: SceneComponentProps<DatePickerVariable>) => {
    return <DatePickerSelect model={model} />;
  };
}
