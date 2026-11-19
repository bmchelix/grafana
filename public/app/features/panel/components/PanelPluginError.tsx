// Libraries
import { memo, ReactNode } from 'react';

// Types
import { PanelPlugin, PanelPluginMeta, PanelProps, PluginType } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import appleTouchIconPng from 'img/apple-touch-icon.png';

interface Props {
  title: string;
  text?: ReactNode;
}

const PanelPluginError = memo<Props>(({ title, text }) => {
  const style = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  };

  return (
    <div style={style}>
      <Alert severity={AppNotificationSeverity.Error} title={title}>
        {text}
      </Alert>
    </div>
  );
});

PanelPluginError.displayName = 'PanelPluginError';

export function getPanelPluginLoadError(meta: PanelPluginMeta, err: unknown): PanelPlugin {
  const LoadError = memo<PanelProps>(() => {
    const text = (
      <Trans i18nKey="panel.panel-plugin-error.text-load-error">
        Check the server startup logs for more information. <br />
        If this plugin was loaded from Git, then make sure it was compiled.
      </Trans>
    );
    return (
      <PanelPluginError
        title={t('panel.panel-plugin-error.title-load-error', 'Error loading: {{panelId}}', { panelId: meta.id })}
        text={text}
      />
    );
  });
  LoadError.displayName = 'LoadError';
  const plugin = new PanelPlugin(LoadError);
  plugin.meta = meta;
  plugin.loadError = true;
  return plugin;
}

export function getPanelPluginNotFound(id: string, silent?: boolean): PanelPlugin {
  const NotFound = memo<PanelProps>(() => {
    return (
      <PanelPluginError
        title={t('panel.panel-plugin-error.title-not-found', 'Panel plugin not found: {{id}}', { id })}
      />
    );
  });
  NotFound.displayName = 'NotFound';

  const plugin = new PanelPlugin(silent ? () => null : NotFound);

  plugin.meta = {
    id: id,
    name: id,
    sort: 100,
    type: PluginType.panel,
    module: '',
    baseUrl: '',
    info: {
      author: {
        name: '',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        // BMC Code - Icon change
        small: appleTouchIconPng,
      },
      screenshots: [],
      updated: '',
      version: '',
    },
  };
  return plugin;
}
