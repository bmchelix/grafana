import { css, cx } from '@emotion/css';
// BMC Code : Accessibility Change ( Next X lines )
import { FC, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { CalcFieldModule } from '../../types';
import { getSectionIcon } from '../../utils';

interface SectionHeaderProps {
  editable?: boolean;
  onSectionClick: (section: CalcFieldModule) => void;
  section: CalcFieldModule;
}

export const SectionHeader: FC<SectionHeaderProps> = ({ section, onSectionClick, editable = false }) => {
  const styles = useStyles2((theme) => getSectionHeaderStyles(theme, false, editable));

  const onSectionExpand = () => {
    onSectionClick(section);
  };

  // BMC Code : Accessibility Change starts here.
  // Added onKeyDown event for triggering modal open/close on space/enter press
  const onKeyDownHandlerForWrappers = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          onSectionClick(section);
          break;

        case ' ':
          if ((event.target as HTMLInputElement).classList.contains('collapsing-div')) {
            event.preventDefault();
            event.stopPropagation();
            onSectionClick(section);
            break;
          }
      }
    },
    [section, onSectionClick]
  );
  // BMC Code : Accessibility Change ends here.

  return (
    // // BMC Code : Accessibility Change ( Next line )
    // Added extra class name collapsing-div, added onKeyDown event for triggering modal open/close on space/enter press, added role and tabIndex for tab focus, change aria-label text to match proper name.
    <div
      className={`${styles.wrapper}, collapsing-div`}
      onClick={onSectionExpand}
      onKeyDown={onKeyDownHandlerForWrappers}
      aria-label={section.expanded ? `Collapse folder ${section.title}` : `Expand folder ${section.title}`}
      // BMC Code : Accessibility Change (Next Line)
      aria-expanded={section.expanded}
      role="button"
      tabIndex={0}
    >
      <div className={styles.icon}>
        <Icon name={getSectionIcon(section)} />
      </div>

      <div className={styles.text}>{section.title}</div>
    </div>
  );
};

const getSectionHeaderStyles = (theme: GrafanaTheme2, selected = false, editable: boolean) => {
  const sm = theme.spacing(1);
  return {
    wrapper: cx(
      css({
        display: 'flex',
        alignItems: 'center',
        fontSize: theme.typography.fontSize,
        padding: '12px',
        color: theme.colors.text.secondary,
        '&:hover, &.selected': {
          color: theme.colors.text.primary,
        },
        '&:hover a': {
          opacity: 1,
        },
      }),
      'pointer',
      { selected }
    ),
    icon: css({
      padding: `0 ${sm} 0 ${editable ? 0 : sm}`,
    }),
    text: css({
      flexGrow: 1,
      lineHeight: '24px',
    }),
    link: css({
      padding: '2px 10px 0',
      color: theme.colors.text.secondary,
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 150ms ease-in-out',
      },
    }),
    separator: css({
      marginRight: '6px',
    }),
  };
};
