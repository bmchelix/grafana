import { useForm } from 'react-hook-form';
import { ConnectedProps, connect } from 'react-redux';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Team } from 'app/types/teams';

import { updateTeam } from './state/actions';

const mapDispatchToProps = {
  updateTeam,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  team: Team;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

export const TeamSettings = ({ team, updateTeam }: Props) => {
  const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
  const currentOrgId = contextSrv.user.orgId;

  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<Team>({ defaultValues: team });

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const canListRoles =
    contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, team) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  const onSubmit = async (formTeam: Team) => {
    updateTeam(formTeam.name, formTeam.email || '');
  };

  return (
    <Stack direction={'column'} gap={3}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        <FieldSet label={t('teams.team-settings.label-team-details', 'Team details')}>
          <Stack direction="column" gap={2}>
            <Field
              noMargin
              label={t('teams.team-settings.label-numerical-identifier', 'Numerical identifier')}
              disabled={true}
            >
              <Input value={team.id} id="id-input" />
            </Field>
            <Field
              noMargin
              label={t('teams.team-settings.label-name', 'Name')}
              // BMC code: updated condition
              disabled={!canWriteTeamSettings || !!team.isProvisioned || config.buildInfo.env !== 'development'}
              required
              invalid={!!errors.name}
              error="Name is required"
            >
              <Input {...register('name', { required: true })} id="name-input" />
            </Field>

            {contextSrv.licensedAccessControlEnabled() && canListRoles && (
              <Field noMargin label={t('teams.team-settings.label-role', 'Role')}>
                {/* BMC code - updated disabled condition */}
                <TeamRolePicker
                  teamId={team.id}
                  roleOptions={roleOptions}
                  disabled={!canUpdateRoles || config.buildInfo.env !== 'development'}
                  maxWidth="100%"
                />
              </Field>
            )}

            <Field
              noMargin
              label={t('teams.team-settings.label-email', 'Email')}
              description={t(
                'teams.team-settings.description-email',
                'This is optional and is primarily used to set the team profile avatar (via the Gravatar service)'
              )}
              // BMC Change - Next Inline
              disabled={!canWriteTeamSettings || config.buildInfo.env !== 'development'}
            >
              <Input
                {...register('email')}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                placeholder="team@email.com"
                type="email"
                id="email-input"
              />
            </Field>
          </Stack>
        </FieldSet>
        {/* BMC Change: Hide save button */}
        {config.buildInfo.env === 'development' && (
          <Button type="submit" disabled={!canWriteTeamSettings}>
            <Trans i18nKey="teams.team-settings.save">Save team details</Trans>
          </Button>
        )}
      </form>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} preferenceType="team" />
    </Stack>
  );
};

export default connector(TeamSettings);
