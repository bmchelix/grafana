import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, isFetchError } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, Select, Stack, stylesFactory, Text, useTheme2 } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { Team } from 'app/types/teams';

import { deleteDSElevationConfig, getDSElevationConfig, saveDSElevationConfig } from './api';

const DSElevationSettings = () => {
  const theme = useTheme2();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const currentUserId = config.bootData.user?.id ?? 0;
  const currentUsername = config.bootData.user?.name || config.bootData.user?.login || '';
  const isAdminUser = Boolean(config.bootData.user?.isGrafanaAdmin || config.bootData.user?.orgRole === 'Admin');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [teamOptions, setTeamOptions] = useState<Array<SelectableValue<number>>>([]);

  // Persisted config (the single active row for this tenant), owned by whoever set it.
  const [configExists, setConfigExists] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [ownerGroupId, setOwnerGroupId] = useState(0);
  const [ownerGroupName, setOwnerGroupName] = useState('');

  // Local (unsaved) UI state. `editing` is true for a fresh setup, the owner editing
  // their config inline, or a non-owner who chose to take over the configuration.
  const [editing, setEditing] = useState(false);
  const [editTeamId, setEditTeamId] = useState<number | undefined>(undefined);
  const [editTeamName, setEditTeamName] = useState('');

  const isOwner = configExists && ownerUserId === currentUserId;
  const isNonOwner = configExists && ownerUserId !== currentUserId;
  const teamNameCollator = useMemo(() => new Intl.Collator(undefined, { sensitivity: 'base' }), []);

  const toTeamOption = (team: Pick<Team, 'id' | 'name'> & { avatarUrl?: string }): SelectableValue<number> => ({
    value: team.id,
    label: team.name,
    imgUrl: team.avatarUrl,
  });

  const getBackendMessage = (error: unknown) => (isFetchError(error) ? error.data?.message : undefined);

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        const response = await getDSElevationConfig();
        if (!isMounted) {
          return;
        }

        // Missing owner/group ids mean the tenant has no elevation config yet.
        if (!response.userId || !response.groupId) {
          return;
        }

        setConfigExists(true);
        setOwnerUserId(response.userId);
        setOwnerName(response.userLogin || '');
        setOwnerGroupId(response.groupId);
        setOwnerGroupName(response.groupName || '');

        // The owner can edit their own config inline (group prefilled).
        // A different user starts in read-only view until they take over.
        if (response.userId === currentUserId) {
          setEditing(true);
          setEditTeamId(response.groupId || undefined);
          setEditTeamName(response.groupName || '');
        }
      } catch (error) {
        if (isMounted) {
          appEvents.emit('alert-error', [
            t('bmc.ds-elevation.load.error', 'Failed to load elevated dashboard access settings.'),
            getBackendMessage(error),
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    let isMounted = true;
    const loadTeams = async () => {
      setIsTeamsLoading(true);
      try {
        let teams: Array<Pick<Team, 'id' | 'name'> & { avatarUrl?: string }> = [];

        const perPage = 500;
        let page = 1;
        let totalCount = 0;
        const allTeams: Team[] = [];

        do {
          const result = await getBackendSrv().get<{
            teams: Team[];
            totalCount: number;
            perPage: number;
            page: number;
          }>(`/api/teams/search?perpage=${perPage}&page=${page}&query=`);
          allTeams.push(...result.teams);
          totalCount = result.totalCount;
          page++;
        } while (allTeams.length < totalCount);

        teams = allTeams;

        if (!isMounted) {
          return;
        }

        teams.sort((a, b) => teamNameCollator.compare(a.name, b.name));
        setTeamOptions(teams.map(toTeamOption));
      } catch (error) {
        if (isMounted) {
          appEvents.emit('alert-error', [
            t('bmc.ds-elevation.teams.load.error', 'Failed to load teams for selection.'),
          ]);
        }
      } finally {
        if (isMounted) {
          setIsTeamsLoading(false);
        }
      }
    };

    loadTeams();
    return () => {
      isMounted = false;
    };
  }, [isAdminUser, teamNameCollator]);

  const resetToDisabled = () => {
    setConfigExists(false);
    setOwnerUserId(0);
    setOwnerName('');
    setOwnerGroupId(0);
    setOwnerGroupName('');
    setEditing(false);
    setEditTeamId(undefined);
    setEditTeamName('');
  };

  // A non-owner chooses to take over: the config becomes theirs and they pick a fresh group.
  const startTakeover = () => {
    setEditing(true);
    setEditTeamId(undefined);
    setEditTeamName('');
  };

  // Cancel any unsaved change: a fresh setup clears the picker, the owner reverts to
  // their saved group, and a non-owner takeover returns to the read-only view.
  const onCancel = () => {
    if (isNonOwner) {
      setEditing(false);
      setEditTeamId(undefined);
      setEditTeamName('');
      return;
    }
    if (isOwner) {
      setEditTeamId(ownerGroupId || undefined);
      setEditTeamName(ownerGroupName);
      return;
    }
    setEditTeamId(undefined);
    setEditTeamName('');
  };

  // Enable (fresh) or Update (existing) the configuration; the current user becomes the owner.
  const enableOrUpdate = async () => {
    if (!editTeamId) {
      appEvents.emit('alert-warning', [
        t('bmc.ds-elevation.validation.group-required', 'Select a group before saving.'),
      ]);
      return;
    }

    setIsSaving(true);
    try {
      // Only a 200 with the persisted config counts as a successful save.
      const saved = await saveDSElevationConfig({ groupId: editTeamId });

      setConfigExists(true);
      setOwnerUserId(saved.userId || currentUserId);
      setOwnerName(saved.userLogin || currentUsername);
      setOwnerGroupId(saved.groupId || editTeamId);
      setOwnerGroupName(saved.groupName || editTeamName);
      setEditTeamId(saved.groupId || editTeamId);
      setEditTeamName(saved.groupName || editTeamName);
      setEditing(true);

      appEvents.emit('alert-success', [
        t('bmc.ds-elevation.save.success', 'Elevated dashboard access settings saved successfully.'),
      ]);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      appEvents.emit('alert-error', [
        t('bmc.ds-elevation.save.error', 'Failed to save elevated dashboard access settings.'),
        getBackendMessage(error),
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  // Disable deletes the persisted config row (available to the owner or any non-owner).
  const disable = async () => {
    if (!configExists) {
      resetToDisabled();
      return;
    }

    setIsSaving(true);
    try {
      const deleteSuccess = await deleteDSElevationConfig();
      if (!deleteSuccess) {
        throw new Error(`Unexpected response status while disabling elevated dashboard access: ${deleteSuccess}`);
      }
      resetToDisabled();
      appEvents.emit('alert-success', [t('bmc.ds-elevation.disable.success', 'Elevated dashboard access disabled.')]);
    } catch (error) {
      appEvents.emit('alert-error', [
        t('bmc.ds-elevation.disable.error', 'Failed to disable elevated dashboard access.'),
        getBackendMessage(error),
      ]);
      setIsSaving(false);
    } finally {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Non-owner viewing the current config without having chosen to take over yet.
  const readOnlyView = isNonOwner && !editing;
  const displayedUser = readOnlyView ? ownerName || `User ${ownerUserId}` : currentUsername;
  const busy = isSaving || isLoading;

  // Whether the selected group differs from what is persisted (drives Enable/Update + Cancel).
  const hasChanges =
    (!configExists && !!editTeamId) || // fresh: a group has been chosen
    (isOwner && editTeamId !== ownerGroupId) || // owner: group changed
    (isNonOwner && editing && !!editTeamId); // takeover: a group has been chosen

  // Cancel appears whenever there is an unsaved change or an in-progress takeover.
  const showCancel =
    (!configExists && !!editTeamId) || (isOwner && editTeamId !== ownerGroupId) || (isNonOwner && editing);

  const showPrimary = !readOnlyView; // Enable (fresh) or Update (existing)
  const showDisable = configExists && (isOwner || readOnlyView); // owner or non-owner read-only can disable
  const primaryLabel = configExists ? t('bmc.ds-elevation.update', 'Update') : t('bmc.ds-elevation.enable', 'Enable');

  const selectedTeamOption =
    teamOptions.find((team) => team.value === editTeamId) ??
    (editTeamId
      ? {
          value: editTeamId,
          label: editTeamName || ownerGroupName || `Group ${editTeamId}`,
          imgUrl: teamOptions.find((team) => team.value === editTeamId)?.imgUrl,
        }
      : null);

  return (
    <div className={styles.container}>
      <FieldSet disabled={busy} className={styles.fieldSet}>
        {readOnlyView && (
          <div className={styles.notice}>
            <Text color="secondary">
              {t(
                'bmc.ds-elevation.owned-by',
                'Elevated dashboard access is currently configured by another user. Use your own access to change it.'
              )}
            </Text>
          </div>
        )}

        <Field noMargin label={t('bmc.ds-elevation.master-user', 'Elevated through user')} className={styles.picker}>
          <Input value={displayedUser} disabled />
        </Field>

        <Field noMargin label={t('bmc.ds-elevation.group', 'Elevated group')} className={styles.picker}>
          {readOnlyView ? (
            <Input value={ownerGroupName || `Group ${ownerGroupId}`} disabled />
          ) : (
            <Select<number>
              isLoading={isTeamsLoading}
              options={teamOptions}
              value={selectedTeamOption}
              placeholder={t('bmc.ds-elevation.team-picker.placeholder', 'Select a team')}
              noOptionsMessage={t('bmc.ds-elevation.team-picker.empty', 'No teams found')}
              onChange={(selection) => {
                setEditTeamId(selection.value);
                setEditTeamName(selection.label ?? '');
              }}
            />
          )}
        </Field>

        <div className={styles.actions}>
          <Stack direction="row" gap={1} alignItems="center">
            {readOnlyView && (
              <Button variant="secondary" onClick={startTakeover} disabled={busy}>
                {t('bmc.ds-elevation.use-my-access', 'Use my access')}
              </Button>
            )}
            {showPrimary && (
              <Button onClick={enableOrUpdate} disabled={busy || !hasChanges}>
                {primaryLabel}
              </Button>
            )}
            {showDisable && (
              <Button variant="destructive" onClick={disable} disabled={busy}>
                {t('bmc.ds-elevation.disable', 'Disable')}
              </Button>
            )}
            {showCancel && (
              <Button variant="secondary" onClick={onCancel} disabled={busy}>
                {t('bmc.common.cancel', 'Cancel')}
              </Button>
            )}
          </Stack>
        </div>
      </FieldSet>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  container: css({
    maxWidth: '700px',
    width: '100%',
  }),
  fieldSet: css({
    marginTop: theme.spacing(1),
  }),
  notice: css({
    marginBottom: theme.spacing(2),
  }),
  actions: css({
    marginTop: theme.spacing(2),
  }),
  picker: css({
    marginBottom: theme.spacing(2),
  }),
}));

export default DSElevationSettings;
