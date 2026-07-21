package bmc

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

const (
	// RBAC permission for SQL query type
	servicemanagementQuerytypesSQL = "servicemanagement.querytypes:sql"
)

// EnforceSQLRestrictions validates that the user is not adding or modifying SQL queries
// when they don't have RBAC SQL permissions. Used by both legacy API and K8s admission.
func EnforceSQLRestrictions(newDashboardData *simplejson.Json, existingDashboardData *simplejson.Json) error {
	panels := newDashboardData.Get("panels").MustArray()

	for _, panel := range panels {
		panelObj, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		targets, ok := panelObj["targets"].([]interface{})
		if !ok {
			continue
		}

		for _, target := range targets {
			targetObj, ok := target.(map[string]interface{})
			if !ok {
				continue
			}

			if isSQLQueryJson(targetObj) {
				if existingDashboardData == nil {
					return fmt.Errorf("SQL is restricted for the current user.")
				}

				if !existsInExistingDashboardJson(panelObj, targetObj, existingDashboardData) {
					return fmt.Errorf("SQL is restricted for the current user.")
				}

				existingTarget := getExistingTargetJson(panelObj, targetObj, existingDashboardData)
				if existingTarget != nil && getRawSQLQuery(targetObj) != getRawSQLQuery(existingTarget) {
					return fmt.Errorf("SQL is restricted for the current user.")
				}
			}
		}
	}
	return nil
}

func isSQLQueryJson(target map[string]interface{}) bool {
	datasource, ok := target["datasource"].(map[string]interface{})
	if !ok {
		return false
	}

	sourceType, ok := target["sourceType"].(string)
	if !ok {
		return false
	}

	sourceQuery, ok := target["sourceQuery"].(map[string]interface{})
	if !ok {
		return false
	}

	queryType, ok := sourceQuery["queryType"].(string)
	if !ok {
		return false
	}

	return datasource["type"] == "bmchelix-ade-datasource" && sourceType == "remedy" && queryType == "SQL"
}

func getRawSQLQuery(target map[string]interface{}) string {
	sourceQuery, ok := target["sourceQuery"].(map[string]interface{})
	if !ok {
		return ""
	}
	rawQuery, _ := sourceQuery["rawQuery"].(string)
	return rawQuery
}

func existsInExistingDashboardJson(panel map[string]interface{}, target map[string]interface{}, existingDashboardData *simplejson.Json) bool {
	existingPanels := existingDashboardData.Get("panels").MustArray()

	for _, existingPanel := range existingPanels {
		existingPanelObj, ok := existingPanel.(map[string]interface{})
		if !ok {
			continue
		}

		if existingPanelObj["id"] == panel["id"] {
			existingTargets, ok := existingPanelObj["targets"].([]interface{})
			if !ok {
				continue
			}

			for _, existingTarget := range existingTargets {
				existingTargetObj, ok := existingTarget.(map[string]interface{})
				if !ok {
					continue
				}
				sq, ok := existingTargetObj["sourceQuery"].(map[string]interface{})
				if !ok {
					continue
				}
				qt, _ := sq["queryType"].(string)
				if existingTargetObj["refId"] == target["refId"] && qt == "SQL" {
					return true
				}
			}
		}
	}
	return false
}

func getExistingTargetJson(panel map[string]interface{}, target map[string]interface{}, existingDashboardData *simplejson.Json) map[string]interface{} {
	existingPanels := existingDashboardData.Get("panels").MustArray()

	for _, existingPanel := range existingPanels {
		existingPanelObj, ok := existingPanel.(map[string]interface{})
		if !ok {
			continue
		}

		if existingPanelObj["id"] == panel["id"] {
			existingTargets, ok := existingPanelObj["targets"].([]interface{})
			if !ok {
				continue
			}

			for _, existingTarget := range existingTargets {
				existingTargetObj, ok := existingTarget.(map[string]interface{})
				if !ok {
					continue
				}
				if existingTargetObj["refId"] == target["refId"] {
					return existingTargetObj
				}
			}
		}
	}
	return nil
}

// IsRbacSqlEnabledForRequester checks if the user has SQL permissions via preferences or RBAC.
// Used by K8s admission when ReqContext is not available.
func IsRbacSqlEnabledForRequester(ctx context.Context, user identity.Requester, preferenceService pref.Service) bool {
	orgRole := user.GetOrgRole()
	isOrgAdmin := orgRole == org.RoleAdmin

	isSqlEnabledInDefaultPreferences, isAppliedToAdmins := getPreferencesForRequester(ctx, preferenceService, user)

	if isSqlEnabledInDefaultPreferences {
		return true
	}

	if isAppliedToAdmins {
		return isSqlEnabledInRbacForRequester(user)
	}

	return isOrgAdmin || isSqlEnabledInRbacForRequester(user)
}

func getPreferencesForRequester(ctx context.Context, preferenceService pref.Service, user identity.Requester) (bool, bool) {
	orgID := user.GetOrgID()
	userID := int64(0)
	if id, err := user.GetInternalID(); err == nil {
		userID = id
	}
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: 0}
	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return true, false
	}

	if preference.JSONData == nil {
		return true, false
	}

	enabledTypes := preference.JSONData.EnabledQueryTypes.EnabledTypes
	isSqlEnabled := false
	for _, t := range enabledTypes {
		if t == "SQL" {
			isSqlEnabled = true
			break
		}
	}

	isAppliedForAdmin := preference.JSONData.EnabledQueryTypes.ApplyForAdmin

	return isSqlEnabled, isAppliedForAdmin
}

func isSqlEnabledInRbacForRequester(user identity.Requester) bool {
	userPermissions := user.GetPermissions()
	permissionList, exists := userPermissions[servicemanagementQuerytypesSQL]
	if !exists {
		return false
	}

	for _, permission := range permissionList {
		if strings.HasSuffix(permission, ":*") {
			return true
		}
	}
	return false
}
