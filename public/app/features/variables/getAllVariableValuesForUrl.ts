import { ScopedVars, UrlQueryMap } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { variableAdapters } from './adapters';
import { VARIABLE_PREFIX } from './constants';

export function getVariablesUrlParams(scopedVars?: ScopedVars): UrlQueryMap {
  const params: UrlQueryMap = {};
  const variables = getTemplateSrv().getVariables();

  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i];
    const scopedVar = scopedVars && scopedVars[variable.name];

    if (variable.skipUrlSync) {
      continue;
    }

    if (scopedVar) {
      params[VARIABLE_PREFIX + variable.name] = scopedVar.value;
    } else {
      // BMC code start
      // TODO: Revert to Grafana code once we have upgraded plugins
      // params[VARIABLE_PREFIX + variable.name] = variableAdapters.get(variable.type).getValueForUrl(variable);
      const adapter = variableAdapters.getIfExists(variable.type);
      if (adapter) {
        params[VARIABLE_PREFIX + variable.name] = adapter.getValueForUrl(variable);
      }
      // Skip variable types not in the legacy registry (e.g. switch from dashboard-scene)
      // BMC code end
    }
  }

  return params;
}
