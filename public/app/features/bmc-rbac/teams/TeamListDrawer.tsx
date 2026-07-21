import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Drawer, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { BMCRole } from 'app/types/rbac-roles';
import { StoreState } from 'app/types/store';

import { TeamsActionBar } from './TeamsActionBar';
import { TeamsTable } from './TeamsTable';
import { checkStatusChanged, clearState, loadTeams, postTeams, selectAllStatusChanged } from './state/actions';
import { getTeamsSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getTeamsSearchQuery(state.rbacTeams);
  return {
    teams: state.rbacTeams.teams,
    searchQuery: searchQuery,
    selectedCount: state.rbacTeams.selectedCount,
    perPage: state.rbacTeams.perPage,
    isLoading: state.rbacTeams.isLoading,
    teamsAdded: state.rbacTeams.teamsAdded,
    teamsRemoved: state.rbacTeams.teamsRemoved,
  };
}

const mapDispatchToProps = {
  loadTeams,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = { role: BMCRole; onDismiss: () => void } & ConnectedProps<typeof connector>;

export const TeamsListPageContent = ({
  teams,
  selectedCount,
  isLoading,
  teamsAdded,
  teamsRemoved,
  loadTeams,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
  role,
  onDismiss,
}: Props): JSX.Element => {
  useEffect(() => {
    loadTeams(role.id!);
  }, [loadTeams, role.id]);

  // const pageRef = React.useRef<HTMLDivElement>(null);
  // const actionBarRef = React.useRef<HTMLDivElement>(null);
  // const actionBtnRef = React.useRef<HTMLDivElement>(null);

  const [submitted, setSubmitted] = useState<boolean>(false);

  const renderTable = () => {
    return teams?.length ? (
      <TeamsTable
        teams={teams}
        roleId={role.id!}
        onTeamCheckboxChange={checkStatusChanged}
        onSelectAllChange={selectAllStatusChanged}
      />
    ) : (
      <div
        className={css({
          textAlign: 'center',
        })}
      >
        <Trans i18nKey="bmc.rbac.teams.none-found">No teams found</Trans>
      </div>
    );
  };

  const submitTeams = () => {
    setSubmitted(true);
    postTeams(role.id!, teamsAdded, teamsRemoved)
      .then((resp) => {
        clearState();
        onDismiss();
      })
      // TODO: catch errors
      .finally(() => {
        setSubmitted(false);
      });
  };

  const onClose = () => {
    clearState();
    onDismiss();
  };

  const styles = useStyles2(getDrawerContentStyles);

  return (
    <div className={styles.wrapper}>
      <TeamsActionBar roleId={role.id!} selectedCount={selectedCount} />
      <div className={styles.scrollArea}>
        <Page.Contents isLoading={isLoading}>{!isLoading && renderTable()}</Page.Contents>
      </div>
      {teams?.length ? (
        <div className={styles.buttonRow}>
          <Button
            size="md"
            style={{ marginRight: '15px' }}
            variant={'primary'}
            fill="solid"
            icon={submitted ? 'fa fa-spinner' : undefined}
            onClick={submitTeams}
            disabled={submitted || (!teamsAdded.length && !teamsRemoved.length)}
          >
            <Trans i18nKey="bmc.common.save">Save</Trans>
          </Button>
          <Button size="md" variant="secondary" fill="solid" onClick={onClose}>
            <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const TeamListDrawerUnconnected = (props: Props) => {
  const selectedCountText =
    props.selectedCount === undefined
      ? t('bmc.common.loading', 'Loading...')
      : props.selectedCount === 0
        ? t('bmc.rbac.teams.none-assigned', 'No teams assigned')
        : t('bmc.rbac.teams.assigned-count', '{{count}} team assigned', { count: props.selectedCount });

  return (
    <Drawer
      title={t('bmc.rbac.teams.drawer-title', '{{name}} - Teams', { name: props.role.name })}
      onClose={() => {
        props.clearState();
        props.onDismiss();
      }}
      closeOnMaskClick={false}
      width={'40%'}
      subtitle={selectedCountText}
      expandable
      scrollableContent={false}
    >
      <TeamsListPageContent {...props} />
    </Drawer>
  );
};

export const TeamListDrawer = connector(TeamListDrawerUnconnected);

const getDrawerContentStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  }),
  scrollArea: css({
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  }),
  buttonRow: css({
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
    paddingTop: theme.spacing(2),
  }),
});
