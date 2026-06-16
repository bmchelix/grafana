package dashboard

import (
	"context"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourceIndexProvider struct {
	datasourceService datasources.DataSourceService
}

// Index builds a datasource index from org-scoped datasources (see grafana/grafana#113911).
// Namespace in context determines OrgID via NamespaceInfoFrom.
func (d *datasourceIndexProvider) Index(ctx context.Context) *schemaversion.DatasourceIndex {
	ctx, span := tracing.Start(ctx, "dashboard.datasource_index.build")
	defer span.End()

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		span.SetAttributes(attribute.String("error", "namespace_info_not_available"))
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	span.SetAttributes(attribute.Int64("org_id", nsInfo.OrgID))

	query := datasources.GetDataSourcesQuery{OrgID: nsInfo.OrgID}
	dataSources, err := d.datasourceService.GetDataSources(ctx, &query)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		_ = tracing.Error(span, err)
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	span.SetAttributes(attribute.Int("datasources.count", len(dataSources)))

	index := &schemaversion.DatasourceIndex{
		ByName: make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
		ByUID:  make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
	}

	for _, ds := range dataSources {
		dsInfo := &schemaversion.DataSourceInfo{
			Name:       ds.Name,
			UID:        ds.UID,
			ID:         ds.ID,
			Type:       ds.Type,
			Default:    ds.IsDefault,
			APIVersion: ds.APIVersion,
		}
		if ds.Name != "" {
			index.ByName[ds.Name] = dsInfo
		}
		if ds.UID != "" {
			index.ByUID[ds.UID] = dsInfo
		}
		if ds.IsDefault {
			index.DefaultDS = dsInfo
		}
	}

	return index
}
