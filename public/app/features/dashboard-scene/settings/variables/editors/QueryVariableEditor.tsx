import { FormEvent, useState } from 'react';
import { useAsync } from 'react-use';

import { AppEvents, DataSourceInstanceSettings, getDataSourceRef, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph, SceneVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { Box, Button, Field, Modal, TextLink } from '@grafana/ui';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import { StaticOptionsOrderType, StaticOptionsType } from 'app/features/variables/query/QueryVariableStaticOptions';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';
import { VariableTextAreaField } from '../components/VariableTextAreaField';
import { VariableValuesPreview } from '../components/VariableValuesPreview';
import {
  containsDirectTimeRangeVariables,
  deleteVariableCache,
  hasVariableOptions,
  isServiceManagementQuery,
} from '../utils';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}
type VariableQueryType = QueryVariable['state']['query'];

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const {
    datasource,
    regex,
    sort,
    refresh,
    isMulti,
    includeAll,
    allValue,
    query,
    allowCustomValue,
    staticOptions,
    staticOptionsOrder,
    // BMC Change: Below all props
    // @ts-expect-error
    discardForAll,
    // @ts-expect-error
    bmcVarCache,
  } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };
  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };
  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings) => {
    const datasource = getDataSourceRef(dsInstanceSettings);

    if ((variable.state.datasource?.type || '') !== datasource.type) {
      variable.setState({ datasource, query: '', definition: '' });
      return;
    }

    variable.setState({ datasource });
  };
  const onQueryChange = (query: VariableQueryType) => {
    // BMC code starts - invalidate variable cache when query changes (before setting new definition)
    // @ts-expect-error
    if (variable.state.bmcVarCache) {
      const dashboardUID = getDashboardSrv().getCurrent()?.uid;
      deleteVariableCache(variable.state, dashboardUID, true);
    }
    // BMC code ends
    variable.setState({ query, definition: getQueryDef(query) });
    onRunQuery();
  };

  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    onRunQuery();
    variable.setState({ staticOptions });
  };

  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    onRunQuery();
    variable.setState({ staticOptionsOrder });
  };

  // BMC Change: Starts
  const onIncludeOnlyAvailable = (event: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    variable.setState({ discardForAll: event.currentTarget.checked });
  };

  const onVariableCacheChange = (event: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    variable.setState({ bmcVarCache: event.currentTarget.checked });
  };

  let enableVariableCachingToggle = false;
  const hasValidQuery =
    variable.state.definition !== '' ||
    (typeof variable.state.query === 'object' &&
      variable.state.query !== null &&
      ((variable.state.query as any).sourceQuery?.rawQuery ||
        (variable.state.query as any).sourceQuery?.view?.selectedFields?.length > 0));

  if (getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) && hasValidQuery) {
    let errorMsg = '';
    // Only supports service management type queries
    if (isServiceManagementQuery(variable.state.query || '')) {
      enableVariableCachingToggle = true;
    } else {
      errorMsg = t(
        'bmc.variables.query-editor.variable-caching.service-management-error',
        'Caching is supported only for Service Management queries'
      );
    }

    // Logic for enabling toggle based on dependencies:
    // 1. If time range is present in variable query -> Toggle is disabled by default

    if (enableVariableCachingToggle) {
      const hasTimeRangeVars = containsDirectTimeRangeVariables(variable.state.definition as string);

      if (hasTimeRangeVars) {
        enableVariableCachingToggle = false;
        errorMsg = t(
          'bmc.variables.query-editor.variable-caching.dependant-error',
          'Caching for time range dependent variables not allowed'
        );
      }
    }

    // Show error if enableVariableCachingToggle is false + property was set to true
    if (!enableVariableCachingToggle && bmcVarCache) {
      const appEvents = getAppEvents();
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [errorMsg],
      });

      // If enableVariableCachingToggle is false + property was set to true, send an event equivalent to the toggle being unchecked to force it being unchecked on UI and dashboard JSON
      onVariableCacheChange?.({
        currentTarget: { checked: false },
      } as FormEvent<HTMLInputElement>);
    }
  } else if (getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) && bmcVarCache && !hasValidQuery) {
    // if bmcVarCache was previously on and it is no longer a valid query
    const appEvents = getAppEvents();
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: [
        t(
          'bmc.variables.query-editor.variable-caching.service-management-error',
          'Caching is supported only for Service Management queries'
        ),
      ],
    });
    // Uncheck the cache toggle
    // @ts-expect-error
    variable.setState({ bmcVarCache: false });
  }
  // BMC Change: Ends

  return (
    <QueryVariableEditorForm
      datasource={datasource ?? undefined}
      onDataSourceChange={onDataSourceChange}
      query={query}
      onQueryChange={onQueryChange}
      onLegacyQueryChange={onQueryChange}
      timeRange={timeRange}
      regex={regex}
      onRegExChange={onRegExChange}
      sort={sort}
      onSortChange={onSortChange}
      refresh={refresh}
      onRefreshChange={onRefreshChange}
      isMulti={!!isMulti}
      onMultiChange={onMultiChange}
      includeAll={!!includeAll}
      onIncludeAllChange={onIncludeAllChange}
      allValue={allValue ?? ''}
      onAllValueChange={onAllValueChange}
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
      staticOptions={staticOptions}
      staticOptionsOrder={staticOptionsOrder}
      onStaticOptionsChange={onStaticOptionsChange}
      onStaticOptionsOrderChange={onStaticOptionsOrderChange}
      // BMC Code: Below all props
      onIncludeOnlyAvailable={onIncludeOnlyAvailable}
      discardForAll={discardForAll}
      bmcVarCache={bmcVarCache || false}
      OnVariableCacheChange={onVariableCacheChange}
      enableVariableCachingToggle={enableVariableCachingToggle}
    />
  );
}

