import { useEffect } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';

import { calcFieldsSrv } from '../../../../core/services/calcFields_srv';
import { CalcFieldModule, OnDeleteItems, UseSearch } from '../../types';
import { clearDsInstanceUrl, handleCalcFieldResponse, setDsInstanceUrl } from '../../utils';
import { FETCH_RESULTS, LOAD_END, SEARCH_START, TOGGLE_SECTION } from '../reducers/actionTypes';

/**
 * Base hook for search functionality.
 * Returns state and dispatch, among others, from 'reducer' param, so it can be
 * further extended.
 * @param query
 * @param reducer - return result of useReducer
 * @param params - custom params
 */
export const useSearch: UseSearch = (query, reducer, queryDispatch) => {
  // erase session data on component mount
  useEffect(() => {
    clearDsInstanceUrl();
  }, []);

  const [state, dispatch] = reducer;

  const search = async () => {
    dispatch({ type: SEARCH_START });
    calcFieldsSrv
      .getFields(query.dsInstanceUrl)
      .then((response: any) => {
        if (response.err) {
          return queryDispatch.onErrChange?.(response.err);
        }
        const results = handleCalcFieldResponse(response.results, query.layout);
        setDsInstanceUrl(response.dsInstanceUrl);
        queryDispatch.onDSInstanceUrlChange(response.dsInstanceUrl);
        dispatch({ type: FETCH_RESULTS, payload: results });
      })
      .catch((e: any) => {
        queryDispatch.onErrChange?.(t('bmc.calc-fields.failed', 'Failed to get calculated fields'));
      })
      .finally(() => {
        dispatch({ type: LOAD_END });
      });
  };

  // Set loading state before debounced search
  useEffect(() => {
    dispatch({ type: SEARCH_START });
  }, [dispatch, query.layout]);

  useDebounce(search, 50, [query.layout]);

  const onToggleSection = (section: CalcFieldModule) => {
    dispatch({ type: TOGGLE_SECTION, payload: section });
  };

  const onDeleteItems: OnDeleteItems = async (fields: number[]) => {
    return calcFieldsSrv.deleteFields(fields).then(() => {
      search();
    });
  };

  return { state, dispatch, onToggleSection, onDeleteItems };
};
