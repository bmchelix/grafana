import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, FilterInput, InlineField, LinkButton, useStyles2 } from '@grafana/ui';

import { SortPicker } from '../Select/SortPicker';

export type FilterCheckbox = {
  onChange: (value: boolean) => void;
  value: boolean;
  label?: string;
};

export interface Props {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  linkButton?: { href: string; title: string; disabled?: boolean };
  target?: string;
  placeholder?: string;
  sortPicker?: {
    onChange: (sortValue: SelectableValue) => void;
    value?: string;
    getSortOptions?: () => Promise<SelectableValue[]>;
  };
  filterCheckbox?: FilterCheckbox;
}

export default function PageActionBar({
  searchQuery,
  linkButton,
  setSearchQuery,
  target,
  // BMC Change: Next line
  placeholder = t('bmcgrafana.search-inputs.name-type', 'Search by name or type'),
  sortPicker,
  filterCheckbox,
}: Props) {
  const styles = useStyles2(getStyles);
  const linkProps: Omit<Parameters<typeof LinkButton>[0], 'children'> = {
    href: linkButton?.href,
    disabled: linkButton?.disabled,
  };

  if (target) {
    linkProps.target = target;
  }

  return (
    <div className={styles.container}>
      {/* // BMC Code : Accessibility Change starts here. */}
      <label htmlFor="playlist-hidden" className={styles.hiddenLabel}>
        {placeholder}
      </label>
      <InlineField grow>
        <FilterInput id="playlist-hidden" value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
      </InlineField>
      {/* //BMC code Accessibility change ends here */}
      {filterCheckbox && (
        <Checkbox
          label={filterCheckbox.label}
          value={filterCheckbox.value}
          onChange={(event) => filterCheckbox.onChange(event.currentTarget.checked)}
        />
      )}
      {sortPicker && (
        <SortPicker
          onChange={sortPicker.onChange}
          value={sortPicker.value}
          getSortOptions={sortPicker.getSortOptions}
        />
      )}
      {linkButton && <LinkButton {...linkProps}>{linkButton.title}</LinkButton>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
    // BMC a11y change - next object
    hiddenLabel: css({
      border: '0',
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: '0',
      position: 'absolute',
      width: '1px',
    }),
  };
};
