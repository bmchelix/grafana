import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Field, FieldSet, Form, Input } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { BMCRole, BMCRoleDetailsResponse } from 'app/types/rbac-roles';

import { createRole, loadRoleDetails, updateRole } from './state/actions';

type ManageRoleParams = {
  action?: string;
  id?: string;
};

export enum RolesAction {
  new = 'new',
  edit = 'edit',
}

interface Props extends GrafanaRouteComponentProps<ManageRoleParams> {}

const getPageNav = (): NavModelItem[] => [
  {
    icon: 'users-alt',
    id: 'role-new',
    text: t('bmc.rbac.roles.new', 'New role'),
    subTitle: 'Create a new role. Roles let you grant combination of permissions to users and teams.',
  },
  {
    icon: 'users-alt',
    id: 'role-edit',
    text: t('bmc.rbac.roles.edit', 'Edit role'),
  },
];

export const ManageRole = (p: Props): JSX.Element => {
  const params = useParams<ManageRoleParams>();
  const pN = params.action === RolesAction.new ? getPageNav()[0] : getPageNav()[1];

  return (
    <Page navId="roles" pageNav={pN}>
      <Page.Contents>
        <ManageRoleComp action={params.action} id={params.id} />
      </Page.Contents>
    </Page>
  );
};

const ManageRoleComp: React.FC<ManageRoleParams> = ({ action, id }: ManageRoleParams) => {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [roleDetails, setRoleDetails] = useState<BMCRoleDetailsResponse | undefined>(undefined);
  useEffect(() => {
    if (id) {
      fetchRoleDetails(+id);
    }
  }, [id]);

  const fetchRoleDetails = async (id: number) => {
    const roleDetails = await loadRoleDetails(id);
    if (roleDetails) {
      setRoleDetails(roleDetails);
    }
  };

  const manageRole = async (formModel: BMCRole) => {
    setSubmitted(true);
    try {
      const payload: BMCRole = { name: formModel.name, description: formModel.description };
      if (action === RolesAction.edit) {
        await updateRole(+id!, payload);
        setSubmitted(false);
        locationService.push(`/org/roles`);
      } else {
        payload.systemRole = false;
        const response = await createRole(payload);
        setSubmitted(false);
        locationService.push(`/org/roles?roleId=${response.bhdRoleId}`);
      }
    } catch (e) {
      console.log(e);
      setSubmitted(false);
    } finally {
    }
  };

  const cancel = () => {
    locationService.push(`/org/roles`);
  };

  if (action === RolesAction.edit && !roleDetails?.name) {
    return <Trans i18nKey="bmc.common.loading">Loading...</Trans>;
  }

  return (
    <Form
      onSubmit={manageRole}
      defaultValues={{ name: roleDetails?.name ?? '', description: roleDetails?.description ?? '' }}
    >
      {({ register, errors }) => (
        <FieldSet>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <Field
            label={t('bmc.rbac.common.name', 'Name')}
            required
            invalid={!!errors.name}
            error={t('bmc.rbac.roles.name-required', 'Role name is required')}
          >
            <Input {...register('name', { required: true })} id="role-name" />
          </Field>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <Field label={t('bmc.rbac.roles.description', 'Description')}>
            <Input {...register('description')} id="role-desc" />
          </Field>
          <div className="gf-form-button-row">
            <Button type="submit" variant="primary" icon={submitted ? 'fa fa-spinner' : undefined}>
              {id ? t('bmc.rbac.roles.update', 'Update') : t('bmc.rbac.roles.create', 'Create')}
            </Button>
            <Button variant="secondary" onClick={cancel}>
              <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
            </Button>
          </div>
        </FieldSet>
      )}
    </Form>
  );
};

export default ManageRole;
