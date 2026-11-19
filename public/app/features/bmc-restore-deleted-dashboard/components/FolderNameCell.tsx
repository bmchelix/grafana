import { Text } from '@grafana/ui';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';

interface FolderNameCellProps {
  folderUid: string;
}

/** Resolves folder UID to folder title using the same folder API as browse dashboards. */
export function FolderNameCell({ folderUid }: FolderNameCellProps) {
  const { data, isLoading } = useGetFolderQueryFacade(folderUid || undefined);

  if (!folderUid) {
    return null;
  }

  if (isLoading) {
    return <Text color="secondary">…</Text>;
  }

  if (!data?.title) {
    return null;
  }

  return <Text color="secondary">{data.title}</Text>;
}
