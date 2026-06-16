import { cloneDeep } from 'lodash';
import { useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

import { getEnrichedHelpItem } from '../MegaMenu/utils';

export function useHelpNode(): NavModelItem | undefined {
  const navIndex = useSelector((state) => state.navIndex);
  // BMC Change: read configurableLinks from Redux and pass to getEnrichedHelpItem
  const configurableLinks = useSelector((state) => state.dashboard.configurableLinks);

  const helpNode = useMemo(() => {
    const helpNode = cloneDeep(navIndex['help']);
    // BMC change: pass configurableLinks to getEnrichedHelpItem
    return helpNode ? getEnrichedHelpItem(helpNode, configurableLinks) : undefined;
  }, [navIndex, configurableLinks]);

  return helpNode;
}
