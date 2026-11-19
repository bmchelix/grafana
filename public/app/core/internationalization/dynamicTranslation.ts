import { t as runtimeT } from '@grafana/i18n';

/**
 * Wrapper around the standard t() that i18next-parser ignores.
 * Use it for runtime-only keys (for example, ones built from IDs)
 * so that extraction does not warn about template literals.
 */
export function translateDynamicKey(key: string, defaultMessage: string, values?: Record<string, unknown>) {
  return runtimeT(key, defaultMessage, values);
}
