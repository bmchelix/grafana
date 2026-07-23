import { cx } from '@emotion/css';
// BMC Code : Accessibility Change Next line(added useState hook)
import { ReactElement, useCallback, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Dropdown } from '../Dropdown/Dropdown';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';
import { TooltipPlacement } from '../Tooltip/types';

interface PanelMenuProps {
  menu: ReactElement | (() => ReactElement);
  menuButtonClass?: string;
  dragClassCancel?: string;
  title?: string;
  placement?: TooltipPlacement;
  offset?: [number, number];
  onOpenMenu?: () => void;
}

export function PanelMenu({
  menu,
  title,
  placement = 'bottom',
  offset,
  dragClassCancel,
  menuButtonClass,
  onOpenMenu,
}: PanelMenuProps) {
  const testId = title ? selectors.components.Panels.Panel.menu(title) : `panel-menu-button`;
  // BMC Code : Accessibility Change Next line
  const [isOpen, setIsOpen] = useState(false);

  const handleVisibility = useCallback(
    (show: boolean) => {
      // BMC Code : Accessibility Change Next line
      setIsOpen(show);
      if (show && onOpenMenu) {
        onOpenMenu();
      }
    },
    [onOpenMenu]
  );

  return (
    <Dropdown overlay={menu} placement={placement} offset={offset} onVisibleChange={handleVisibility}>
      <ToolbarButton
        aria-label={t('grafana-ui.panel-menu.label', 'Menu for panel {{ title }}', { title: title ?? 'Untitled' })}
        title={t('grafana-ui.panel-menu.title', 'Menu')}
        icon="ellipsis-v"
        iconSize="md"
        narrow
        data-testid={testId}
        // BMC Code : Accessibility Change Next line
        isOpen={isOpen}
        className={cx(menuButtonClass, dragClassCancel)}
      />
    </Dropdown>
  );
}
