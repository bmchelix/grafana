import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { RoadmapLinks } from 'app/features/plugins/admin/components/RoadmapLinks';
import UpdateAllButton from 'app/features/plugins/admin/components/UpdateAllButton';
import UpdateAllModal from 'app/features/plugins/admin/components/UpdateAllModal';
import { useGetUpdatable } from 'app/features/plugins/admin/state/hooks';

import { AddNewConnection } from '../tabs/ConnectData/ConnectData';

const getStyles = (theme: GrafanaTheme2) => ({
  pageContainer: css({
    height: '100vh',
    overflow: 'hidden',
  }),
});

export function AddNewConnectionPage() {
  const { isLoading: areUpdatesLoading, updatablePlugins } = useGetUpdatable();
  const updatableDSPlugins = updatablePlugins.filter((plugin) => plugin.type === PluginType.datasource);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const disableUpdateAllButton = updatableDSPlugins.length <= 0 || areUpdatesLoading;
  const styles = useStyles2(getStyles);

  const onUpdateAll = () => {
    setShowUpdateModal(true);
  };

  const updateAllButton = (
    <UpdateAllButton
      disabled={disableUpdateAllButton}
      onUpdateAll={onUpdateAll}
      updatablePluginsLength={updatableDSPlugins.length}
    />
  );

  return (
    <Page
      navId={'connections-add-new-connection'}
      // BMC Change: Inline: disable update plugins button in non development mode
      actions={config.buildInfo.env === 'development' ? updateAllButton : undefined}
      className={styles.pageContainer}
    >
      <Page.Contents>
        <AddNewConnection />
        <RoadmapLinks />
        <UpdateAllModal
          isOpen={showUpdateModal}
          isLoading={areUpdatesLoading}
          onDismiss={() => setShowUpdateModal(false)}
          plugins={updatableDSPlugins}
        />
      </Page.Contents>
    </Page>
  );
}
