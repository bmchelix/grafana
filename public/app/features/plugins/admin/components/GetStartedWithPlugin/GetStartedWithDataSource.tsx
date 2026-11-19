import * as React from 'react';
import { useCallback } from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { ROUTES } from 'app/features/connections/constants';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { addDataSource } from 'app/features/datasources/state/actions';
import { useDispatch } from 'app/types/store';

import { isDataSourceEditor, isGrafanaAdmin } from '../../permissions';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement | null {
  const dispatch = useDispatch();
  const onAddDataSource = useCallback(() => {
    const meta = {
      name: plugin.name,
      id: plugin.id,
    } as DataSourcePluginMeta;

    dispatch(addDataSource(meta, ROUTES.DataSourcesEdit));
  }, [dispatch, plugin]);

  if (!isDataSourceEditor()) {
    return null;
  }

  // BMC code - next line
  const canCreateDataSource = getFeatureStatus(FEATURE_CONST.DASHBOARDS_SSRF_FEATURE_NAME) || isGrafanaAdmin();
  const disabledButton = config.pluginAdminExternalManageEnabled && !plugin.isFullyInstalled;

  return (
    <Button
      variant="primary"
      onClick={onAddDataSource}
      // BMC Code: Next Inline
      disabled={disabledButton || !canCreateDataSource}
      title={
        disabledButton
          ? t(
              'plugins.get-started-with-data-source.title-button-disabled',
              "The plugin isn't usable yet, it may take some time to complete the installation."
            )
          : undefined
      }
    >
      <Trans i18nKey="plugins.get-started-with-data-source.add-new-data-source">Add new data source</Trans>
    </Button>
  );
}
