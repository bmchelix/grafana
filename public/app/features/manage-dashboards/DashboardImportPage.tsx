import { css } from '@emotion/css';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, GrafanaTheme2, LoadingState, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Button,
  DropzoneFile,
  Field,
  FileDropzone,
  FileDropzoneDefaultChildren,
  LinkButton,
  // Input,
  Spinner,
  // TextLink,
  // Label,
  Stack,
  stylesFactory,
  TextArea,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { dispatch } from 'app/store/store';
import { StoreState } from 'app/types/store';

import { cleanUpAction } from '../../core/actions/cleanUp';
import { ImportDashboardOverviewV2 } from '../dashboard-scene/v2schema/ImportDashboardOverviewV2';

// BMC Code: Next lines
import { bulkLimit, Import } from './bulkoperation/pages/import/components/Import';
import { ImportOperationProvider, useImportOperations } from './bulkoperation/pages/import/state/actions';
import { initialImportDashboardState as iDashboardsState } from './bulkoperation/pages/import/state/reducers';
import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import {
  clearLoadedDashboard,
  dashboardLoaded,
  fetchDashboards,
  fetchGcomDashboard,
  importDashboardJson,
  importDashboardV2Json,
} from './state/actions';
import { initialImportDashboardState } from './state/reducers';
import { validateDashboardJson } from './utils/validation';

type DashboardImportPageRouteSearchParams = {
  gcomDashboardId?: string;
};

type OwnProps = Themeable2 & GrafanaRouteComponentProps<{}, DashboardImportPageRouteSearchParams>;

const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';
const JSON_PLACEHOLDER = `{
    "title": "Example - Repeating Dictionary variables",
    "uid": "_0HnEoN4z",
    "panels": [...]
    ...
}
`;

const mapStateToProps = (state: StoreState) => ({
  loadingState: state.importDashboard.state,
  dashboard: state.importDashboard.dashboard,
  // BMC Code: Next props
  navModel: getNavModel(state.navIndex, 'dashboards/import', undefined, true),
  isMultiple: state.importDashboard.multiple,
});

const mapDispatchToProps = {
  fetchGcomDashboard,
  importDashboardJson,
  cleanUpAction,
  // BMC Code: Next 3 lines
  fetchDashboards,
  dashboardLoaded,
  clearLoadedDashboard,
};

// BMC code - next line
const getImportFailedLabel = () => t('bmc.manage-dashboards.import-failed', 'Import failed');

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

