import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';

import { isOrgAdmin } from '../plugins/admin/permissions';

// Who can see/manage the Elevated dashboard access (ELT) toggle.
// Dashboard admins always pass; other users need the "dashboard.elevated.access:access"
// BHD permission, granted through a role. Mirrors insight-finder's bhd-rbac-utils.
export const canManageElevatedDashboardAccess = (): boolean =>
  isOrgAdmin() || contextSrv.hasPermission(AccessControlAction.ElevatedDashboardAccessManage);
