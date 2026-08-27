import { css } from '@emotion/css';
import { FC, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Drawer, useStyles2 } from '@grafana/ui';
import { BMCRole } from 'app/types/rbac-roles';

import { loadRoleDetails } from '../roles/state/actions';

import { PermissionResourceGroupList } from './PermissionResourceGroupList';
import { translatePermissions } from './permission-translations';
import { getPermissions, updatePermissions } from './state/apis';
import { Permission } from './state/types';

type Props = {
  role: BMCRole;
  onDismiss: () => void;
};

export const PermissionListDrawer: FC<Props> = ({ onDismiss, role }) => {
  const styles = useStyles2(getDrawerContentStyles);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleDetails, setRoleDetails] = useState<BMCRole | undefined>(role);

  const load = () => {
    Promise.all([
      getPermissions(role.id!).then((perms: Permission[]) => {
        const permsWithTranslations = translatePermissions(perms);
        setPermissions(permsWithTranslations);
      }),
      !role.name && loadRoleDetails(role.id!).then(setRoleDetails),
    ]);
  };

  const update = () => {
    updatePermissions(roleDetails, permissions).then(onDismiss);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  return (
    <Drawer
      title={
        roleDetails
          ? t('bmc.rbac.permissions.drawer-title', '{{name}} - Permissions', { name: roleDetails.name })
          : t('bmc.common.loading', 'Loading...')
      }
      onClose={onDismiss}
      closeOnMaskClick={false}
      width={'40%'}
      subtitle={t('bmc.rbac.permissions.subtitle', 'List of permissions')}
      expandable
      scrollableContent={false}
    >
      {roleDetails ? (
        <div className={styles.wrapper}>
          <div className={styles.scrollArea}>
            <PermissionResourceGroupList
              permissions={permissions}
              canEdit={!roleDetails.systemRole}
              onChange={(name, status) => {
                const index = permissions.findIndex((p) => p.name === name);
                if (index === -1) {
                  return;
                }
                const perms = [...permissions];
                perms[index].status = status;
                setPermissions(perms);
              }}
            />
          </div>
          <div className={styles.buttonRow}>
            <Button
              size="md"
              style={{ marginRight: '15px' }}
              variant={'primary'}
              fill="solid"
              onClick={update}
              disabled={role.systemRole}
            >
              <Trans i18nKey="bmc.common.save">Save</Trans>
            </Button>
            <Button size="md" variant="secondary" fill="solid" onClick={onDismiss}>
              <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
            </Button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
};

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
