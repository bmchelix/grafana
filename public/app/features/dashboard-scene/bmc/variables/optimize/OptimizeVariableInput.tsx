import { css, cx } from '@emotion/css';

import { OptimizeVariableModel } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { sharedInputStyle, useTheme2 } from '@grafana/ui';
import { OptimizeVariablePickerUnconnected } from 'app/features/variables/optimize/OptimizeVariablePicker';

import { OptimizeVariable } from './OptimizeVariable';

export function OptimizeVariableInput({ model }: SceneComponentProps<OptimizeVariable>) {
  const optimizeVariableState = model.useState();
  const theme = useTheme2();
  return (
    <div
      className={cx(
        sharedInputStyle(theme),
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: theme.spacing(theme.components.height.md),
          paddingRight: 0,
        })
      )}
    >
      <OptimizeVariablePickerUnconnected
        variable={optimizeVariableState as unknown as OptimizeVariableModel}
        filterondescendant={optimizeVariableState.filterondescendant}
        readOnly={false}
      />
    </div>
  );
}
