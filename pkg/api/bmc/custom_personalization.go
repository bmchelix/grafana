package bmc

import (
	"context"
	"net/http"

	plugin "github.com/grafana/grafana/pkg/api/bmc/custom_personalization"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

func (p *PluginsAPI) GetCustomPersonalization(c *contextmodel.ReqContext) response.Response {
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		return response.Error(http.StatusBadRequest, "Bad request data", nil)
	}

	_, err := p.dashSvc.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{
		UID:   dashUID,
		OrgID: c.OrgID,
	})
	if err != nil {
		return response.Error(http.StatusNotFound, err.Error(), err)
	}

	query := &models.GetCustomDashPersonalization{
		OrgID:   c.OrgID,
		UserID:  c.UserID,
		DashUID: dashUID,
	}
	if err := p.store.GetDashPersonalization(c.Req.Context(), query); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get personalized data", err)
	}

	return response.JSON(200, query.Result)
}

func (p *PluginsAPI) SaveCustomPersonalization(c *contextmodel.ReqContext) response.Response {
	cmd := plugin.CustomDashPersonalizationDTO{}

	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		return response.Error(http.StatusBadRequest, "Bad request data", nil)
	}

	if _, err := p.dashSvc.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{
		UID:   dashUID,
		OrgID: c.OrgID,
	}); err != nil {
		return response.Error(http.StatusNotFound, err.Error(), err)
	}

	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}

	query := &models.SaveCustomDashPersonalization{
		Data:    cmd.Data,
		OrgID:   c.OrgID,
		UserID:  c.UserID,
		DashUID: dashUID,
	}
	p.store.SaveDashPersonalization(c.Req.Context(), query)
	return response.JSON(200, query)
}

func (p *PluginsAPI) DeleteVariableCache(c *contextmodel.ReqContext) response.Response {
	dashboardUID := web.Params(c.Req)[":uid"]
	variableName := c.Req.Header.Get(pluginproxy.BhdVariableNameHeader)
	// This boolean decides whether we delete cache for just one user's cache entry or the cache entries of every user for that variable
	// Deleting cache entries of every user for a particular variable is useful in cases such like when variable is deleted from dashboard
	// When variable query is changed, the entire existing cache for that variable becomes meaningless for all users and we don't want every user having to go click refresh.
	// So this API can be called when variable query is changed too
	// If header is absent, we use a sane default and just delete for that particular user
	deleteAllEntriesForVariable := c.Req.Header.Get(pluginproxy.BhdVariableChangedFlag) == "true"

	plugin.Log.Info("received request to delete variable caches", "dashboardUID", dashboardUID, "variableName", variableName, "requestingUser", c.UserID, "deleteAllEntriesForVariable", deleteAllEntriesForVariable)

	if variableName != "" && dashboardUID != "" {
		if deleteAllEntriesForVariable {
			go pluginproxy.DeleteVariableCache(c.OrgID, dashboardUID, variableName)
			return response.Respond(http.StatusCreated, "Cache entries queued for deletion successfully")
		} else {
			if pluginproxy.DeleteVariableCacheForUser(c.OrgID, dashboardUID, variableName, c.UserID) {
				return response.Respond(http.StatusOK, "Variable cache deleted successfully")
			} else {
				return response.Respond(http.StatusInternalServerError, "Could not delete cache for variable "+variableName)
			}
		}
	} else {
		return response.Respond(http.StatusBadRequest, "cannot pass empty variable name or dashboard UID")
	}

}

func (p *PluginsAPI) DeleteDashPersonalization(c *contextmodel.ReqContext) response.Response {
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		return response.Error(http.StatusBadRequest, "Bad request data", nil)
	}

	query := &models.DeleteCustomDashPersonalization{
		OrgID:   c.OrgID,
		UserID:  c.UserID,
		DashUID: dashUID,
	}

	if err := p.store.DeleteDashPersonalization(c.Req.Context(), query); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete personalized data", err)
	}
	return response.Success("Personalized data deleted")
}

func SetupCustomPersonalization(sqlStore *sqlstore.SQLStore, ctx context.Context, dto *dtos.DashboardFullWithMeta, orgId, userId int64, uid string) {
	ApplyPersonalization(sqlStore, ctx, dto.Dashboard, orgId, userId, uid)
}

// ApplyPersonalization applies user-specific dash personalization (time, variables) to dashboard JSON.
// Used by both legacy API and K8s DTO path. Modifies dashboardData in place.
// Only applies when dashboard has "templating" (v0/v1 format).
func ApplyPersonalization(sqlStore *sqlstore.SQLStore, ctx context.Context, dashboardData *simplejson.Json, orgId, userId int64, uid string) {
	if dashboardData == nil {
		return
	}
	query := &models.GetCustomDashPersonalization{
		OrgID:   orgId,
		UserID:  userId,
		DashUID: uid,
	}
	if err := sqlStore.GetDashPersonalization(ctx, query); err == nil {
		if query.Result.Data == nil {
			return
		}

		if _, hasTimeFilter := query.Result.Data.CheckGet("time"); hasTimeFilter {
			dashboardData.Set("time", query.Result.Data.Get("time"))
		}

		// Only apply variable personalization when dashboard has templating (v0/v1 format)
		defaultVariablesList := dashboardData.GetPath("templating", "list").MustArray()
		if len(defaultVariablesList) == 0 {
			return
		}

		personalizedVariablesMap := query.Result.Data.MustMap()
		var newVariablesList []interface{}

		for _, defaultVariable := range defaultVariablesList {
			variableToUpdateMap, ok := defaultVariable.(map[string]interface{})
			if !ok {
				newVariablesList = append(newVariablesList, defaultVariable)
				continue
			}
			variableNameVal, ok := variableToUpdateMap["name"]
			if !ok {
				newVariablesList = append(newVariablesList, defaultVariable)
				continue
			}
			variableName, ok := variableNameVal.(string)
			if !ok {
				newVariablesList = append(newVariablesList, defaultVariable)
				continue
			}
			if personalizedVariablesMap["var-"+variableName] != nil {
				variableToUpdateMap["current"] = personalizedVariablesMap["var-"+variableName]
				newVariablesList = append(newVariablesList, variableToUpdateMap)
			} else {
				newVariablesList = append(newVariablesList, defaultVariable)
			}
		}
		dashboardData.SetPath([]string{"templating", "list"}, newVariablesList)
	} else {
		plugin.Log.Error("Failed to set personalized data", "error", err)
	}
}

