import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Drawer, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { BMCRole } from 'app/types/rbac-roles';
import { StoreState } from 'app/types/store';

import { UsersActionBar } from './UsersActionBar';
import { UsersTable } from './UsersTable';
import { checkStatusChanged, clearState, loadUsers, postUsers, selectAllStatusChanged } from './state/actions';
import { getUsersSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getUsersSearchQuery(state.rbacUsers);
  return {
    users: state.rbacUsers.users,
    searchQuery: searchQuery,
    selectedCount: state.rbacUsers.selectedCount,
    perPage: state.rbacUsers.perPage,
    isLoading: state.rbacUsers.isLoading,
    usersAdded: state.rbacUsers.usersAdded,
    usersRemoved: state.rbacUsers.usersRemoved,
  };
}

const mapDispatchToProps = {
  loadUsers,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = { role: BMCRole; onDismiss: () => void } & ConnectedProps<typeof connector>;

export const UsersListPageContent = ({
  users,
  selectedCount,
  isLoading,
  usersAdded,
  usersRemoved,
  loadUsers,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
  role,
  onDismiss,
}: Props): JSX.Element => {
  useEffect(() => {
    loadUsers(role.id!);
  }, [loadUsers, role.id]);

  // const pageRef = React.useRef<HTMLDivElement>(null);
  // const actionBarRef = React.useRef<HTMLDivElement>(null);
  // const actionBtnRef = React.useRef<HTMLDivElement>(null);

  const [submitted, setSubmitted] = useState<boolean>(false);

  const renderTable = () => {
    return users?.length ? (
      <UsersTable
        users={users}
        roleId={role.id!}
        onUserCheckboxChange={checkStatusChanged}
        onSelectAllChange={selectAllStatusChanged}
      />
    ) : (
      <div
        className={css({
          textAlign: 'center',
        })}
      >
        <Trans i18nKey="bmc.rbac.users.none-found">No users found</Trans>
      </div>
    );
  };

  const submitUsers = () => {
    setSubmitted(true);
    postUsers(role.id!, usersAdded, usersRemoved)
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
      <UsersActionBar roleId={role.id!} selectedCount={selectedCount} />
      <div className={styles.scrollArea}>
        <Page.Contents isLoading={isLoading}>{!isLoading && renderTable()}</Page.Contents>
      </div>
      {users?.length ? (
        <div className={styles.buttonRow}>
          <Button
            size="md"
            style={{ marginRight: '15px' }}
            variant={'primary'}
            fill="solid"
            icon={submitted ? 'fa fa-spinner' : undefined}
            onClick={submitUsers}
            disabled={submitted || (!usersAdded.length && !usersRemoved.length)}
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

const UserListDrawerUnconnected = (props: Props) => {
  const selectedCountText =
    props.selectedCount === undefined
      ? t('bmc.common.loading', 'Loading...')
      : props.selectedCount === 0
        ? t('bmc.rbac.users.none-assigned', 'No users assigned')
        : t('bmc.rbac.users.assigned-count', '{{count}} user assigned', { count: props.selectedCount });

  return (
    <Drawer
      title={t('bmc.rbac.users.drawer-title', '{{roleName}} - Users', { roleName: props.role.name })}
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
      <UsersListPageContent {...props} />
    </Drawer>
  );
};

export const UserListDrawer = connector(UserListDrawerUnconnected);

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
