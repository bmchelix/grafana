import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, CollapsableSection, Modal, Stack, stylesFactory, useTheme, useTheme2 } from '@grafana/ui';
import { exportDashboards as _exportDashboards } from 'app/features/manage-dashboards/state/actions';

import { OnMoveOrDeleleSelectedItems } from '../../types';

interface Props {
  onExportDone: OnMoveOrDeleleSelectedItems;
  results: string[];
  isOpen: boolean;
  onDismiss: () => void;
}

export const ConfirmExportModal: FC<Props> = ({ onExportDone, results, isOpen, onDismiss }) => {
  const theme = useTheme();
  const theme2 = useTheme2();
  const styles = getStyles(theme, theme2);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const dashboards = results;
  const dashCount = dashboards.length;
  const bulkExportLimit = (config.bootData.settings as any).bulkExportLimit ?? 100;
  const bulkExportLimitMsg = `Select upto ${bulkExportLimit} dashboards only`;
  const isExportable = dashCount <= bulkExportLimit;
  const [isExportDone, setIsExportDone] = React.useState(false);
  let [failedExport, setFailedExport] = React.useState(['']);
  let i = 0;

  let text = t('bmc.search.comfirm-export', 'Do you want to export the {{dashCount}} selected dashboard(s)?', {
    dashCount,
  });

  const exportDashboards = () => {
    setIsDownloading(true);
    _exportDashboards({
      dashUids: dashboards,
    })
      .then((result) => {
        if (result != null) {
          setFailedExport(result);
          setIsExportDone(true);
        } else {
          setFailedExport([]);
          setIsExportDone(true);
        }
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  return isOpen ? (
    !isExportDone ? (
      <Modal className={styles.modal} title={t('bmc.search.export', 'Export')} isOpen={isOpen} onDismiss={onDismiss}>
        {isExportable ? (
          <>
            <div className={styles.content}>{text}</div>

            <Stack direction="row" justifyContent="center" gap={2}>
              <Button
                icon={isDownloading ? 'fa fa-spinner' : undefined}
                disabled={isDownloading}
                variant="primary"
                onClick={exportDashboards}
              >
                <Trans i18nKey="bmc.search.export">Export</Trans>
              </Button>
              <Button variant="secondary" onClick={onDismiss}>
                <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
              </Button>
            </Stack>
          </>
        ) : (
          <div className={styles.content}>{bulkExportLimitMsg}</div>
        )}
      </Modal>
    ) : (
      <Modal
        className={styles.modalExportStatus}
        title={t('bmc.search.export-status', 'Export Status')}
        isOpen={isExportDone}
        closeOnBackdropClick={false}
        onDismiss={() => {
          onExportDone();
          onDismiss();
        }}
      >
        <>
          <div className={styles.contentExportStatus}>
            {/* BMC change */}
            <Trans i18nKey="bmc.export.successful">Export Successfull:</Trans>{' '}
            <span className={styles.exportSuccess}>{dashCount - failedExport.length}</span>
          </div>
          <div className={styles.contentExportStatus}>
            {/* BMC change */}
            <Trans i18nKey="bmc.export.fail">Export Failed:</Trans>{' '}
            <span className={styles.exportFailed}>{failedExport.length}</span>
          </div>
          {failedExport.length === 0 ? null : (
            <CollapsableSection
              label={t('bmc.export.failed-dashboards', 'Failed Dashboards')}
              isOpen={false}
              className={styles.collapseExport}
            >
              {failedExport.map(function (each: string) {
                i++;
                return (
                  <p key={each}>
                    {i}. {each}
                  </p>
                );
              })}
            </CollapsableSection>
          )}
        </>
      </Modal>
    )
  ) : null;
};

const getStyles = stylesFactory((theme: GrafanaTheme, theme2: GrafanaTheme2) => {
  return {
    modal: css({
      width: 500,
    }),
    content: css({
      marginBottom: theme.spacing.lg,
      fontSize: 16,
    }),
    contentExportStatus: css({
      marginBottom: 20,
      fontSize: 15,
    }),
    modalExportStatus: css({
      width: 500,
    }),
    collapseExport: css({
      fontSize: 15,
      padding: 0,
    }),
    exportSuccess: css({
      color: theme2.colors.success.main,
    }),
    exportFailed: css({
      color: theme2.colors.error.main,
    }),
  };
});
