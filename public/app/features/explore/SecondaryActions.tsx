import { css } from '@emotion/css';
// BMC Code : Accessibility Change ( Next 1 lines )
import { useState, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { ToolbarButton, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useQueriesDrawerContext } from './QueriesDrawer/QueriesDrawerContext';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickQueryInspectorButton: () => void;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
  };
};

export function SecondaryActions(props: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { drawerOpened, setDrawerOpened, queryLibraryAvailable } = useQueriesDrawerContext();

  // When queryLibraryAvailable=true we show the button in the toolbar (see QueriesDrawerDropdown)
  const showHistoryButton = !props.richHistoryRowButtonHidden && !queryLibraryAvailable;

  // BMC Code : Accessibility Change starts here.  | added useRef for query row & focus after adding query
  const [addedQuery, setAddedQuery] = useState(false);
  const [queryCount, setQueryCount] = useState('A');
  const addQueryButtonRef = useRef<HTMLButtonElement>(null);

  const onClickAddQueryRowButton = () => {
    props.onClickAddQueryRowButton();
    setAddedQuery(true);
    setQueryCount((prevCount) => {
      const nextLetter = prevCount.charCodeAt(0) + 1;
      return nextLetter > 90 ? 'A' : String.fromCharCode(nextLetter);
    });
  };

  // BMC Code : Accessibility Change ends here.

  return (
    <div className={styles.containerMargin}>
      {
        // BMC Code : Accessibility Change starts here. | screen reader announcement hidden div
      }
      <div aria-live="polite" className="sr-only" id={`queryCount-${queryCount}`}>
        {addedQuery && (
          <Trans i18nKey="bmcgrafana.explore.query-added-announcement">New Query Row Added. {queryCount}</Trans>
        )}
      </div>
      {
        // BMC Code : Accessibility Change ends here.
      }
      {!props.addQueryRowButtonHidden && (
        <ToolbarButton
          variant="canvas"
          aria-label={t('explore.secondary-actions.query-add-button-aria-label', 'Add query')}
          // BMC Code : modified onClick handler.
          onClick={onClickAddQueryRowButton}
          disabled={props.addQueryRowButtonDisabled}
          icon="plus"
          // BMC Code : useRef & tabInex added.
          ref={addQueryButtonRef}
          tabIndex={0}
        >
          <Trans i18nKey="explore.secondary-actions.query-add-button">Add query</Trans>
        </ToolbarButton>
      )}
      {showHistoryButton && (
        <ToolbarButton
          variant={drawerOpened ? 'active' : 'canvas'}
          aria-label={t('explore.secondary-actions.query-history-button-aria-label', 'Query history')}
          onClick={() => setDrawerOpened(!drawerOpened)}
          data-testid={Components.QueryTab.queryHistoryButton}
          icon="history"
        >
          <Trans i18nKey="explore.secondary-actions.query-history-button">Query history</Trans>
        </ToolbarButton>
      )}
      <ToolbarButton
        variant={props.queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={props.onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
    </div>
  );
}
