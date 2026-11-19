import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, stylesFactory, useTheme2 } from '@grafana/ui';

export interface TagListProps {
  tags: SelectableValue[];
  onRemove?: (selected: SelectableValue[], removedItem: SelectableValue) => void;
  getTitle: (item: SelectableValue) => string;
  tagClass?: string;
  getTooltip: (itme: SelectableValue) => string;
}

export const TagList: React.FC<TagListProps> = (props: TagListProps) => {
  const theme = useTheme2();
  const styles = getResultsItemStyles(theme);
  const [showRemove, setShowRemove] = useState({} as { [key: string]: boolean });

  const onRemoveItem = (removeItem: SelectableValue) => {
    const newItems = props.tags.filter((item) => item !== removeItem);

    if (props.onRemove) {
      props.onRemove(newItems, removeItem);
    }
  };

  const tagStyle = {
    crossIcon: {
      opacity: '0',
      transition: 'all ease-out .2s',
      cursor: 'pointer',
    },
    active: {
      opacity: '1',
      transition: 'all ease-out .2s',
      cursor: 'pointer',
    },
    label: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      left: '8px',
      position: 'relative' as 'relative',
      transition: 'left ease-out .2s',
    },
    activel: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      left: '0',
      position: 'relative' as 'relative',
      transition: 'left ease-out .2s',
    },
  };

  const getLabelStyle = (index: number) => {
    if (!props.onRemove) {
      return {};
    }
    return showRemove['tag-' + index] ? tagStyle.activel : tagStyle.label;
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '1024px' }}>
        {props.tags?.length > 0 &&
          props.tags.map((item, index) => {
            return (
              <div
                data-testid={'domain-picker-selected-tag-item-' + index}
                key={'tag-' + index}
                className={styles.itemContainer}
                onMouseEnter={() => setShowRemove({ ['tag-' + index]: true })}
                onMouseLeave={() => setShowRemove({ ['tag-' + index]: false })}
              >
                <span title={props.getTooltip(item)} style={getLabelStyle(index)}>
                  {props.getTitle(item)}
                </span>

                {props.onRemove && (
                  <Icon
                    name="times"
                    onClick={() => onRemoveItem(item)}
                    style={showRemove['tag-' + index] ? tagStyle.active : tagStyle.crossIcon}
                    title={t('bmc.variables.optimize.remove-item', 'Remove item')}
                  />
                )}
              </div>
            );
          })}
      </div>
    </>
  );
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2) => ({
  itemContainer: css({
    color: theme.colors.text.primary,
    fontSize: 12,
    lineHeight: theme.typography.bodySmall.lineHeight,
    maxWidth: 'fit-content',
    position: 'relative',
    height: 32,
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    marginBottom: 3,
    marginRight: 3,
    whiteSpace: 'nowrap',
    textShadow: 'none',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: 180,
  }),
}));