export function getQueryVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof QueryVariable)) {
    console.warn('getQueryVariableOptions: variable is not a QueryVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <ModalEditor variable={variable} />,
    }),
  ];
}

export function ModalEditor({ variable }: { variable: QueryVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  const onRunQuery = () => {
    variable.refreshOptions();
  };

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      <Modal
        title={t('dashboard.edit-pane.variable.query-options.modal-title', 'Query Variable')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <Editor variable={variable} />
        <Modal.ButtonRow>
          <Button
            variant="primary"
            fill="outline"
            onClick={onRunQuery}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variable.query-options.preview">Preview</Trans>
          </Button>
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => setIsOpen(false)}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variable.query-options.close">Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

export function Editor({ variable }: { variable: QueryVariable }) {
  const {
    datasource: datasourceRef,
    sort,
    refresh,
    query,
    regex,
    // BMC code: disable static options
    // staticOptions,
    // staticOptionsOrder,
    // BMC code: end
  } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();
  const { value: dsConfig } = useAsync(async () => {
    const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
    const VariableQueryEditor = await getVariableQueryEditor(datasource);
    const defaultQuery = datasource?.variables?.getDefaultQuery?.();

    if (!query && defaultQuery) {
      const newQuery =
        typeof defaultQuery === 'string' ? defaultQuery : { ...defaultQuery, refId: defaultQuery.refId ?? 'A' };
      onQueryChange(newQuery);
    }

    return { datasource, VariableQueryEditor };
  }, [datasourceRef]);

  const { datasource: selectedDatasource, VariableQueryEditor } = dsConfig ?? {};

  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings) => {
    const datasource = getDataSourceRef(dsInstanceSettings);

    if ((variable.state.datasource?.type || '') !== datasource.type) {
      variable.setState({ datasource, query: '', definition: '' });
      return;
    }

    variable.setState({ datasource });
  };

  const onQueryChange = (query: VariableQueryType) => {
    variable.setState({ query, definition: getQueryDef(query) });
  };

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };

  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };
  // BMC code: disable static options
  // const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
  //   variable.setState({ staticOptions });
  // };
  // const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
  //   variable.setState({ staticOptionsOrder });
  // };
  // BMC code: end

  const isHasVariableOptions = hasVariableOptions(variable);

  return (
    <div data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.editor}>
      <Field
        label={t('dashboard-scene.query-variable-editor-form.label-target-data-source', 'Target data source')}
        htmlFor="data-source-picker"
        noMargin
      >
        <DataSourcePicker current={selectedDatasource} onChange={onDataSourceChange} variables={true} width={30} />
      </Field>

      {selectedDatasource && VariableQueryEditor && (
        <QueryEditor
          onQueryChange={onQueryChange}
          onLegacyQueryChange={onQueryChange}
          datasource={selectedDatasource}
          query={query}
          VariableQueryEditor={VariableQueryEditor}
          timeRange={timeRange}
        />
      )}

      <VariableTextAreaField
        defaultValue={regex ?? ''}
        name={t('dashboard-scene.query-variable-editor-form.name-regex', 'Regex')}
        description={
          <div>
            <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-optional">
              Optional, if you want to extract part of a series name or metric node segment.
            </Trans>
            <br />
            <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-examples">
              Named capture groups can be used to separate the display text and value (
              <TextLink
                href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                external
              >
                see examples
              </TextLink>
              ).
            </Trans>
          </div>
        }
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder="/.*-(?<text>.*)-(?<value>.*)-.*/"
        onBlur={onRegExChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2}
        width={52}
      />

      <QueryVariableSortSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2}
        onChange={onSortChange}
        sort={sort}
      />

      <QueryVariableRefreshSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2}
        onChange={onRefreshChange}
        refresh={refresh}
      />

      {/* BMC code: disable static options */}
      {/* {onStaticOptionsChange && onStaticOptionsOrderChange && (
        <QueryVariableStaticOptions
          staticOptions={staticOptions}
          staticOptionsOrder={staticOptionsOrder}
          onStaticOptionsChange={onStaticOptionsChange}
          onStaticOptionsOrderChange={onStaticOptionsOrderChange}
        />
      )} */}

      {isHasVariableOptions && <VariableValuesPreview options={variable.getOptionsForSelect(false)} />}
    </div>
  );
}

function getQueryDef(query: VariableQueryType) {
  if (typeof query === 'string') {
    return query;
  } else if (query.hasOwnProperty('query') && typeof query.query === 'string') {
    return query.query;
  }
  // BMC code starts
  // for visual query builder queries
  else if (typeof query.sourceQuery?.rawQuery === 'string') {
    return query.sourceQuery.rawQuery;
  }
  // BMC code ends
  else {
    return '';
  }
}
