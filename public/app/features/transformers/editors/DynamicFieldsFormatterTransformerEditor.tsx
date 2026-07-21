import { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerCategory,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { DynamicFieldsFormatterOptions, DynamicFieldsFormatterTransformerOptions } from '@grafana/data/internal';
import { t, Trans } from '@grafana/i18n';
import { Button, InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import darkImage from '../images/dark/dynamicFieldsFormatter.svg';
import lightImage from '../images/light/dynamicFieldsFormatter.svg';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24, isClearable: false },
} as any;

export const DynamicFieldsFormatterTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<DynamicFieldsFormatterTransformerOptions>) => {
  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const formatters = options.formatters;
      formatters[idx] = { ...formatters[idx], targetField: value ?? '' };
      onChange({
        ...options,
        formatters: formatters,
      });
    },
    [onChange, options]
  );

  const onFormatterTypeChange = useCallback(
    (idx: number, value?: 'keyValue' | 'json') => {
      const updatedFormatters = options.formatters.map((formatter, index) =>
        index === idx ? { ...formatter, type: value ?? undefined } : formatter
      );

      onChange({
        ...options,
        formatters: updatedFormatters,
      });
    },
    [onChange, options]
  );

  const onAddDynamicFieldsFormatter = useCallback(() => {
    onChange({
      ...options,
      formatters: [...options.formatters, { targetField: undefined }],
    });
  }, [onChange, options]);

  const onRemoveDynamicFieldsFormatter = useCallback(
    (idx: number) => {
      const removed = options.formatters;
      removed.splice(idx, 1);
      onChange({
        ...options,
        formatters: removed,
      });
    },
    [onChange, options]
  );

  return (
    <>
      {options.formatters.map((c: DynamicFieldsFormatterOptions, idx: number) => {
        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={t('bmc.transformers.dynamic-fields.field-label', 'Field')}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <InlineField label={t('bmc.transformers.dynamic-fields.format-as', 'Format dynamic field as')}>
                <Select
                  value={c.type}
                  options={[
                    { label: 'Key-Value', value: 'keyValue' },
                    { label: 'JSON', value: 'json' },
                  ]}
                  onChange={(item) => onFormatterTypeChange(idx, item.value as any)}
                />
              </InlineField>
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveDynamicFieldsFormatter(idx)}
                aria-label={t(
                  'bmc.transformers.dynamic-fields.remove-aria',
                  'Remove dynamic fields formatter field type transformer'
                )}
              />
            </InlineFieldRow>
          </div>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddDynamicFieldsFormatter}
        variant="secondary"
        aria-label={t('bmc.transformers.dynamic-fields.add-aria', 'Add a field to sanitize')}
      >
        <Trans i18nKey="bmc.transformers.dynamic-fields.add-button">Add field</Trans>
      </Button>
    </>
  );
};

export const getDynamicFieldsFormatterTransformRegistryItem: () => TransformerRegistryItem<DynamicFieldsFormatterTransformerOptions> =
  () => ({
    id: DataTransformerID.dynamicFieldsFormatter,
    editor: DynamicFieldsFormatterTransformerEditor,
    transformation: standardTransformers.dynamicFieldsFormatterTransformer,
    name: standardTransformers.dynamicFieldsFormatterTransformer.name,
    categories: new Set([TransformerCategory.Reformat]),
    description: standardTransformers.dynamicFieldsFormatterTransformer.description,
    imageDark: darkImage,
    imageLight: lightImage,
  });
