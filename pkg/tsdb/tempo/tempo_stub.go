// BMC Helix code changes start - DRJ71-23070
// TODO: REMOVE BEFORE UPGRADE
// hdb_no_tempo build: provides a minimal Tempo service stub so Grafana compiles
// without Tempo backend/frontend functionality. All query/health/resource calls
// return a controlled "disabled in secure build" response.
//go:build hdb_no_tempo

package tempo

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const tempoDisabledMessage = "tempo datasource disabled in secure build"

var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CheckHealthHandler  = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
)

type Service struct{}

func ProvideService(_ *httpclient.Provider, _ trace.Tracer) *Service {
	return &Service{}
}

func (s *Service) QueryData(_ context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, backend.DownstreamError(errors.New(tempoDisabledMessage))
}

func (s *Service) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: tempoDisabledMessage,
	}, nil
}

func (s *Service) CallResource(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return sender.Send(&backend.CallResourceResponse{
		Status:  503,
		Body:    []byte(tempoDisabledMessage),
		Headers: map[string][]string{"Content-Type": {"text/plain; charset=utf-8"}},
	})
}
// BMC Helix code changes end - DRJ71-23070
