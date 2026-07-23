import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { IconName, Stack, stylesFactory, useTheme2 } from '@grafana/ui';

import { ListItem } from '../list-item/ListItem';

export interface SelectableListProps {
  items: SelectableValue[];
  onClick: (item: SelectableValue) => void;
  onItemDrillDown?: (selected: SelectableValue) => void;
  group?: string;
  groupClass?: string;
  listItem: {
    iconName: IconName;
    iconTooltip?: string;
  };
}

export const SelectableList: React.FC<SelectableListProps> = (props: SelectableListProps) => {
  const theme = useTheme2();
  const styles = getResultsItemStyles(theme);

  return (
    <>
      <div className={styles.container}>
        <Stack direction="column">
          {props.items?.map((item, idx) => {
            return (
              <ListItem
                testId={'domain-picker-search-result-item-' + idx}
                iconTooltip={props.listItem.iconTooltip}
                iconName={props.listItem.iconName}
                item={item}
                onItemDrillDown={props.onItemDrillDown}
                onClick={props.onClick}
                key={props.group}
              />
            );
          })}
        </Stack>
      </div>
    </>
  );
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: 0,
    backgroundColor: theme.colors.background.primary,
    width: '100%',
    padding: '6px 0',
  }),
}));
