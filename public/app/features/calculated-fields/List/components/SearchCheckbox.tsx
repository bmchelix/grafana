import { css } from '@emotion/css';
import { FC, memo } from 'react';

// BMC Code : Accessibility Change ( Next 2 lines )
import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Field, stylesFactory, useTheme2 } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick: any;
  editable?: boolean;
  // BMC Code : Accessibility Change ( Next 3 lines )
  id?: string;
  label?: string;
  description?: string;
}

export const SearchCheckbox: FC<Props> = memo(
  ({ onClick, checked = false, editable = false, id = '', label = '', description = '' }) => {
    // BMC Code : Accessibility Change starts here.
    // using theme for label stying and passing to style function to create class in next 2 lines.
    const theme = useTheme2();
    const styles = getStyles(theme);

    // Added onCheckboxKeyDown function to trigger checkbox on space/enter press.
    const onCheckboxKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
        event.preventDefault();

        onClick(event);
      }
    };
    // BMC Code : Accessibility Change ends here.

    return editable ? (
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        className={styles.wrapper}
      >
        {
          // BMC Code : Accessibility Change starts here.
          // Changed existing checkbox implementation. Added Field component for labels and wrapped checkbox inside it.
        }
        {/* eslint-disable-next-line no-restricted-syntax */}
        <Field
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            marginBottom: '0',
          }}
          label={
            <label htmlFor={id}>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginLeft: '12px',
                  cursor: 'pointer',
                }}
                // BMC Code : Accessibility Change (Next 3 Lines)
                role="checkbox"
                aria-labelledby={`Select ${label}`}
                aria-checked={checked}
              >
                <span className={styles.label} title={label}>{label}</span>
                <span className={styles.description} title={description}>{description}</span>
              </span>
            </label>
          }
        >
          {
            // Added onCheckboxKeyDown event to handle keybaord press. Passed label, id and description for tagging with proper label
          }
          <Checkbox onKeyDown={(event) => onCheckboxKeyDown(event)} name={label} id={id} value={checked} />
        </Field>
        {
          // BMC Code : Accessibility Change ends here.
        }
      </div>
    ) : null;
  }
);
SearchCheckbox.displayName = 'SearchCheckbox';

// BMC Code : Accessibility Change ( Next line )
const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  // Vertically align absolutely positioned checkbox element
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    marginRight: 12,
    flex: '0 0 220px',
    minWidth: 0,
    '& > label': {
      minWidth: 0,
    },
  }),
  // BMC Code : Accessibility Change starts here.
  // Accessibility Change | Added label and description class for styling
  label: css({
    marginRight: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  description: css({
    color: theme.colors.text.maxContrast,
    fontSize: theme.typography.size.xs,
    lineHeight: theme.typography.bodySmall.lineHeight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  // BMC Code : Accessibility Change ends here.
}));
