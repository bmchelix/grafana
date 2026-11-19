import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Tooltip, useTheme2 } from '@grafana/ui';
import iconSchedulerSvg from 'img/icon_scheduler.svg';

interface Props {
  uid?: string;
}

export const ManageScheduleButton = ({ uid }: Props) => {
  const theme = useTheme2();

  const handleNavigation = () => {
    sessionStorage.removeItem('reportFilter');
    locationService.push({
      search: locationService.getSearch().toString(),
      pathname: `/a/reports/f/${uid}`,
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleNavigation();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handleNavigation();
    }
  };

  return (
    <Tooltip content={t('bmc.dashboard.toolbar.manage-reports', 'Manage scheduled reports')}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px' }}
      >
        <img
          alt="Manage Reports"
          style={{
            width: '22px',
            filter: theme.isDark ? 'brightness(1.2)' : 'brightness(0.5)',
          }}
          src={iconSchedulerSvg}
        />
      </div>
    </Tooltip>
  );
};
