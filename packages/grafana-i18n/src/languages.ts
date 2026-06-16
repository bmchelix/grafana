import {
  ARABIC_ARABIC,
  BRAZILIAN_PORTUGUESE,
  CHINESE_SIMPLIFIED,
  CHINESE_TRADITIONAL,
  CZECH_CZECHIA,
  DUTCH_NETHERLANDS,
  ENGLISH_CANADA,
  ENGLISH_US,
  FRENCH_CANADA,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  HUNGARIAN_HUNGARY,
  INDONESIAN_INDONESIA,
  ITALIAN_ITALY,
  JAPANESE_JAPAN,
  KOREAN_KOREA,
  POLISH_POLAND,
  PORTUGUESE_PORTUGAL,
  RUSSIAN_RUSSIA,
  SPANISH_SPAIN,
  SWEDISH_SWEDEN,
  TURKISH_TURKEY,
} from './constants';

interface TranslationDefinition {
  /** IETF language tag */
  code: string;

  /** The language name in its own language (e.g. "Français" for French) */
  name: string;
}

/**
 * Supported languages for translation.
 */
// BMC code: mark preview locales with (Beta) in the display name (used for UI sort order)
export const LANGUAGES: TranslationDefinition[] = [
  { code: ENGLISH_US, name: 'English' },
  { code: FRENCH_FRANCE, name: 'Français' },
  { code: SPANISH_SPAIN, name: 'Español' },
  { code: GERMAN_GERMANY, name: 'Deutsch' },
  { code: CHINESE_SIMPLIFIED, name: '中文（简体）(Beta)' },
  { code: BRAZILIAN_PORTUGUESE, name: 'Português Brasileiro' },
  { code: CHINESE_TRADITIONAL, name: '中文（繁體）' },
  { code: ITALIAN_ITALY, name: 'Italiano' },
  { code: JAPANESE_JAPAN, name: '日本語 (Beta)' },
  { code: INDONESIAN_INDONESIA, name: 'Bahasa Indonesia' },
  { code: KOREAN_KOREA, name: '한국어 (Beta)' },
  { code: RUSSIAN_RUSSIA, name: 'Русский (Beta)' },
  { code: CZECH_CZECHIA, name: 'Čeština' },
  { code: DUTCH_NETHERLANDS, name: 'Nederlands' },
  { code: HUNGARIAN_HUNGARY, name: 'Magyar' },
  { code: PORTUGUESE_PORTUGAL, name: 'Português' },
  { code: POLISH_POLAND, name: 'Polski' },
  { code: SWEDISH_SWEDEN, name: 'Svenska' },
  { code: TURKISH_TURKEY, name: 'Türkçe' },
  // BMC code - Additional languages
  { code: FRENCH_CANADA, name: 'Français (Canada)' },
  { code: ENGLISH_CANADA, name: 'English (Canada)' },
  { code: ARABIC_ARABIC, name: 'العربية' },
  // BMC code - end
];
