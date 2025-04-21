import { from, Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  QueryVariableModel,
  VariableSupportType,
} from '@grafana/data';

import { TimeSrv } from '../../dashboard/services/TimeSrv';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from '../guard';
import { getLegacyQueryOptions } from '../utils';

export interface RunnerArgs {
  variable: QueryVariableModel;
  datasource: DataSourceApi;
  timeSrv: TimeSrv;
  runRequest: (
    datasource: DataSourceApi,
    request: DataQueryRequest,
    queryFunction?: typeof datasource.query
  ) => Observable<PanelData>;
  searchFilter?: string;
}

type GetTargetArgs = { datasource: DataSourceApi; variable: QueryVariableModel };

export interface QueryRunner {
  type: VariableSupportType;
  canRun: (dataSource: DataSourceApi) => boolean;
  getTarget: (args: GetTargetArgs) => DataQuery;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

export class QueryRunners {
  private readonly runners: QueryRunner[];
  constructor() {
    this.runners = [
      new LegacyQueryRunner(),
      new StandardQueryRunner(),
      new CustomQueryRunner(),
      new DatasourceQueryRunner(),
    ];
  }

  getRunnerForDatasource(datasource: DataSourceApi): QueryRunner {
    const runner = this.runners.find((runner) => runner.canRun(datasource));
    if (runner) {
      return runner;
    }

    throw new Error("Couldn't find a query runner that matches supplied arguments.");
  }

  //Check if datasource has a query runner associated with it
  isQueryRunnerAvailableForDatasource(datasource: DataSourceApi) {
    return this.runners.some((runner) => runner.canRun(datasource));
  }
}

class LegacyQueryRunner implements QueryRunner {
  type = VariableSupportType.Legacy;

  canRun(dataSource: DataSourceApi) {
    return hasLegacyVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasLegacyVariableSupport(datasource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  // BMC code changes
  getDefaultValuesSeriesForHelixDatasource(
    variable: QueryVariableModel
  ): Array<{ text: string | string[]; type: string | string[]; value: string | string[] }> {
    let defaultVariableValues = [];

    let defaultText = variable.current?.text;
    let defaultValue = variable.current?.value;
    const defaultType = 'string';

    if (defaultText) {
      // defaultText is an array of strings, push each one to default values
      if (Array.isArray(defaultText)) {
        defaultText.map((text, index) => {
          defaultVariableValues.push({
            text: text,
            type: defaultType,
            value: defaultValue[index],
          });
        });
      } else {
        defaultVariableValues.push({
          text: defaultText,
          type: defaultType,
          value: defaultValue,
        });
      }
    }

    return defaultVariableValues;
  }
  // BMC code changes end

  runRequest({ datasource, variable, searchFilter, timeSrv }: RunnerArgs, request: DataQueryRequest) {
    if (!hasLegacyVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    const queryOptions: any = getLegacyQueryOptions(variable, searchFilter, timeSrv, request.scopedVars);

    // BMC code changes start
    // Default variables are currently only enabled for "BMC Helix" datasource to prevent breaking changes for customers using 3rd party datasources.
    // Some datasources expect response/series in a different format, be careful when changing it to support more datasources.
    if (
      variable.useDefaultValues &&
      variable.datasource?.type === 'bmchelix-ade-datasource' &&
      variable.current.value
    ) {
      const series = this.getDefaultValuesSeriesForHelixDatasource(variable);
      if (series.length > 0 && series[0].value !== '$__all') {
        // Can assume defaults are saved since length > 0
        return of({
          series,
          state: LoadingState.Done,
          timeRange: queryOptions.range,
        });
      }
    }
    // BMC code changes end

    return from(datasource.metricFindQuery(variable.query, queryOptions)).pipe(
      mergeMap((values) => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }

        const series: any = values;
        return of({ series, state: LoadingState.Done, timeRange: queryOptions.range });
      })
    );
  }
}

class StandardQueryRunner implements QueryRunner {
  type = VariableSupportType.Standard;

  canRun(dataSource: DataSourceApi) {
    return hasStandardVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(datasource)) {
      return datasource.variables.toDataQuery(variable.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!datasource.variables.query) {
      return runRequest(datasource, request);
    }

    return runRequest(datasource, request, datasource.variables.query.bind(datasource.variables));
  }
}

class CustomQueryRunner implements QueryRunner {
  type = VariableSupportType.Custom;

  canRun(dataSource: DataSourceApi) {
    return hasCustomVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasCustomVariableSupport(datasource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(datasource, request, datasource.variables.query.bind(datasource.variables));
  }
}

export const variableDummyRefId = 'variable-query';

class DatasourceQueryRunner implements QueryRunner {
  type = VariableSupportType.Datasource;

  canRun(dataSource: DataSourceApi) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasDatasourceVariableSupport(datasource)) {
      return { ...variable.query, refId: variable.query.refId ?? variableDummyRefId };
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasDatasourceVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(datasource, request);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}
