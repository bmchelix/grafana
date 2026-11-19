import { css } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { IconButton } from '../../components/IconButton/IconButton';
import { Tab } from '../../components/Tabs/Tab';
import { TabContent } from '../../components/Tabs/TabContent';
import { TabsBar } from '../../components/Tabs/TabsBar';
import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { Box } from '../Layout/Box/Box';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';
// BMC Code : Accessibility Change ( Next 1 line )
import { OrientationStateType } from '../Tabs/TabsBar';

export interface TabConfig {
  label: string;
  value: string;
  content: React.ReactNode;
  icon: IconName;
  // BMC Code : Accessibility Change ( Next 2 lines )
  tabId?: string;
  tabPanelId?: string;
}

export interface TabbedContainerProps {
  tabs: TabConfig[];
  defaultTab?: string;
  closeIconTooltip?: string;
  onClose: () => void;
  testId?: string;
  // BMC Code : Accessibility Change ( Next 1 line )
  orientationState?: OrientationStateType;
}

// BMC Code : Accessibility Change ( Next 1 line )
export function TabbedContainer({
  tabs,
  defaultTab,
  closeIconTooltip,
  onClose,
  testId,
  orientationState,
}: TabbedContainerProps) {
  const [activeTab, setActiveTab] = useState(tabs.some((tab) => tab.value === defaultTab) ? defaultTab : tabs[0].value);
  const styles = useStyles2(getStyles);

  const onSelectTab = (item: SelectableValue<string>) => {
    setActiveTab(item.value!);
  };

  // BMC Code : Accessibility Change starts here.
  const focusRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    if (activeTab && focusRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (focusRef.current) {
            focusRef.current?.focus();
          }
        });
      });
    }
  }, [activeTab]);
  // BMC Code : Accessibility Change ends here.
  return (
    <div className={styles.container} data-testid={testId}>
      {
        // BMC Code : Accessibility Change ( Next 1 line )
      }
      <TabsBar className={styles.tabs} orientationState={orientationState}>
        {tabs.map((t) => (
          <Tab
            key={t.value}
            label={t.label}
            active={t.value === activeTab}
            onChangeTab={() => onSelectTab(t)}
            icon={t.icon}
            // BMC Code : Accessibility Change Next line
            ref={focusRef}
            // BMC Code : Accessibility Change Next 2 lines
            aria-controls={t.tabPanelId}
            id={t.tabId}
          />
        ))}
        <Box grow={1} display="flex" justifyContent="flex-end" paddingRight={1}>
          <IconButton size="lg" onClick={onClose} name="times" tooltip={closeIconTooltip ?? 'Close'} />
        </Box>
      </TabsBar>
      <ScrollContainer>
        <TabContent className={styles.tabContent}>{tabs.find((t) => t.value === activeTab)?.content}</TabContent>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
  }),
  tabContent: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    flex: 1,
  }),
  tabs: css({
    paddingTop: theme.spacing(0.5),
    borderColor: theme.colors.border.weak,
    ul: {
      marginLeft: theme.spacing(2),
    },
  }),
});
