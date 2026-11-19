// BMC Helix code changes start - DRJ71-22513
// TODO: REMOVE BEFORE UPGRADE
// Shared Zanzana types for zanzana.go and zanzana_noop.go after splitting
// OpenFGA vs noop builds (OpenFGA CVE remediation).

package authz

import "github.com/grafana/dskit/services"

// ZanzanaClientConfig holds connection settings for a remote Zanzana server.
type ZanzanaClientConfig struct {
	URL              string
	Token            string
	TokenExchangeURL string
	ServerCertFile   string
}

// ZanzanaService is the standalone Zanzana module service interface.
type ZanzanaService interface {
	services.NamedService
}

// BMC Helix code changes end - DRJ71-22513
