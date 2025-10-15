import {
  ENGLISH_CANADA,
  ENGLISH_US,
  FRENCH_CANADA,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  LANGUAGES,
  SPANISH_SPAIN,
} from 'app/core/internationalization/constants';

type keyValPair = { [key: string]: string };

export type LanguageCode =
  | typeof ENGLISH_US
  | typeof ENGLISH_CANADA
  | typeof FRENCH_CANADA
  | typeof FRENCH_FRANCE
  | typeof SPANISH_SPAIN
  | typeof GERMAN_GERMANY;

export type DashboardLocale = {
  [key in LanguageCode]: keyValPair;
} & {
  default: keyValPair;
};

export const LanguageOptions = () => {
  return LANGUAGES.map((l) => {
    return { label: l.name, value: l.code };
  });
};

export const initializeDashboardLocale = () => {
  const locale: DashboardLocale = {
    default: {},
    'en-US': {},
    'en-CA': {},
    'de-DE': {},
    'es-ES': {},
    'fr-CA': {},
    'fr-FR': {},
  };
  return locale;
};

export const initializeGlobalLocale = (): DashboardLocale => {
  const locale: any = initializeDashboardLocale();
  delete locale.default;
  return locale;
};
