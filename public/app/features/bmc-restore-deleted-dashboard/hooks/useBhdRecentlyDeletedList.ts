import { useCallback, useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

/** Must match pkg/bhd_recently_deleted.DeletedDashboardRetention (60 days). */
export const DELETED_DASHBOARD_RETENTION_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Raw API row from GET /api/bhd-recently-deleted (pkg/bhd_recently_deleted.ListItem). */
export interface BhdRecentlyDeletedApiItem {
  id: number;
  orgId: number;
  originalId: number;
  uid: string;
  slug: string;
  title: string;
  folderUid: string;
  isFolder: boolean;
  tags?: string[];
  deletedAt: string;
}

/** List item with derived fields for the recently-deleted UI. */
export interface BhdRecentlyDeletedItem extends BhdRecentlyDeletedApiItem {
  /** Days until permanent purge; -1 when deletedAt is missing or invalid. */
  daysRemaining: number;
}

/**
 * Days until permanent purge after soft delete.
 * Returns null if deletedAt is missing or invalid.
 */
export function getDaysRemainingUntilPermanentDelete(deletedAt?: string): number | null {
  if (!deletedAt) {
    return null;
  }
  const deletedMs = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedMs)) {
    return null;
  }
  const purgeMs = deletedMs + DELETED_DASHBOARD_RETENTION_DAYS * MS_PER_DAY;
  const remainingMs = purgeMs - Date.now();
  return Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));
}

export function enrichBhdRecentlyDeletedItem(item: BhdRecentlyDeletedApiItem): BhdRecentlyDeletedItem {
  return {
    ...item,
    daysRemaining: getDaysRemainingUntilPermanentDelete(item.deletedAt) ?? -1,
  };
}

export function useBhdRecentlyDeletedList() {
  const [items, setItems] = useState<BhdRecentlyDeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(undefined);
    try {
      const res = await getBackendSrv().get<BhdRecentlyDeletedApiItem[]>('/api/bhd-recently-deleted');
      setItems(Array.isArray(res) ? res.map(enrichBhdRecentlyDeletedItem) : []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, refetch: load };
}