class UnthemedDashboardImport extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    const { gcomDashboardId } = this.props.queryParams;
    if (gcomDashboardId) {
      this.getGcomDashboard({ gcomDashboard: gcomDashboardId });
      return;
    }
  }

  componentWillUnmount() {
    this.props.cleanUpAction({ cleanupAction: (state) => (state.importDashboard = initialImportDashboardState) });
  }

  // Do not display upload file list
  fileListRenderer = (file: DropzoneFile, removeFile: (file: DropzoneFile) => void) => null;

  onFileUpload = (result: string | ArrayBuffer | null) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_uploaded',
    });

    try {
      const json = JSON.parse(String(result));

      if (json.spec?.elements) {
        dispatch(importDashboardV2Json(json.spec));
        return;
      } else if (json.elements) {
        dispatch(importDashboardV2Json(json));
        return;
      }

      // check if it's a v1 resource format
      if (json.spec) {
        this.props.importDashboardJson(json.spec);
        return;
      }

      this.props.importDashboardJson(json);
    } catch (error) {
      if (error instanceof Error) {
        const failureTitle = t('bmc.manage-dashboards.serialization-failed', 'JSON -> JS Serialization failed');
        appEvents.emit(AppEvents.alertError, [getImportFailedLabel(), `${failureTitle}: ${error.message}`]);
      }
      return;
    }
  };

  getDashboardFromJson = (formData: { dashboardJson: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_pasted',
    });

    const dashboard = JSON.parse(formData.dashboardJson);

    // check if it's a v2 resource format
    if (dashboard.spec?.elements) {
      dispatch(importDashboardV2Json(dashboard.spec));
      return;
      // check if it's just a v2 spec
    } else if (dashboard.elements) {
      dispatch(importDashboardV2Json(dashboard));
      return;
    }

    // check if it's a v1 resource format
    if (dashboard.spec) {
      this.props.importDashboardJson(dashboard.spec);
      return;
    }

    this.props.importDashboardJson(dashboard);
  };

  getGcomDashboard = (formData: { gcomDashboard: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'gcom',
    });

    let dashboardId;
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    }

    if (dashboardId) {
      this.props.fetchGcomDashboard(dashboardId);
    }
  };

  renderImportForm() {
    const styles = importStyles(this.props.theme);

    // BMC code: comment below block
    // const GcomDashboardsLink = () => (
    //   // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    //   <TextLink variant="bodySmall" href="https://grafana.com/grafana/dashboards/" external>
    //     grafana.com/dashboards
    //   </TextLink>
    // );

    return (
      <>
        {/* BMC code */}
        <div className={styles.option}>
          {/* BMC Code: Use custom file dropzone */}
          {/* <FileDropzone
            options={{ multiple: false, accept: ['.json', '.txt'] }}
            readAs="readAsText"
            fileListRenderer={this.fileListRenderer}
            onLoad={this.onFileUpload}
          >
            <FileDropzoneDefaultChildren
              primaryText={t('dashboard-import.file-dropzone.primary-text', 'Upload dashboard JSON file')}
              secondaryText={t(
                'dashboard-import.file-dropzone.secondary-text',
                'Drag and drop here or click to browse'
              )}
            />
          </FileDropzone> */}

          <FileDropzoneWrapper
            onFileUpload={this.onFileUpload}
            fetchDashboards={this.props.fetchDashboards}
            dashboardLoaded={this.props.dashboardLoaded}
            clearLoadedDashboard={this.props.clearLoadedDashboard}
            fileListRenderer={this.fileListRenderer}
          />
        </div>
        {/* <div className={styles.option}>
          <Form onSubmit={this.getGcomDashboard} defaultValues={{ gcomDashboard: '' }}>
            {({ register, errors }) => (
              <Field
                label={
                  <Label className={styles.labelWithLink} htmlFor="url-input">
                    <span>
                      <Trans i18nKey="dashboard-import.gcom-field.label">
                        Find and import dashboards for common applications at <GcomDashboardsLink />
                      </Trans>
                    </span>
                  </Label>
                }
                invalid={!!errors.gcomDashboard}
                error={errors.gcomDashboard && errors.gcomDashboard.message}
              >
                <Input
                  id="url-input"
                  placeholder={t('dashboard-import.gcom-field.placeholder', 'Grafana.com dashboard URL or ID')}
                  type="text"
                  {...register('gcomDashboard', {
                    required: t(
                      'dashboard-import.gcom-field.validation-required',
                      'A Grafana dashboard URL or ID is required'
                    ),
                    validate: validateGcomDashboard,
                  })}
                  addonAfter={
                    <Button type="submit">
                      <Trans i18nKey="dashboard-import.gcom-field.load-button">Load</Trans>
                    </Button>
                  }
                />
              </Field>
            )}
          </Form>
        </div> */}
        {/* End */}
        <div className={styles.option}>
          <Form onSubmit={this.getDashboardFromJson} defaultValues={{ dashboardJson: '' }}>
            {({ register, errors }) => (
              <>
                <Field
                  label={t('dashboard-import.json-field.label', 'Import via dashboard JSON model')}
                  invalid={!!errors.dashboardJson}
                  error={errors.dashboardJson && errors.dashboardJson.message}
                >
                  <TextArea
                    {...register('dashboardJson', {
                      required: t('dashboard-import.json-field.validation-required', 'Need a dashboard JSON model'),
                      validate: validateDashboardJson,
                    })}
                    data-testid={selectors.components.DashboardImportPage.textarea}
                    id="dashboard-json-textarea"
                    rows={10}
                    placeholder={JSON_PLACEHOLDER}
                  />
                </Field>
                <Stack>
                  <Button type="submit" data-testid={selectors.components.DashboardImportPage.submit}>
                    <Trans i18nKey="dashboard-import.form-actions.load">Load</Trans>
                  </Button>
                  <LinkButton variant="secondary" href={`${config.appSubUrl}/dashboards`}>
                    <Trans i18nKey="dashboard-import.form-actions.cancel">Cancel</Trans>
                  </LinkButton>
                </Stack>
              </>
            )}
          </Form>
        </div>
      </>
    );
  }

  pageNav: NavModelItem = {
    text: t('manage-dashboards.unthemed-dashboard-import.text.import-dashboard', 'Import dashboard'),
    // BMC code: start
    // subTitle: t(
    //   'manage-dashboards.unthemed-dashboard-import.subTitle.import-dashboard-from-file-or-grafanacom',
    //   'Import dashboard from file or Grafana.com'
    // ),
    subTitle: t('bmc.dashboard-import.sub-title', 'Import dashboard from file or via dashboard json'),
    // BMC code end
  };

  getDashboardOverview() {
    // BMC code - added isMultiple, clearLoadedDashboard
    const { loadingState, dashboard, isMultiple, clearLoadedDashboard } = this.props;

    // BMC code - modified below conditions
    if (loadingState === LoadingState.Done && !isMultiple) {
      if (dashboard.elements || dashboard.spec?.elements) {
        return <ImportDashboardOverviewV2 />;
      }
      return <ImportDashboardOverview />;
    } else if (loadingState === LoadingState.Done && isMultiple) {
      return <Import clearLoadedDashboard={clearLoadedDashboard} />;
    }
    return null;
  }

  render() {
    const { loadingState } = this.props;

    return (
      // BMC code
      <ImportOperationProvider initialState={{ ...iDashboardsState }}>
        <Page navId="dashboards/browse" pageNav={this.pageNav}>
          <Page.Contents>
            {loadingState === LoadingState.Loading && (
              <Stack direction={'column'} justifyContent="center">
                <Stack justifyContent="center">
                  <Spinner size="xxl" />
                </Stack>
              </Stack>
            )}
            {[LoadingState.Error, LoadingState.NotStarted].includes(loadingState) && this.renderImportForm()}
            {this.getDashboardOverview()}
          </Page.Contents>
        </Page>
      </ImportOperationProvider>
    );
  }
}

