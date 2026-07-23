import { t } from '@grafana/i18n';
import { BMCTeamsState } from 'app/types/rbac-teams';

export const getTeamsSearchQuery = (state: BMCTeamsState) => state.searchQuery;

export const getTeamFilters = () => {
  return {
    all: { label: t('bmc.rbac.common.all', 'All'), value: 'All' },
    assigned: { label: t('bmc.rbac.common.assigned', 'Assigned'), value: 'Assigned' },
  };
};
