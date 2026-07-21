// BMC file
package dashboard

import (
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/runtime"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/bmc"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

// ValidateSQLRestrictionsForAdmission validates SQL restrictions for dashboard create/update in K8s admission.
// Returns an error if the user lacks SQL permissions and the dashboard contains restricted SQL queries.
func ValidateSQLRestrictionsForAdmission(
	ctx context.Context,
	obj runtime.Object,
	oldObj runtime.Object,
	user identity.Requester,
	preferenceService pref.Service,
	dashboardService dashboards.DashboardService,
) error {
	if bmc.IsRbacSqlEnabledForRequester(ctx, user, preferenceService) {
		return nil
	}

	newData, err := specToSimpleJSON(obj)
	if err != nil {
		return err
	}

	var existingData *simplejson.Json
	if oldObj != nil {
		existingData, err = specToSimpleJSON(oldObj)
		if err != nil {
			return err
		}
	} else {
		// For create, check if UID exists and fetch existing dashboard from store
		accessor, err := utils.MetaAccessor(obj)
		if err == nil && accessor.GetName() != "" {
			nsInfo, nsErr := authlib.ParseNamespace(accessor.GetNamespace())
			if nsErr == nil {
				existing, fetchErr := dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
					UID:   accessor.GetName(),
					OrgID: nsInfo.OrgID,
				})
				if fetchErr == nil && existing != nil && existing.Data != nil {
					existingData = existing.Data
				}
			}
		}
	}

	return bmc.EnforceSQLRestrictions(newData, existingData)
}

func specToSimpleJSON(obj runtime.Object) (*simplejson.Json, error) {
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	spec, err := accessor.GetSpec()
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(spec)
	if err != nil {
		return nil, err
	}

	return simplejson.NewJson(data)
}
