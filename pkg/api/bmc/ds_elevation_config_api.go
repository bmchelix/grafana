package bmc

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	glog "github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/api/response"
	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/web"
)

var requestElevationLogger = glog.New("request-elevation")

// Any signed-in user may call it; the response is tailored to their relationship with the config:
//   - config managers (org admin or the "dashboard.elevated.access:access" permission) get the full config (ids + timestamps) needed by the management page.
//   - members of the elevated group (excluding the owner) get only what the top-nav logo needs.
//   - everyone else get {visible:false}; the owner never sees the logo, even if they are also a group member.
func (p *PluginsAPI) GetDSElevationConfig(c *contextmodel.ReqContext) response.Response {
	empty := &models.GetDSElevationConfigDTO{Visible: false}

	config, err := p.store.GetDSElevationConfig(c.Req.Context(), c.OrgID)
	if err != nil {
		if errors.Is(err, sqlstore.ErrElevatedAccessEntryNotFound) {
			requestElevationLogger.Info("method", "GET", "tenantId", c.OrgID, "no elevation config found")
			return response.JSON(http.StatusOK, empty)
		}
		requestElevationLogger.Error("method", "GET", "path", "ds-elevation-config", "tenantId", c.OrgID, "failed to get config")
		return response.Error(http.StatusInternalServerError, "failed to get ds elevation config", err)
	}

	isManager := c.HasRole(org.RoleAdmin) || c.HasBHDPermission("dashboard.elevated.access", "access")
	// The owner never sees the top-nav logo, even when they also belong to the elevated group, so ownership disqualifies membership everywhere below.
	isMember := c.UserID != config.UserID && slices.Contains(c.Teams, config.GroupID)

	switch {
	case isManager:
		// Config managers get the full config (ids + timestamps) for the management page.
		if isMember {
			config.Visible = true
			config.Role = "member"
		}
		return response.JSON(http.StatusOK, config)
	case isMember:
		// Group members (never the owner) get only what the top-nav logo needs.
		return response.JSON(http.StatusOK, &models.GetDSElevationConfigDTO{
			Visible:   true,
			Role:      "member",
			UserLogin: config.UserLogin,
			GroupName: config.GroupName,
		})
	default:
		// Owner (no logo) and unrelated users: nothing to show.
		return response.JSON(http.StatusOK, empty)
	}
}

// SaveDSElevationConfig enables or repoints the DS elevation config for the current tenant.
// The caller supplies only the group id; the owning user is always the session user.
func (p *PluginsAPI) SaveDSElevationConfig(c *contextmodel.ReqContext) response.Response {
	cmd := &models.CreateDSElevationConfigDTO{}
	if err := web.Bind(c.Req, cmd); err != nil {
		requestElevationLogger.Error("method", "POST", "tenantId", c.OrgID, "bad request payload")
		return response.Error(http.StatusBadRequest, "bad request payload", err)
	}

	if success := p.validateDSElevationTeam(c, cmd.GroupID); !success {
		requestElevationLogger.Error("method", "POST", "tenantId", c.OrgID, "the requested group cannot be used")
		return response.Error(http.StatusForbidden, "the requested group cannot be used", nil)
	}

	prev, fetchingErr := p.store.GetDSElevationConfig(c.Req.Context(), c.OrgID)
	isNewEntry := errors.Is(fetchingErr, sqlstore.ErrElevatedAccessEntryNotFound)

	if fetchingErr != nil && !isNewEntry {
		requestElevationLogger.Error("method", "POST", "tenantId", c.OrgID, "error", fetchingErr, "failed to fetch existing elevation config")
		return response.Error(http.StatusInternalServerError, sqlstore.ErrFailedToFetchConfig.Error(), fetchingErr)
	}

	currentTime := time.Now().UTC()

	dbEntry := models.ElevatedAccessEntry{
		TenantID: c.OrgID,
		// For security reasons, user cannot enable ELT through a different user. They can only enable this feature through their own user
		UserID:      c.UserID,
		GroupID:     cmd.GroupID,
		CreatedTime: currentTime,
		UpdatedTime: currentTime,
	}

	// A missing row means this is a first-time enable, so there is no previous value to audit.
	auditEvent := kp.ElevatedAccessUpdateAudit
	operation := "updated"
	var savingErr error

	if isNewEntry {
		auditEvent = kp.ElevatedAccessEnableAudit
		operation = "enabled"
		savingErr = p.store.InsertDSElevationConfig(c.Req.Context(), &dbEntry)
	} else {
		savingErr = p.store.UpdateDSElevationConfig(c.Req.Context(), &dbEntry)
	}

	if savingErr != nil {
		auditEvent.Send(kp.EventOpt{Ctx: c, Prev: prev, Err: savingErr})
		requestElevationLogger.Error("method", "POST", "tenantId", c.OrgID, "error", savingErr, "failed to save ds elevation config")
		return response.Error(http.StatusInternalServerError, "failed to save ds elevation config", savingErr)
	}

	// Invalidate the shared elevation cache so all pods pick up the updated config on their next read.
	DeleteEltCache(c.OrgID)

	// Re-read config so owner login / group name are resolved for the audit record and response.
	newCfg, err := p.store.GetDSElevationConfig(c.Req.Context(), c.OrgID)
	if err != nil {
		requestElevationLogger.Error("method", "POST", "tenantId", c.OrgID, "error", err, "failed to re-read ds elevation config")
		auditEvent.Send(kp.EventOpt{Ctx: c, Prev: prev, Err: err})
		return response.Error(http.StatusInternalServerError, sqlstore.ErrFailedToFetchConfig.Error(), err)
	}

	auditEvent.Send(kp.EventOpt{
		Ctx:              c,
		Prev:             prev,
		New:              newCfg,
		OperationSubType: fmt.Sprintf("Elevated dashboard access %s by %s (%d)", operation, c.Login, c.UserID),
	})

	requestElevationLogger.Info("method", "POST", "tenantId", c.OrgID, "updatedUserID", dbEntry.UserID, "updatedGroupID", dbEntry.GroupID, "successfully updated ds elevation config")
	return response.JSON(http.StatusOK, newCfg)
}

