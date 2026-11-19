import { css } from '@emotion/css';
import React, { FC, useState } from 'react';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Checkbox, Icon, Tooltip } from '@grafana/ui';

// import { orderActions, orderPermissions } from './state/helpers';
import { getPermissionsGroup } from './permission-translations';
import { orderPermissions } from './state/helpers';
import { Permission } from './state/types';

type Props = {
  group: string;
  permissions: Permission[];
  onChange: (name: string, status: boolean) => void;
  canEdit: boolean;
};

export const PermissionResourceGroup: FC<Props> = ({ group, permissions, canEdit, onChange }) => {
  // Cache the open state of resource in local storage
  const [open, setOpen] = useState<boolean>(() => {
    return store.get(`bhd.role.permissions:${group}`) === 'true';
  });

  const toggle = () => {
    store.set(`bhd.role.permissions:${group}`, `${!open}`);
    setOpen(!open);
  };

  const ordered = orderPermissions(permissions);
  const isReportsAccessEnabled = ordered.find((perm) => perm.name === 'reports:access')?.status;

  const permissionsList = ordered.map((perm) => {
    if (group === 'Reports' && perm.name !== 'reports:access') {
      perm.isDefault = !isReportsAccessEnabled;
      perm.status = !isReportsAccessEnabled ? false : perm.status;
    }

    return perm;
  });

  if (group === 'Service management query types') {
    // Enable SQL permission checkbox only when SQL is disabled by Admin in default preferences
    canEdit = canEdit && !(config.bootData.settings as any).enabledQueryTypes.enabledTypes.includes('SQL');
  }

  return (
    <div>
      <div
        className={css({
          display: 'flex',
          padding: 10,
          cursor: 'pointer',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: config.theme2.isDark ? '#f3f3f30d' : '#f3f3f3',
          margin: '8px 0',
        })}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
          })}
        >
          <Checkbox
            disabled={!canEdit}
            checked={permissions.every((p) => p.status)}
            onChange={(e: React.FormEvent<HTMLInputElement>) => {
              permissions.forEach((p) => {
                if (!p.isDefault) {
                  onChange(p.name, e.currentTarget.checked);
                }
              });
            }}
          />
          <div
            className={css({
              marginLeft: 8,
            })}
          >
            {getPermissionsGroup(group)}
          </div>
        </div>
        <Icon name={open ? 'angle-up' : 'angle-down'} size="md" />
      </div>
      {open && (
        <div
          className={css({
            display: 'flex',
            gap: 6,
            flexDirection: 'column',
            paddingLeft: 10,
            paddingBottom: 10,
          })}
        >
          {permissionsList.map((permission) => {
            const { name, status, description, displayName, isDefault } = permission;

            return (
              <div
                key={`${group}_${name}`}
                className={css({
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                })}
              >
                <Checkbox
                  label={displayName}
                  disabled={isDefault || !canEdit}
                  checked={status}
                  onChange={(e: React.FormEvent<HTMLInputElement>) => {
                    onChange(name, e.currentTarget.checked);
                  }}
                />
                <Tooltip content={description}>
                  <Icon name="info-circle" size="md" />
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
