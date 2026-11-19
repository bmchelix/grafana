import { css } from '@emotion/css';
import { Action, Location } from 'history';
import React, { FC, memo, useCallback, useEffect, useRef } from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { AppEvents, GrafanaTheme2, NavModel } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, Modal, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { StoreState } from 'app/types/store';

interface ConnectedProps {
  navModel: NavModel;
}

type PendingNavigation = {
  location: Location;
  action: Action;
};

export const QueryOptimizationSettings: FC<ConnectedProps> = memo(({ navModel }) => {
  const styles = useStyles2(getStyles);
  const preferenceService = React.useMemo(() => new PreferencesService('org'), []);
  const [skillId, setSkillId] = React.useState<string>('');
  const [savedSkillId, setSavedSkillId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [pendingNavigation, setPendingNavigation] = React.useState<PendingNavigation | null>(null);
  const isDirty = skillId !== savedSkillId;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const unblockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const loadQueryOptimizationSkillId = async () => {
      try {
        const prefs = await preferenceService.load();
        const loadedSkillId = prefs.queryOptimizationSkillId ?? '';
        setSkillId(loadedSkillId);
        setSavedSkillId(loadedSkillId);
      } catch (error) {
        appEvents.emit(AppEvents.alertError, [
          t('bmc.query-optimization.settings.load-error-title', 'Error'),
          t('bmc.query-optimization.settings.load-error', 'Unable to load query optimization settings'),
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadQueryOptimizationSkillId();
  }, [preferenceService]);

  const beforeUnloadHandler = useCallback((e: BeforeUnloadEvent) => {
    if (isDirtyRef.current) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [beforeUnloadHandler]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const unblock = locationService.getHistory().block((location, action) => {
      setPendingNavigation({ location, action });
      return false;
    });
    unblockRef.current = unblock;
    return () => {
      unblock();
      unblockRef.current = null;
    };
  }, [isDirty]);

  const onConfirmLeave = () => {
    const tx = pendingNavigation;
    setPendingNavigation(null);
    if (unblockRef.current) {
      unblockRef.current();
      unblockRef.current = null;
    }
    if (tx) {
      if (tx.action === 'PUSH') {
        locationService.getHistory().push(tx.location);
      } else if (tx.action === 'REPLACE') {
        locationService.getHistory().replace(tx.location);
      } else {
        locationService.getHistory().goBack();
      }
    }
  };

  const onDismissLeave = () => {
    setPendingNavigation(null);
  };

  const onSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await preferenceService.patch({ queryOptimizationSkillId: skillId });
      setSavedSkillId(skillId);
    } catch (error) {
      appEvents.emit(AppEvents.alertError, [
        t('bmc.query-optimization.settings.save-error-title', 'Error'),
        t('bmc.query-optimization.settings.save-error', 'Unable to save query optimization settings'),
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <form onSubmit={onSubmit} className={styles.form}>
          <FieldSet>
            <Field
              noMargin
              label={t('bmc.query-optimization.settings.skill-id', 'Skill ID')}
              description={t(
                'bmc.query-optimization.settings.skill-description',
                'Skill ID needs to be configured for Query Optimization Agent with HelixGPT Agent Studio version {{version}} or above',
                { version: '26.4.00' }
              )}
            >
              <Input
                id="skill-id"
                value={skillId}
                disabled={loading}
                onChange={(e) => setSkillId(e.currentTarget.value.trim())}
              />
            </Field>
            <div className={styles.marginTop}>
              <Button type="submit" disabled={loading || !isDirty}>
                <Trans i18nKey="bmc.common.save">Save</Trans>
              </Button>
            </div>
          </FieldSet>
        </form>
        {pendingNavigation && (
          <Modal
            isOpen={true}
            title={t('bmc.query-optimization.settings.unsaved-title', 'Unsaved changes')}
            onDismiss={onDismissLeave}
            closeOnBackdropClick={false}
          >
            <p>
              <Trans i18nKey="bmc.query-optimization.settings.unsaved-message">
                You have unsaved changes to the Skill ID. Do you want to leave without saving?
              </Trans>
            </p>
            <Modal.ButtonRow>
              <Button variant="secondary" onClick={onDismissLeave} fill="outline">
                <Trans i18nKey="bmc.query-optimization.settings.unsaved-stay">Stay</Trans>
              </Button>
              <Button variant="destructive" onClick={onConfirmLeave}>
                <Trans i18nKey="bmc.query-optimization.settings.unsaved-leave">Leave</Trans>
              </Button>
            </Modal.ButtonRow>
          </Modal>
        )}
      </Page.Contents>
    </Page>
  );
});

QueryOptimizationSettings.displayName = 'QueryOptimizationSettings';

interface QueryOptimizationSettingsProps extends GrafanaRouteComponentProps<{}> {}

const mapStateToProps: MapStateToProps<ConnectedProps, QueryOptimizationSettingsProps, StoreState> = (state) => {
  return {
    navModel: getNavModel(state.navIndex, 'query-optimization-settings'),
  };
};
const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    maxWidth: theme.breakpoints.values.sm,
    marginTop: theme.spacing(4),
  }),
  marginTop: css({
    marginTop: theme.spacing(2),
  }),
});

export default connect(mapStateToProps)(QueryOptimizationSettings);
