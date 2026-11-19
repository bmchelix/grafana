package authn

import "strings"

// DefaultBmcPplLoginPrefix is used when SUPPORT_DEBUGGER_USER_PREFIX is not set.
const DefaultBmcPplLoginPrefix = "bmc_ppl_"

// IsBmcPplLogin reports whether login belongs to a BMC PPL service account.
// prefix comes from SUPPORT_DEBUGGER_USER_PREFIX (Helm envMap.env).
// Logins may be plain ("bmc_ppl_Demo") or tenant-qualified ("bmc_ppl_Demo@tenant");
// only the portion before "@" is checked.
func IsBmcPplLogin(login, prefix string) bool {
	login = strings.TrimSpace(login)
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		prefix = DefaultBmcPplLoginPrefix
	}
	loginPrefix := login
	if idx := strings.Index(login, "@"); idx > 0 {
		loginPrefix = login[:idx]
	}
	// Be tolerant to upstream case differences (headers, IdP, etc.).
	return strings.HasPrefix(strings.ToLower(loginPrefix), strings.ToLower(prefix))
}
