import { memo, useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { DSElevationConfigResponse, getDSElevationConfig } from './api';

export const ElevatedAccessTopBarButton = memo(function ElevatedAccessTopBarButton() {
  const [status, setStatus] = useState<DSElevationConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDSElevationConfig()
      .then((data) => {
        if (!cancelled) {
          setStatus(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ visible: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tooltip = useMemo(() => {
    // Only elevated-group members ever see the logo; owners never do.
    if (!status?.visible) {
      return '';
    }

    return t('bmc.ds-elevation.navbar.member-tooltip', 'You are using elevated access');
  }, [status]);

  if (!status?.visible) {
    return null;
  }

  return (
    <ToolbarButton
      iconOnly
      icon="users-alt"
      aria-label={tooltip}
      tooltip={tooltip}
      id="elevated-access-top-bar-button"
    />
  );
});
