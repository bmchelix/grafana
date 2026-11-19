// BMC Helix code changes start - DRJ71-22513
// TODO: REMOVE BEFORE UPGRADE
// Build tag excludes this file from hdb_no_zanzana production builds (OpenFGA CVE remediation).
//go:build !hdb_no_zanzana
// BMC Helix code changes end - DRJ71-22513

package server

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	claims "github.com/grafana/authlib/types"
)

func authorize(ctx context.Context, namespace string, ss setting.ZanzanaServerSettings) error {
	logger := log.New("zanzana.server.auth")
	if ss.AllowInsecure {
		logger.Debug("AllowInsecure=true; skipping authorization check")
		return nil
	}
	c, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}
	if c.GetNamespace() == "" || namespace == "" {
		return status.Errorf(codes.Unauthenticated, "unauthenticated")
	}
	if !claims.NamespaceMatches(c.GetNamespace(), namespace) {
		return status.Errorf(codes.PermissionDenied, "namespace does not match")
	}
	return nil
}
