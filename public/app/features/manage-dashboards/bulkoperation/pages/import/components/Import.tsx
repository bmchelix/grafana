import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Icon, Label, Legend, Modal, Spinner, useStyles2, useTheme2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';

import { testIds } from '../../testIds';
import { initialImportStatus, useImportOperations } from '../state/actions';

import { DashboardsOverview } from './DashboardsOverview';

export const bulkLimit = (config.bootData.settings as any).bulkLimit ?? 10;

export const Import: React.FC<any> = ({ clearLoadedDashboard }) => {
  const [progressLevel, setProgressLevel] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [isModalOpen, setModalToggle] = React.useState<boolean>(false);
  const [importStatus, setImportStatus] = React.useState<any>({
    ...initialImportStatus,
  });
  const importOperations = useImportOperations();
  const s = useStyles2(getStyles);

  const clearComponent = React.useMemo(() => {
    return () => {
      setImportStatus({ ...initialImportStatus });
      clearLoadedDashboard();
      importOperations.clearAllDashboard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importOperations]);

  const importAll = React.useMemo(() => {
    return () => {
      setModalToggle(true);
      importOperations
        .importAllDashboard(setProgressLevel)
        .then((result: any) => {
          setModalToggle(true);
          setImportStatus({ ...importStatus, importAllDone: true, ...result });
        })
        .catch((err: Error) => {
          clearComponent();
          notifyApp(
            createErrorNotification(
              `${t('bmc.bulk-operations.import.import-all-failed', 'Import all dashboard failed')} - ${err.message}`
            )
          );
        })
        .finally(() => {
          importOperations.clearAllDashboard();
          setLoading(false);
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importOperations, setLoading, clearComponent]);

  return (
    <>
      {loading ? (
        <>
          <Spinner className={cx(s.spinner)} />
        </>
      ) : (
        <>
          {!isModalOpen ? (
            <div>
              <div className={s.marginBottom}>
                <ImportButtonGroup
                  clearComponent={clearComponent}
                  importDisabled={importOperations.isImportDisabled()}
                  importAll={importAll}
                />
              </div>
              <div data-testid={testIds.import.container} className={s.container}>
                <div className={cx(s.wrapper)}>
                  <DashboardsOverview importOperations={importOperations} />
                </div>
              </div>
            </div>
          ) : null}
          <ResultModal
            totalCount={importStatus.total}
            successImport={importStatus.success}
            failedImport={importStatus.failed}
            importAllDone={importStatus.importAllDone}
            isOpen={isModalOpen}
            closeModal={() => {
              setModalToggle(false);
              clearComponent();
              if (importStatus.importAllDone) {
                window.location.href = window.location.origin + config.appSubUrl;
              }
            }}
            progressLevel={progressLevel}
          />
        </>
      )}
    </>
  );
};

const ImportButtonGroup: React.FC<any> = ({ clearComponent, importDisabled, importAll }) => {
  const s = getStyles(useTheme2());
  return (
    <div className={s.flexJustify}>
      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
        <Legend style={{ marginBottom: '0px' }}>
          <Trans i18nKey="bmc.bulk-operations.options">Options</Trans>
        </Legend>
        <Label className={s.disclaimerLabel}>
          {t('bmc.bulk-operations.set-parameters', 'set required parameters for the selected dashboards')}
        </Label>
      </div>
      <div className={s.horizontalGroup}>
        <Button
          type="reset"
          variant="secondary"
          onClick={() => {
            clearComponent();
          }}
          style={{ marginRight: '10px' }}
        >
          <Trans i18nKey="bmc.bulk-operations.cancel">Cancel</Trans>
        </Button>
        <Button
          type="submit"
          data-testid={testIds.import.importButton}
          variant={'primary'}
          onClick={() => {
            importAll();
          }}
          disabled={importDisabled}
        >
          {t('bmc.bulk-operations.import-all', 'Import all')}
        </Button>
      </div>
    </div>
  );
};

const ResultModal: React.FC<any> = ({
  importAllDone,
  totalCount,
  successImport,
  failedImport,
  isOpen,
  closeModal,
  progressLevel,
}) => {
  const s = getStyles(useTheme2());
  const allSuccess = totalCount === successImport.length;
  return (
    <Modal
      title={''}
      isOpen={isOpen}
      onDismiss={closeModal}
      trapFocus
      className={cx(s.modal)}
      contentClassName={cx(s.modalContent)}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <div className={cx(s.modalBody)}>
        {!importAllDone ? (
          <ProgressBar progress={progressLevel} />
        ) : (
          <>
            <Icon
              size="xxl"
              name={`${allSuccess ? 'check-circle' : 'exclamation-triangle'}`}
              style={{ color: `${allSuccess ? 'green' : 'orange'}` }}
            />
            <Label style={{ fontSize: '16px', marginTop: '10px' }}>
              {allSuccess
                ? t('bmc.bulk-operations.import-success', 'All dashboards are successfully imported')
                : t('bmc.bulk-operations.import-failed', 'Failed to import the following dashboards')}
            </Label>
            <div className={cx(s.failedList)}>
              {!allSuccess
                ? failedImport?.map((fileName: string, index: number) => {
                    return (
                      <Label key={`failedImport-${index}`}>
                        {`${index + 1}) `} {`${fileName}.json`}
                      </Label>
                    );
                  })
                : null}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

const ProgressBar: React.FC<any> = ({ progress }) => {
  const s = getStyles(useTheme2(), { progress: progress });

  const progresstext = {
    padding: 10,
    color: 'black',
    fontWeight: 500,
  };

  return (
    <div className={cx(s.pbParent)}>
      <div className={cx(s.pbChild)}>
        <span style={progresstext}>{`${progress}%`}</span>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, options?: any) => ({
  container: css({
    position: 'relative',
    minHeight: 'calc(100vh - 320px)',
  }),
  wrapper: css({
    maxHeight: 'calc(100vh - 330px)',
    marginBottom: 10,
    overflow: 'auto',
  }),
  spinner: css({
    height: '30vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  flexEnd: css({
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-end',
  }),
  flexJustify: css({
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  }),
  marginBottom: css({
    marginBottom: theme.spacing(2),
  }),
  marginLeft: css({
    marginLeft: theme.spacing(1.5),
  }),
  marginRight: css({
    marginRight: theme.spacing(2),
  }),
  disclaimerLabel: css({
    display: 'flex',
    color: 'rgba(36, 41, 46, 0.75)',
    fontSize: 12,
    fontStyle: 'italic',
  }),
  horizontalGroup: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 0,
  }),
  modal: css({
    width: 500,
  }),
  modalBody: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }),
  failedList: css({
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'start',
    marginTop: 10,
  }),
  modalContent: css({
    paddingTop: 0,
  }),
  pbParent: css({
    height: 20,
    width: '100%',
    backgroundColor: 'whitesmoke',
    borderRadius: theme.shape.radius.pill,
    display: 'flex',
  }),
  pbChild: css({
    height: '100%',
    width: `${options?.progress}%`,
    backgroundImage: 'linear-gradient(90deg, rgb(255, 136, 51) 0%, rgb(245, 62, 76) 100%)',
    borderRadius: theme.shape.radius.pill,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'end',
    justifyContent: 'center',
  }),
});
