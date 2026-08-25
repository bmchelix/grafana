package dashboard

import (
	"context"
	"encoding/json"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/api/bmc/localization"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DashboardStorage struct {
	Access           legacy.DashboardAccess
	DashboardService dashboards.DashboardService
	// BMC code: added SQLStore
	SQLStore db.DB
}

func (s *DashboardStorage) NewStore(dash utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter, reg prometheus.Registerer, permissions dashboards.PermissionsRegistrationService, ac types.AccessClient) (grafanarest.Storage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      s.Access,
		Reg:          reg,
		AccessClient: ac,
	})
	if err != nil {
		return nil, err
	}

	defaultOpts, err := defaultOptsGetter.GetRESTOptions(dash.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	client := legacy.NewDirectResourceClient(server) // same context
	optsGetter := apistore.NewRESTOptionsGetterForClient(client, nil,
		defaultOpts.StorageConfig.Config, nil,
	)
	optsGetter.RegisterOptions(dash.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
		Permissions:                 permissions.SetDefaultPermissionsAfterCreate,
	})

	store, err := grafanaregistry.NewRegistryStore(scheme, dash, optsGetter)
	return &storeWrapper{
		Store:            store,
		DashboardService: s.DashboardService,
		// BMC code: added SQLStore
		SQLStore: s.SQLStore,
	}, err
}

type storeWrapper struct {
	*registry.Store
	DashboardService dashboards.DashboardService
	// BMC code: added SQLStore
	SQLStore db.DB
}

// Create will create the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx = legacy.WithLegacyAccess(ctx)

	obj, err := s.Store.Create(ctx, obj, createValidation, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.DashboardID > 0 {
		meta, _ := utils.MetaAccessor(obj)
		if meta != nil {
			// skip the linter error for deprecated function
			meta.SetDeprecatedInternalID(access.DashboardID) //nolint:staticcheck
		}
	}
	meta, metaErr := utils.MetaAccessor(obj)
	if metaErr == nil {
		// Reconstruct the same UID as done at the storage level
		// https://github.com/grafana/grafana/blob/a84e96fba29c3a1bb384fdbad1c9c658cc79ec8f/pkg/registry/apis/dashboard/legacy/sql_dashboards.go#L287
		// This is necessary because the UID generated during the creation via legacy storage is actually never stored in the database
		// and the one returned here is wrong.
		meta.SetUID(gapiutil.CalculateClusterWideUID(obj))
	}

	if err != nil {
		return obj, err
	}

	if metaErr != nil {
		return obj, metaErr
	}

	// BMC code: next line
	s.runLocalizationHook(ctx, obj)
	return obj, nil
}

// Update will update the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx = legacy.WithLegacyAccess(ctx)
	obj, created, err := s.Store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.DashboardID > 0 {
		meta, _ := utils.MetaAccessor(obj)
		if meta != nil {
			// skip the linter error for deprecated function
			meta.SetDeprecatedInternalID(access.DashboardID) //nolint:staticcheck
		}
	}
	// BMC code: start
	if err == nil {
		s.runLocalizationHook(ctx, obj)
	}
	// BMC code: end
	return obj, created, err
}

// BMC code: next method
// runLocalizationHook runs localization.UpdateLocalesJSON when FeatureFlagBHDLocalization is enabled.
func (s *storeWrapper) runLocalizationHook(ctx context.Context, obj runtime.Object) {
	if s.SQLStore == nil {
		return
	}
	user, reqErr := identity.GetRequester(ctx)
	if reqErr != nil || user == nil {
		return
	}
	if !external.FeatureFlagBHDLocalization.EnabledForOrg(user.GetOrgID(), user.GetIsGrafanaAdmin()) {
		return
	}
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}
	spec, err := accessor.GetSpec()
	if err != nil {
		return
	}
	specData, err := json.Marshal(spec)
	if err != nil {
		return
	}
	dash, err := simplejson.NewJson(specData)
	if err != nil {
		return
	}
	localesJson := localization.ExtractLocalesFromJSON(dash)
	if len(localesJson.Locales) == 0 {
		return
	}
	query := localization.Query{OrgID: user.GetOrgID(), ResourceUID: accessor.GetName()}
	localization.UpdateLocalesJSON(ctx, s.SQLStore.WithTransactionalDbSession, query, localesJson)
}
