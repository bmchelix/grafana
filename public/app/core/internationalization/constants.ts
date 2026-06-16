import { ResourceKey } from 'i18next';
import { uniq } from 'lodash';

import {
  ARABIC_ARABIC,
  BRAZILIAN_PORTUGUESE,
  CHINESE_SIMPLIFIED,
  DEFAULT_LANGUAGE,
  ENGLISH_CANADA,
  ENGLISH_US,
  FRENCH_CANADA,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  ITALIAN_ITALY,
  JAPANESE_JAPAN,
  KOREAN_KOREA,
  PSEUDO_LOCALE,
  RUSSIAN_RUSSIA,
  SPANISH_SPAIN,
  LANGUAGES as SUPPORTED_LANGUAGES,
} from '@grafana/i18n';

// BMC code - Filter Grafana languages to only include allowed ones
// Add or remove language codes here to control which Grafana languages are available
const BMC_ALLOWED_LANGUAGE_CODES = [
  ENGLISH_US, // English (US)
  FRENCH_FRANCE, // French (France)
  SPANISH_SPAIN, // Spanish (Spain)
  GERMAN_GERMANY, // German (Germany)
  ITALIAN_ITALY, // Italian (Italy)
  ARABIC_ARABIC, // Arabic (Arabic)
  FRENCH_CANADA, // French (Canada)
  ENGLISH_CANADA, // English (Canada)
  BRAZILIAN_PORTUGUESE, // Portugues (Brazil)
  RUSSIAN_RUSSIA, // Russian (Russia)
  CHINESE_SIMPLIFIED, // Chinese (Simplified)
  JAPANESE_JAPAN, // Japanese (Japan)
  KOREAN_KOREA, // Korean (Korea)
];

const FILTERED_SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES.filter((lang) =>
  BMC_ALLOWED_LANGUAGE_CODES.includes(lang.code)
);

// BMC code - end

export type LocaleFileLoader = () => Promise<ResourceKey>;

export const GRAFANA_NAMESPACE = 'grafana' as const;

type BaseLanguageDefinition = (typeof SUPPORTED_LANGUAGES)[number];
export interface LanguageDefinition<Namespace extends string = string> extends BaseLanguageDefinition {
  /** Function to load translations */
  loader: Record<Namespace, LocaleFileLoader>;
}

// BMC code - Use filtered Grafana languages instead of all
export const LANGUAGES: LanguageDefinition[] = FILTERED_SUPPORTED_LANGUAGES.map((def) => {
  // Load the Default language (en-US) as the pseudo-locale, as it will be post-processed by i18next-pseudo library
  const locale = def.code === PSEUDO_LOCALE ? DEFAULT_LANGUAGE : def.code;
  return {
    ...def,
    loader: { [GRAFANA_NAMESPACE]: () => import(`../../../locales/${locale}/grafana.json`) },
  };
});

// Optionally load enterprise locale extensions, if they are present.
// It is important that this happens before NAMESPACES is defined so it has the correct value
//
// require.context doesn't work in jest, so we don't even attempt to load enterprise translations...
if (process.env.NODE_ENV !== 'test') {
  const extensionRequireContext = require.context('../../', true, /app\/extensions\/locales\/localeExtensions/);
  if (extensionRequireContext.keys().includes('app/extensions/locales/localeExtensions')) {
    const { LOCALE_EXTENSIONS, ENTERPRISE_I18N_NAMESPACE } = extensionRequireContext(
      'app/extensions/locales/localeExtensions'
    );

    for (const language of LANGUAGES) {
      const localeLoader = LOCALE_EXTENSIONS[language.code];

      if (localeLoader) {
        language.loader[ENTERPRISE_I18N_NAMESPACE] = localeLoader;
      }
    }
  }
}

export const VALID_LANGUAGES = LANGUAGES.map((v) => v.code);

export const NAMESPACES = uniq(LANGUAGES.flatMap((v) => Object.keys(v.loader)));

// BMC change - Locale constants
export const DashFolderLinkRegexp = /\/[df]\/([a-zA-Z0-9\_\-]+)(?!.*editview=)/;
