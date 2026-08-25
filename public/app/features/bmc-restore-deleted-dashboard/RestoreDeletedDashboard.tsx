import { css } from '@emotion/css';
import { memo, useCallback, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, reportInteraction } from '@grafana/runtime';
import {
  Alert,
  Button,
  CellProps,
  Column,
  EmptyState,
  FilterInput,
  InteractiveTable,
  Spinner,
  TagList,
  Text,
  useStyles2,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { clearFolders } from 'app/features/browse-dashboards/state/slice';
import { useDispatch } from 'app/types/store';

import { FolderNameCell } from './components/FolderNameCell';
import { RestoreDeletedModal } from './components/RestoreDeletedModal';
import { useBhdRecentlyDeletedList, DELETED_DASHBOARD_RETENTION_DAYS } from './hooks/useBhdRecentlyDeletedList';

type TrashRow = {
  id: number;
  uid: string;
  title: string;
  tags: string[];
  tagsLabel: string;
  folderUid: string;
  deletedAt?: string;
  daysRemaining: number;
};

function formatDaysRemaining(days: number): string {
  if (days < 0) {
    return '—';
  }
  return t('bmc-restore-deleted.table.days-remaining-value', '{{count}}', { count: days });
}

const RestoreDeletedDashboard = memo(() => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const { items, loading, error, refetch } = useBhdRecentlyDeletedList();

  const [query, setQuery] = useState('');
  const [restoreItemId, setRestoreItemId] = useState<number | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const restoreItem = useMemo(
    () => (restoreItemId != null ? items.find((i) => i.id === restoreItemId) : undefined),
    [items, restoreItemId]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      const tagHaystack = (item.tags ?? []).join(',').toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.uid.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        tagHaystack.includes(q)
      );
    });
  }, [items, query]);

  const tableRows: TrashRow[] = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        uid: item.uid,
        title: item.title,
        tags: item.tags ?? [],
        tagsLabel: (item.tags ?? []).join(', '),
        folderUid: item.folderUid ?? '',
        deletedAt: item.deletedAt,
        daysRemaining: item.daysRemaining,
      })),
    [filteredItems]
  );

  const openRestoreModal = useCallback((id: number) => {
    reportInteraction('bmc_restore_deleted_open_modal', { count: 1 });
    setRestoreItemId(id);
  }, []);

  const onRestoreConfirm = async (restoreTarget: string) => {
    if (restoreItemId == null || !restoreItem) {
      return;
    }

    const title = restoreItem.title;
    setRestoreLoading(true);

    try {
      const response = await getBackendSrv().post<{ bhdCode?: string }>(
        `/api/bhd-recently-deleted/${restoreItemId}/restore`,
        { folderUid: restoreTarget }
      );

      dispatch(clearFolders([restoreTarget === '' ? undefined : restoreTarget]));

      if (!response?.bhdCode) {
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t('bmc.notifications.restore-dashboard.success', 'Dashboard "{{title}}" restored successfully', {
              title,
            }),
          ],
        });
      }
    } finally {
      setRestoreLoading(false);
      setRestoreItemId(null); // close modal
      void refetch({ silent: true });
    }
  };

  const columns: Array<Column<TrashRow>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('bmc.restore-dashboard.table-header.title', 'Title'),
        sortType: 'string',
        cell: ({ row: { original } }: CellProps<TrashRow>) => <Text weight="medium">{original.title}</Text>,
      },
      {
        id: 'tagsLabel',
        header: t('bmc.restore-dashboard.table-header.tags', 'Tags'),
        sortType: 'string',
        cell: ({ row: { original } }: CellProps<TrashRow>) => (
          <TagList className={styles.tagList} tags={original.tags} />
        ),
      },
      {
        id: 'folderUid',
        header: t('bmc.restore-dashboard.table-header.folder', 'Folder'),
        sortType: 'string',
        cell: ({ row: { original } }: CellProps<TrashRow>) => <FolderNameCell folderUid={original.folderUid} />,
      },
      {
        id: 'deletedAt',
        header: t('bmc.restore-dashboard.table-header.deleted-on', 'Deleted On'),
        sortType: 'string',
        cell: ({ row: { original } }: CellProps<TrashRow>) => (
          <Text color="secondary">
            {original.deletedAt
              ? new Date(original.deletedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : ''}
          </Text>
        ),
      },
      {
        id: 'daysLeft',
        header: t('bmc.restore-dashboard.table-header.days-left', 'Days Left'),
        sortType: 'number',
        cell: ({ row: { original } }: CellProps<TrashRow>) => (
          <Text color="secondary">{formatDaysRemaining(original.daysRemaining)}</Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        disableSortBy: true,
        cell: ({ row: { original } }: CellProps<TrashRow>) => (
          <div className={styles.actionsCell}>
            <Button
              variant="secondary"
              size="sm"
              icon="history"
              aria-label={t('bmc.restore-dashboard.table-header.restore-row', 'Restore {{title}}', {
                title: original.title,
              })}
              onClick={() => openRestoreModal(original.id)}
            >
              <Trans i18nKey="dashboard.version-history-table.restore">Restore</Trans>
            </Button>
          </div>
        ),
      },
    ],
    [openRestoreModal, styles.actionsCell, styles.tagList]
  );

  const headerTooltips = useMemo(
    () => ({
      daysLeft: {
        content: t(
          'bmc.restore-dashboard.table-header.days-left-tooltip',
          'Days remaining until permanent deletion. Deleted dashboards are kept for {{days}} days.',
          { days: DELETED_DASHBOARD_RETENTION_DAYS }
        ),
        iconName: 'info-circle' as const,
      },
    }),
    []
  );

  if (loading && items.length === 0 && !error) {
    return (
      <Page navId="recently-deleted">
        <Page.Contents className={styles.centered}>
          <Spinner />
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="recently-deleted">
      <Page.Contents className={styles.pageContents}>
        {error && (
          <Alert severity="error" title={t('bmc.restore-dashboard.error.title', 'Could not load deleted dashboards')}>
            {error.message}
          </Alert>
        )}

        <div>
          <FilterInput
            placeholder={t('bmc.restore-dashboard.search.placeholder', 'Search by title, or tags')}
            value={query}
            onChange={setQuery}
          />
        </div>

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) =>
              tableRows.length === 0 ? (
                <div className={styles.emptyWrap} style={{ width, height }}>
                  <EmptyState
                    variant={query.trim() ? 'not-found' : 'completed'}
                    message={
                      query.trim()
                        ? t('bmc.restore-dashboard.empty.search', 'No deleted dashboards match your search.')
                        : t(
                            'bmc.restore-dashboard.empty.none',
                            'No deleted dashboards right now. Deleted dashboards will appear here after you remove them from the tree.'
                          )
                    }
                  />
                </div>
              ) : (
                <div className={styles.tableScroll} style={{ width, height }}>
                  <InteractiveTable
                    className={styles.table}
                    columns={columns}
                    data={tableRows}
                    getRowId={(r) => String(r.id)}
                    headerTooltips={headerTooltips}
                  />
                </div>
              )
            }
          </AutoSizer>
        </div>

        <RestoreDeletedModal
          key={restoreItemId ?? 'closed'}
          isOpen={restoreItemId != null}
          onDismiss={() => setRestoreItemId(null)}
          onConfirm={onRestoreConfirm}
          dashboardTitle={restoreItem?.title}
          folderUid={restoreItem?.folderUid}
          restoreKey={restoreItemId ?? undefined}
          isLoading={restoreLoading}
        />
      </Page.Contents>
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    height: '100%',
    minHeight: 0,
  }),
  centered: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 200,
  }),
  subView: css({
    flex: 1,
    minHeight: 0,
    height: '100%',
  }),
  tableScroll: css({
    overflow: 'auto',
    // overflow-x on the inner wrapper forces overflow-y: auto and breaks position: sticky on thead.
    '& > div': {
      overflow: 'visible !important',
    },
  }),
  table: css({
    borderCollapse: 'separate',
    borderSpacing: 0,
    'thead th': {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.secondary,
      boxShadow: `0 1px 0 ${theme.colors.border.weak}`,
    },
    'thead th > button': {
      backgroundColor: 'transparent',
    },
  }),
  emptyWrap: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  tagList: css({
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
  }),
  actionsCell: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
});

RestoreDeletedDashboard.displayName = 'RestoreDeletedDashboard';
export default RestoreDeletedDashboard;
