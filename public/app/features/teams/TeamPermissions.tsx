import { t } from '@grafana/i18n';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
// import { contextSrv } from 'app/core/services/context_srv';
import { Team } from 'app/types/teams';

type TeamPermissionsProps = {
  team: Team;
};

// TeamPermissions component replaces TeamMembers component when the accesscontrol feature flag is set
const TeamPermissions = (props: TeamPermissionsProps) => {
  // BMC Code: Comment below
  // let canSetPermissions = contextSrv.hasPermissionInMetadata(
  //   AccessControlAction.ActionTeamsPermissionsWrite,
  //   props.team
  // );

  // if (props.team.isProvisioned) {
  //   canSetPermissions = false;
  // }
  // BMC Code: End

  return (
    // BMC code - changes for localization
    <Permissions
      addPermissionTitle={t('bmcgrafana.team-permissions.add-member', 'Add member')}
      buttonLabel={t('bmcgrafana.team-permissions.add-member', 'Add member')}
      emptyLabel={t(
        'bmcgrafana.team-permissions.no-members-message',
        'There are no members in this team or you do not have the permissions to list the current members.'
      )}
      resource="teams"
      resourceId={props.team.id}
      canSetPermissions={false}
    />
  );
};

export default TeamPermissions;
