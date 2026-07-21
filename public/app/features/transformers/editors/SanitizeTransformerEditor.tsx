import { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { SanitizeFieldOptions, SanitizeFieldTransformerOptions } from '@grafana/data/internal';
import { t, Trans } from '@grafana/i18n';
import { Button, InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import darkImage from '../images/dark/sanitizeFunctions.svg';
import lightImage from '../images/light/sanitizeFunctions.svg';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24, isClearable: false },
} as any;

export const SanitizeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SanitizeFieldTransformerOptions>) => {
  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const sanitizers = options.sanitizers;
      sanitizers[idx] = { ...sanitizers[idx], targetField: value ?? '' };
      onChange({
        ...options,
        sanitizers: sanitizers,
      });
    },
    [onChange, options]
  );

  const onAddSanitizeField = useCallback(() => {
    onChange({
      ...options,
      sanitizers: [...options.sanitizers, { targetField: undefined }],
    });
  }, [onChange, options]);

  const onRemoveSanitizeField = useCallback(
    (idx: number) => {
      const removed = options.sanitizers;
      removed.splice(idx, 1);
      onChange({
        ...options,
        sanitizers: removed,
      });
    },
    [onChange, options]
  );

  return (
    <>
      {options.sanitizers.map((c: SanitizeFieldOptions, idx: number) => {
        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={t('bmc.transformers.sanitize.field-label', 'Field')}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveSanitizeField(idx)}
                aria-label={t('bmc.transformers.sanitize.remove-aria', 'Remove sanitize field type transformer')}
              />
            </InlineFieldRow>
          </div>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddSanitizeField}
        variant="secondary"
        aria-label={t('bmc.transformers.sanitize.add-aria', 'Add a field to sanitize')}
      >
        <Trans i18nKey="bmc.transformers.sanitize.add-button">Add field</Trans>
      </Button>
    </>
  );
};

export const getSanitizeFieldTransformRegistryItem: () => TransformerRegistryItem<SanitizeFieldTransformerOptions> =
  () => ({
    id: DataTransformerID.sanitizeFunctions,
    editor: SanitizeTransformerEditor,
    transformation: standardTransformers.sanitizeFieldTransformer,
    name: standardTransformers.sanitizeFieldTransformer.name,
    description: standardTransformers.sanitizeFieldTransformer.description,
    imageDark: darkImage,
    imageLight: lightImage,
  });
