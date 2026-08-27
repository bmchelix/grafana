import { t } from '@grafana/i18n';
import { BMCUsersState } from 'app/types/rbac-users';

export const getUsersSearchQuery = (state: BMCUsersState) => state.searchQuery;

export const getUserFilters = () => {
  return {
    all: { label: t('bmc.rbac.common.all', 'All'), value: 'All' },
    assigned: { label: t('bmc.rbac.common.assigned', 'Assigned'), value: 'Assigned' },
  };
};
