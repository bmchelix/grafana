import { css } from '@emotion/css';
import { Dispatch, FC, SetStateAction } from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Stack, stylesFactory, useTheme } from '@grafana/ui';

import { SearchLayout, SearchQuery } from '../../types';

import { SortPicker, TypePicker } from './SortPicker';

export const layoutOptions = [
  // BMC Code : Accessibility Change (Next 2 lines)
  { label: 'Folder view', value: SearchLayout.Module, icon: 'folder' },
  { label: 'List view', value: SearchLayout.List, icon: 'list-ul' },
];

type onSelectChange = (value: SelectableValue) => void;
interface Props {
  onLayoutChange: Dispatch<SetStateAction<any>>;
  onSortChange: onSelectChange;
  query: SearchQuery;
  hideLayout?: boolean;
  typeOptions: string[];
  onFilterTypeChange: onSelectChange;
}

export const ActionRow: FC<Props> = ({
  onLayoutChange,
  onSortChange,
  query,
  hideLayout,
  typeOptions,
  onFilterTypeChange,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <Stack direction="row" gap={2} alignItems="center">
          {!hideLayout ? (
            <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={query.layout} />
          ) : null}
          <SortPicker onChange={onSortChange} value={query.sort?.value} />
          {query.layout === SearchLayout.List ? (
            <TypePicker onChange={onFilterTypeChange} options={typeOptions} value={query.filterType} />
          ) : (
            ''
          )}
        </Stack>
      </div>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css({
      display: 'none',
      [`@media only screen and (min-width: ${theme.breakpoints.md})`]: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${theme.spacing.lg} 0`,
        width: '100%',
      },
    }),
    rowContainer: css({
      marginRight: theme.spacing.md,
    }),
    checkboxWrapper: css({
      label: {
        lineHeight: `${theme.typography.lineHeight.sm}`,
      },
    }),
  };
});