func (p *PluginsAPI) validateDSElevationTeam(c *contextmodel.ReqContext, groupID int64) bool {
	if groupID <= 0 {
		return false
	}

	// Admins (org admin or Grafana server admin) can elevate access for any group in the tenant, not just the ones they belong to.
	if c.HasRole(org.RoleAdmin) {
		// validate that the group actually exists in the current org
		_, err := p.teamSvc.GetTeamByID(c.Req.Context(), &team.GetTeamByIDQuery{OrgID: c.OrgID, ID: groupID})
		if err != nil {
			requestElevationLogger.Error("tenantId", c.OrgID, "groupID", groupID, "userID", c.UserID, "group does not exist in this tenant")
			return false
		}
		return true
	}

	// Non-admins can only enable ELT for a group they are a member of.
	if slices.Contains(c.Teams, groupID) {
		return true
	}

	requestElevationLogger.Error("tenantId", c.OrgID, "groupID", groupID, "userID", c.UserID, "user is not a member of the requested group")
	return false
}

// DeleteDSElevationConfig disables DS elevation config by deleting its row.
func (p *PluginsAPI) DeleteDSElevationConfig(c *contextmodel.ReqContext) response.Response {
	// Read the previous config so the audit event records who/which group was disabled.
	tenantID := c.OrgID

	prev, fetchingErr := p.store.GetDSElevationConfig(c.Req.Context(), tenantID)

	if errors.Is(fetchingErr, sqlstore.ErrElevatedAccessEntryNotFound) {
		requestElevationLogger.Error("method", "DELETE", "tenantId", tenantID, "elevation config not found")
		return response.Error(http.StatusNotFound, sqlstore.ErrElevatedAccessEntryNotFound.Error(), fetchingErr)
	} else if fetchingErr != nil {
		requestElevationLogger.Error("method", "DELETE", "tenantId", tenantID, "error", fetchingErr, "failed to fetch existing elevation config")
		return response.Error(http.StatusInternalServerError, sqlstore.ErrFailedToFetchConfig.Error(), fetchingErr)
	}

	// Disabling deletes the entire row including any whitelisted URLs.
	disablingErr := p.store.DisableDSElevationConfig(c.Req.Context(), tenantID)

	if disablingErr != nil {
		requestElevationLogger.Error("method", "DELETE", "tenantId", tenantID, "error", disablingErr, "failed to disable ds elevation config")
		kp.ElevatedAccessDeleteAudit.Send(kp.EventOpt{Ctx: c, Prev: prev, Err: disablingErr, OperationStatus: "FAILED"})
		return response.Error(http.StatusInternalServerError, "failed to disable ds elevation config", disablingErr)
	}

	// Invalidate the shared elevation cache so all pods stop elevating for this tenant on their next read.
	DeleteEltCache(tenantID)

	kp.ElevatedAccessDeleteAudit.Send(kp.EventOpt{
		Ctx:              c,
		Prev:             prev,
		OperationSubType: "Elevated dashboard access DISABLED",
		New:              nil,
		OperationStatus:  "SUCCESS",
	})

	requestElevationLogger.Info("method", "DELETE", "tenantId", tenantID, "successfully disabled ds elevation config")
	return response.Empty(http.StatusNoContent)
}