const DashboardImportUnConnected = withTheme2(UnthemedDashboardImport);
const DashboardImport = connector(DashboardImportUnConnected);
DashboardImport.displayName = 'DashboardImport';
export default DashboardImport;

const importStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    option: css({
      marginBottom: theme.spacing(4),
      maxWidth: '600px',
    }),
    labelWithLink: css({
      maxWidth: '100%',
    }),
    linkWithinLabel: css({
      fontSize: 'inherit',
    }),
  };
});

// BMC Code: Below file
const FileDropzoneWrapper: React.FC<any> = ({
  onFileUpload,
  fetchDashboards,
  dashboardLoaded,
  clearLoadedDashboard,
  fileListRenderer,
}) => {
  const importOperations = useImportOperations();
  const primaryText = t('bmc.manage-dashboards.upload-json', 'Upload dashboard JSON file(s)');
  const secondaryText = t('bmc.manage-dashboards.drop-click', 'Drag and drop here or click to browse');
  return (
    <>
      <FileDropzone
        options={{
          multiple: true,
          accept: ['.json', '.txt'],
          maxFiles: bulkLimit,
          onDrop: async (files: any) => {
            await importOperations.clearAllDashboard();
            if (!files || !files.length) {
              return;
            }
            if (files.length === 1) {
              const reader = new FileReader();
              reader.readAsText(files[0]);
              reader.onload = () => {
                onFileUpload(reader.result as string);
              };
            } else {
              fetchDashboards();
              const readFile = async (file: any) => {
                return new Promise((res, rej) => {
                  const reader = new FileReader();
                  reader.onabort = rej;
                  reader.onload = () => {
                    try {
                      const dashboard = JSON.parse(reader.result as string);
                      importOperations.importDashboardJson(file.id, dashboard);
                      res(true);
                    } catch (error) {
                      rej(error);
                    }
                  };
                  reader.onerror = rej;
                  reader.readAsText(file.file);
                });
              };
              return await Promise.all(
                new Array(files.length).fill(null).map((_, index) => {
                  return readFile({
                    id: getFileName(files[index].name),
                    file: files[index],
                    error: null,
                  }).catch((error) => {
                    const failureTitle = t(
                      'bmc.manage-dashboards.serialization-failed',
                      'JSON -> JS Serialization failed'
                    );
                    appEvents.emit(AppEvents.alertError, [getImportFailedLabel(), `${failureTitle}: ${error.message}`]);
                  });
                })
              )
                .then((results) => {
                  if (results.find((res) => res)) {
                    dashboardLoaded();
                  } else {
                    clearLoadedDashboard();
                  }
                })
                .catch((err) => {
                  appEvents.emit(AppEvents.alertError, [getImportFailedLabel(), err.message]);
                  clearLoadedDashboard();
                });
            }
          },
        }}
        readAs="readAsText"
        fileListRenderer={fileListRenderer}
      >
        <FileDropzoneDefaultChildren primaryText={primaryText} secondaryText={secondaryText} />
      </FileDropzone>
    </>
  );
};

const getFileName = (fileName: string) => {
  const delimiter = fileName.lastIndexOf('.');
  return fileName.substring(0, delimiter);
};
