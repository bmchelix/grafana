/**
 * This file is used to share internal grafana/data code with Grafana core.
 * Note that these exports are also used within Enterprise.
 *
 * Through the exports declared in package.json we can import this code in core Grafana and the grafana/data
 * package will continue to be able to access all code when it's published to npm as it's private to the package.
 *
 * During the yarn pack lifecycle the exports[./internal] property is deleted from the package.json
 * preventing the code from being importable by plugins or other npm packages making it truly "internal".
 *
 */

export { actionsOverrideProcessor } from '../field/overrides/processors';
export { compareValues } from '../transformations/matchers/compareValues';
export {
  CalculateFieldMode,
  checkBinaryValueType,
  defaultWindowOptions,
  getNameFromOptions,
  WindowAlignment,
  WindowSizeMode,
  type BinaryOptions,
  type BinaryValue,
  type CalculateFieldTransformerOptions,
  type CumulativeOptions,
  type ReduceOptions,
  type UnaryOptions,
  type WindowOptions,
} from '../transformations/transformers/calculateField';
export { ConcatenateFrameNameMode, type ConcatenateTransformerOptions } from '../transformations/transformers/concat';
export {
  convertFieldType,
  type ConvertFieldTypeOptions,
  type ConvertFieldTypeTransformerOptions,
} from '../transformations/transformers/convertFieldType';
export { FrameType, type ConvertFrameTypeTransformerOptions } from '../transformations/transformers/convertFrameType';
export {
  getMatcherConfig,
  type FilterFieldsByNameTransformerOptions,
} from '../transformations/transformers/filterByName';
export { type FilterFramesByRefIdTransformerOptions } from '../transformations/transformers/filterByRefId';
export {
  FilterByValueMatch,
  FilterByValueType,
  type FilterByValueFilter,
  type FilterByValueTransformerOptions,
} from '../transformations/transformers/filterByValue';
export { FormatStringOutput, type FormatStringTransformerOptions } from '../transformations/transformers/formatString';
export { type FormatTimeTransformerOptions } from '../transformations/transformers/formatTime';
export {
  GroupByOperationID,
  type GroupByFieldOptions,
  type GroupByTransformerOptions,
} from '../transformations/transformers/groupBy';
export {
  SHOW_NESTED_HEADERS_DEFAULT,
  type GroupToNestedTableTransformerOptions,
} from '../transformations/transformers/groupToNestedTable';
export { histogramFieldInfo, type HistogramTransformerInputs } from '../transformations/transformers/histogram';
export { DataTransformerID } from '../transformations/transformers/ids';
export { JoinMode, type JoinByFieldOptions } from '../transformations/transformers/joinByField';
export {
  isLikelyAscendingVector,
  maybeSortFrame,
  NULL_EXPAND,
  NULL_REMOVE,
  NULL_RETAIN,
} from '../transformations/transformers/joinDataFrames';
export {
  LabelsToFieldsMode,
  labelsToFieldsTransformer,
  type LabelsToFieldsOptions,
} from '../transformations/transformers/labelsToFields';
export { type LimitTransformerOptions } from '../transformations/transformers/limit';
export { type MergeTransformerOptions } from '../transformations/transformers/merge';
export { noopTransformer } from '../transformations/transformers/noop';
export { applyNullInsertThreshold } from '../transformations/transformers/nulls/nullInsertThreshold';
export { nullToUndefThreshold } from '../transformations/transformers/nulls/nullToUndefThreshold';
export {
  createOrderFieldsComparer,
  Order,
  OrderByMode,
  OrderByType,
  type OrderByItem,
} from '../transformations/transformers/order';
export {
  organizeFieldsTransformer,
  type OrganizeFieldsTransformerOptions,
} from '../transformations/transformers/organize';
export { ReduceTransformerMode, type ReduceTransformerOptions } from '../transformations/transformers/reduce';
export { type RenameByRegexTransformerOptions } from '../transformations/transformers/renameByRegex';
export { type SeriesToRowsTransformerOptions } from '../transformations/transformers/seriesToRows';
export {
  sortByTransformer,
  type SortByField,
  type SortByTransformerOptions,
} from '../transformations/transformers/sortBy';
export { type TransposeTransformerOptions } from '../transformations/transformers/transpose';
export { mockTransformationsRegistry } from '../utils/tests/mockTransformationsRegistry';

export { getThemeById } from '../themes/registry';
export * as experimentalThemeDefinitions from '../themes/themeDefinitions';
export { mergeTransformer } from '../transformations/transformers/merge';
export { GrafanaEdition } from '../types/config';
export { SIPrefix } from '../valueFormats/symbolFormatters';

export { type PluginAddedLinksConfigureFunc, type PluginExtensionEventHelpers } from '../types/pluginExtensions';

export { getStreamingFrameOptions } from '../dataframe/StreamingDataFrame';
export { fieldIndexComparer } from '../field/fieldComparers';
export { findNumericFieldMinMax } from '../field/fieldOverrides';
export { decoupleHideFromState } from '../field/fieldState';
export { type PanelOptionsSupplier } from '../panel/PanelPlugin';
export { sanitize, sanitizeUrl } from '../text/sanitize';
export { isNestedPanelOptions, type NestedPanelOptions, type NestedValueAccess } from '../utils/OptionsUIBuilders';
// BMC code: next exports
export { AdvFuncList, type AdvFuncTransformerOptions } from '../transformations/transformers/advanceFunctions';
export {
  type DynamicFieldsFormatterOptions,
  type DynamicFieldsFormatterTransformerOptions,
} from '../transformations/transformers/dynamicFieldsFormatter';
export {
  type SanitizeFieldOptions,
  type SanitizeFieldTransformerOptions,
} from '../transformations/transformers/sanitizeField';
export { EnclosureMode, NewlineMode } from '../utils/csvOptions';
export { detectScript, isMultilingualPdfEnabled } from '../utils/scriptUtils';
