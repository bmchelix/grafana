import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Field, Space, Text } from '@grafana/ui';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

/** undefined = no destination chosen; '' = General / Dashboards root (only after explicit picker choice). */
export type RestoreFolderTarget = string | undefined;

function canConfirmRestore(restoreTarget: RestoreFolderTarget, userPickedDestination: boolean): boolean {
  if (restoreTarget === undefined) {
    return false;
  }
  if (userPickedDestination) {
    return true;
  }
  // Preselected from archive: only a non-empty folder enables Restore without an extra click.
  return restoreTarget !== '';
}

export interface RestoreDeletedModalProps {
  isOpen: boolean;
  onConfirm: (restoreTarget: string) => Promise<void>;
  onDismiss: () => void;
  dashboardTitle?: string;
  /** Archived folder UID; empty string means General/Dashboards. */
  folderUid?: string;
  /** Changes when a different row is restored — remounts picker state. */
  restoreKey?: string | number;
  isLoading: boolean;
}

export function RestoreDeletedModal({
  isOpen,
  onConfirm,
  onDismiss,
  dashboardTitle,
  folderUid,
  restoreKey,
  isLoading,
  ...props
}: RestoreDeletedModalProps) {
  const [pickedTarget, setPickedTarget] = useState<RestoreFolderTarget>(undefined);
  const [userPickedDestination, setUserPickedDestination] = useState(false);

  const archivedFolderUid = isOpen && folderUid ? folderUid : undefined;
  const archivedFolder = useGetFolderQueryFacade(archivedFolderUid);

  const validatedArchiveTarget: RestoreFolderTarget =
    folderUid &&
    !archivedFolder.isLoading &&
    !archivedFolder.isFetching &&
    !archivedFolder.isError &&
    archivedFolder.data
      ? folderUid
      : undefined;

  useEffect(() => {
    if (!isOpen) {
      setPickedTarget(undefined);
      setUserPickedDestination(false);
      return;
    }
    setPickedTarget(undefined);
    setUserPickedDestination(false);
  }, [isOpen, folderUid, restoreKey]);

  const restoreTarget = userPickedDestination ? pickedTarget : validatedArchiveTarget;

  const onRestore = async () => {
    reportInteraction('bmc_restore_deleted_confirm_clicked', { count: 1 });
    if (restoreTarget === undefined || !canConfirmRestore(restoreTarget, userPickedDestination)) {
      return;
    }
    await onConfirm(restoreTarget);
    onDismiss();
  };

  const hasDestination = canConfirmRestore(restoreTarget, userPickedDestination);

  const titleLabel = dashboardTitle?.trim() || t('bmc.restore-dashboard.deleted-modal.untitled', 'this dashboard');

  return (
    <ConfirmModal
      isOpen={isOpen}
      body={
        <>
          <Text element="p">
            {t('bmc.restore-dashboard.restore-modal.title', '{{title}}', {
              title: titleLabel,
            })}
          </Text>
          <Space v={3} />
          <Text element="p">
            {t(
              'bmc.restore-dashboard.restore-modal.choose-folder',
              'Choose a folder where the dashboard will be restored'
            )}
          </Text>
          <Space v={1} />
          <Field noMargin>
            <FolderPicker
              key={restoreKey ?? 'restore-folder-picker'}
              onChange={(uid) => {
                setUserPickedDestination(true);
                setPickedTarget(uid === undefined ? undefined : uid);
              }}
              value={restoreTarget}
            />
          </Field>
        </>
      }
      confirmText={
        isLoading
          ? t('bmc.restore-dashboard.restore-modal.restoring', 'Restoring...')
          : t('bmc.restore-dashboard.restore-modal.restore', 'Restore')
      }
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title={t('bmc.restore-dashboard.restore-modal.title-single', 'Restore dashboard')}
      disabled={!hasDestination || isLoading}
      {...props}
    />
  );
}
