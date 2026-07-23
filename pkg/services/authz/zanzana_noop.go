// BMC Helix code changes start - DRJ71-22513
// TODO: REMOVE BEFORE UPGRADE
// HDB production build: noop Zanzana/OpenFGA stubs when hdb_no_zanzana is set.
// Shared types and interfaces are in zanzana_shared.go.
//go:build hdb_no_zanzana

package authz

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zClient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ ZanzanaService = (*Zanzana)(nil)

// ProvideZanzanaClient returns a noop client; OpenFGA is excluded from hdb_no_zanzana builds.
func ProvideZanzanaClient(_ *setting.Cfg, _ db.DB, _ tracing.Tracer, _ featuremgmt.FeatureToggles, _ prometheus.Registerer) (zanzana.Client, error) {
	return zClient.NewNoopClient(), nil
}

// ProvideStandaloneZanzanaClient returns a noop client for secure builds.
func ProvideStandaloneZanzanaClient(_ *setting.Cfg, _ featuremgmt.FeatureToggles) (zanzana.Client, error) {
	return zClient.NewNoopClient(), nil
}

// NewRemoteZanzanaClient returns a noop client when OpenFGA is compiled out.
func NewRemoteZanzanaClient(_ string, _ ZanzanaClientConfig) (zanzana.Client, error) {
	return zClient.NewNoopClient(), nil
}

// ProvideZanzanaService registers a noop Zanzana module for Wire compatibility.
func ProvideZanzanaService(_ *setting.Cfg, _ featuremgmt.FeatureToggles, _ prometheus.Registerer) (*Zanzana, error) {
	s := &Zanzana{}
	s.BasicService = services.NewBasicService(
		func(context.Context) error { return nil },
		func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() },
		func(error) error { return nil },
	).WithName("zanzana")
	return s, nil
}

// Zanzana is a noop standalone Zanzana service for secure builds.
type Zanzana struct {
	*services.BasicService
}

// BMC Helix code changes end - DRJ71-22513
