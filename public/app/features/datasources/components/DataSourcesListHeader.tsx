import { debounce } from 'lodash';
import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import PageActionBar, { FilterCheckbox } from 'app/core/components/PageActionBar/PageActionBar';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { setDataSourcesSearchQuery, setIsSortAscending } from '../state/reducers';
import { getDataSourcesSearchQuery, getDataSourcesSort } from '../state/selectors';
import { trackDsSearched } from '../tracking';

const ascendingSortValue = 'alpha-asc';
const descendingSortValue = 'alpha-desc';

// BMC code: convert to function to make t function available
const getSortOptions = () => [
  // We use this unicode 'en dash' character (U+2013), because it looks nicer
  // than simple dash in this context. This is also used in the response of
  // the `sorting` endpoint, which is used in the search dashboard page.
  // BMC Change: Next couple lines
  { label: t('bmcgrafana.datesource.configuration.sort-asc', 'Sort by A–Z'), value: ascendingSortValue },
  { label: t('bmcgrafana.datesource.configuration.sort-desc', 'Sort by Z–A'), value: descendingSortValue },
];

export interface DataSourcesListHeaderProps {
  filterCheckbox?: FilterCheckbox;
}

export function DataSourcesListHeader({ filterCheckbox }: DataSourcesListHeaderProps) {
  const dispatch = useDispatch();

  const debouncedTrackSearch = useMemo(
    () =>
      debounce((q) => {
        trackDsSearched({ query: q });
      }, 300),
    []
  );

  const setSearchQuery = useCallback(
    (q: string) => {
      dispatch(setDataSourcesSearchQuery(q));
      if (q) {
        debouncedTrackSearch(q);
      }
    },
    [dispatch, debouncedTrackSearch]
  );
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));

  const setSort = useCallback(
    (sort: SelectableValue) => dispatch(setIsSortAscending(sort.value === ascendingSortValue)),
    [dispatch]
  );
  const isSortAscending = useSelector(({ dataSources }: StoreState) => getDataSourcesSort(dataSources));

  const sortPicker = {
    onChange: setSort,
    value: isSortAscending ? ascendingSortValue : descendingSortValue,
    getSortOptions: () => Promise.resolve(getSortOptions()),
  };

  return (
    <PageActionBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      key="action-bar"
      sortPicker={sortPicker}
      filterCheckbox={filterCheckbox}
    />
  );
}
