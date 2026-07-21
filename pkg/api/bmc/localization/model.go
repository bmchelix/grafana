package localization

import (
	"errors"
	"slices"
)

type Locale string

// Define supported locale constants
const (
	MAX_ALLOWED_KEYS        = 100
	LocaleENUS       Locale = "en-US"
	LocaleFRFR       Locale = "fr-FR"
	LocaleDEDE       Locale = "de-DE"
	LocaleESES       Locale = "es-ES"
	LocaleENCA       Locale = "en-CA"
	LocaleFRCA       Locale = "fr-CA"
	LocaleITIT       Locale = "it-IT"
	LocaleARAR       Locale = "ar-AR"
	LocalePTBR       Locale = "pt-BR"
	LocaleRURU       Locale = "ru-RU"
	LocaleZHHANS     Locale = "zh-Hans"
	LocaleJAJP       Locale = "ja-JP"
	LocaleKOKR       Locale = "ko-KR"
)

// Typed errors
var (
	ErrInvalidLanguage      = errors.New("invalid language")
	ErrBadRequest           = errors.New("bad request")
	ErrUnexpected           = errors.New("unexpected error")
	ErrExceedMaxAllowedKeys = errors.New("exceeds maximum allowed keys")
	SupportedLanguages      = []Locale{LocaleENUS, LocaleFRFR, LocaleDEDE, LocaleESES, LocaleENCA, LocaleFRCA, LocaleITIT, LocaleARAR, LocalePTBR, LocaleRURU, LocaleZHHANS, LocaleJAJP, LocaleKOKR}
)

func IsSupportedLocale(locale Locale) bool {
	return slices.Contains(SupportedLanguages, locale)
}

type Query struct {
	OrgID       int64
	ResourceUID string
	Lang        string
}

type ResourceLocales struct {
	Name string `json:"name"`
}

type LocalesJSON struct {
	Locales map[Locale]ResourceLocales
}

type GlobalLocales struct {
	Locales map[Locale]map[string]interface{}
}

type GlobalPatch struct {
	Add    map[string]string `json:"add,omitempty"`
	Remove []string          `json:"remove,omitempty"`
}
type UpdateGlobalLocales struct {
	Locales map[Locale]GlobalPatch
}

// Check the length of the keys in the en-US column for global change
type KeyRow struct {
	Keys string `xorm:"'keys'"`
}
