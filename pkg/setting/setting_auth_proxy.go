package setting

import (
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

type AuthProxySettings struct {
	// Auth Proxy
	Enabled          bool
	HeaderName       string
	HeaderProperty   string
	AutoSignUp       bool
	EnableLoginToken bool
	Whitelist        string
	Headers          map[string]string
	HeadersEncoded   bool
	SyncTTL          int
	// BMC: login prefix for PPL service accounts (e.g. bmc_ppl_Demo).
	PplLoginPrefix string
}

func (cfg *Cfg) readAuthProxySettings() {
	authProxySettings := AuthProxySettings{}
	authProxy := cfg.Raw.Section("auth.proxy")
	authProxySettings.Enabled = authProxy.Key("enabled").MustBool(false)
	authProxySettings.HeaderName = valueAsString(authProxy, "header_name", "")
	authProxySettings.HeaderProperty = valueAsString(authProxy, "header_property", "")
	authProxySettings.AutoSignUp = authProxy.Key("auto_sign_up").MustBool(true)
	authProxySettings.EnableLoginToken = authProxy.Key("enable_login_token").MustBool(false)
	authProxySettings.SyncTTL = authProxy.Key("sync_ttl").MustInt(15)
	authProxySettings.Whitelist = valueAsString(authProxy, "whitelist", "")
	authProxySettings.Headers = make(map[string]string)
	headers := valueAsString(authProxy, "headers", "")

	for _, propertyAndHeader := range util.SplitString(headers) {
		split := strings.SplitN(propertyAndHeader, ":", 2)
		if len(split) == 2 {
			authProxySettings.Headers[split[0]] = split[1]
		}
	}

	authProxySettings.HeadersEncoded = authProxy.Key("headers_encoded").MustBool(false)
	// BMC: set via deployment env SUPPORT_DEBUGGER_USER_PREFIX.
	authProxySettings.PplLoginPrefix = os.Getenv("SUPPORT_DEBUGGER_USER_PREFIX")
	if authProxySettings.PplLoginPrefix == "" {
		authProxySettings.PplLoginPrefix = "bmc_ppl_"
	}

	cfg.AuthProxy = authProxySettings
}
