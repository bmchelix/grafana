import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

export function getAddToDashboardTitle(): string {
  const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const canWriteDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

  if (canCreateDashboard && !canWriteDashboard) {
    // BMC Change: Next line
    return t('bmcgrafana.explore.to-dashboard.to-new-dashboard-title', 'Add panel to new dashboard');
  }

  if (canWriteDashboard && !canCreateDashboard) {
    // BMC Change: Next line
    return t('bmcgrafana.explore.to-dashboard.to-existing-dashboard-title', 'Add panel to existing dashboard');
  }

  // BMC Change: Next line
  return t('bmcgrafana.explore.to-dashboard.panel-to-dashboard', 'Add panel to dashboard');
}
