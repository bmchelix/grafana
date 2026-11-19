package bmc

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

// GetElevateRequestData returns the curl command-managed whitelisted URLs for a tenant.
//
// Response contract (also consumed by the runtime proxy in ds_request_elevation.go):
//   - 200 with the whitelist payload  -> a custom whitelist is configured.
//   - 404 with a "not yet set" message -> no row, OR a row exists but no whitelist is set.
//
// The 404-on-empty case is deliberate: the runtime treats 404 as "use the default
// whitelisted paths", so returning an empty 200 would instead deny all elevation.
func (p *PluginsAPI) GetElevateRequestData(c *contextmodel.ReqContext) response.Response {
	tenantIDStr := web.Params(c.Req)[":id"]
	if tenantIDStr == "" {
		return response.Error(http.StatusBadRequest, "tenant ID is required", nil)
	}

	tenantID, err := strconv.ParseInt(tenantIDStr, 10, 64)
	if err != nil {
		requestElevationLogger.Error(fmt.Sprintf("Invalid tenant ID: %v", err), "tenantID", tenantIDStr)
		return response.Error(http.StatusBadRequest, "invalid tenant ID", err)
	}

	result, err := p.store.GetDSElevationWhitelistedURls(c.Req.Context(), tenantID)
	if err != nil {
		if errors.Is(err, sqlstore.ErrElevatedAccessEntryNotFound) {
			// No row at all for this tenant.
			return response.Empty(http.StatusNotFound)
		}
		requestElevationLogger.Error(fmt.Sprintf("Failed to get elevation data: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to get elevation data", err)
	}

	return response.JSON(http.StatusOK, result)
}

// InsertElevateRequestData inserts elevation data for a specific tenant
func (p *PluginsAPI) InsertElevateRequestData(c *contextmodel.ReqContext) response.Response {
	tenantIDStr := web.Params(c.Req)[":id"]
	if tenantIDStr == "" {
		return response.Error(http.StatusBadRequest, "tenant ID is required", nil)
	}

	tenantID, err := strconv.ParseInt(tenantIDStr, 10, 64)
	if err != nil {
		requestElevationLogger.Error(fmt.Sprintf("Invalid tenant ID: %v", err), "tenantID", tenantIDStr)
		return response.Error(http.StatusBadRequest, "invalid tenant ID", err)
	}

	cmd := &models.TenantElevationSettings{}
	if err := web.Bind(c.Req, cmd); err != nil {
		requestElevationLogger.Error(fmt.Sprintf("Bad request payload: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusBadRequest, "bad request payload for inserting elevate request data", err)
	}

	// Validate that all patterns compile to valid regex
	for method, patterns := range cmd.WhiteListedURLs {
		for i, pattern := range patterns {
			if _, err := regexp.Compile(pattern); err != nil {
				requestElevationLogger.Error(fmt.Sprintf("Invalid regex pattern: %v", err), "tenantID", tenantID, "method", method, "patternIndex", i, "pattern", pattern)
				return response.Error(http.StatusBadRequest, fmt.Sprintf("invalid regex pattern for method '%s' at index %d: %s", method, i, err.Error()), err)
			}
		}
	}

	// Store only the whitelist portion ({"whitelisted_urls": {...}}). The owner
	// (tenant/user/group) lives in dedicated columns, so we deliberately drop the
	// tenantId/userId/groupId fields of the request DTO to keep the stored JSON clean.
	whitelistPayload := struct {
		WhiteListedURLs map[string][]string `json:"whitelisted_urls"`
	}{WhiteListedURLs: cmd.WhiteListedURLs}
	if whitelistPayload.WhiteListedURLs == nil {
		whitelistPayload.WhiteListedURLs = map[string][]string{}
	}

	opValueBytes, err := json.Marshal(whitelistPayload)
	if err != nil {
		requestElevationLogger.Error(fmt.Sprintf("failed to serialize elevation data before storing it: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to serialize elevation data before storing it", err)
	}
	// Update the tenant's whitelist. The feature must be enabled first (row must exist);
	// whitelisted URLs cannot be added if the feature is disabled.
	if err := p.store.UpdateWhitelistedURLs(c.Req.Context(), tenantID, string(opValueBytes)); err != nil {
		if errors.Is(err, sqlstore.ErrElevatedAccessEntryNotFound) {
			return response.Error(http.StatusBadRequest, "elevated access feature must be enabled before adding whitelisted URLs", err)
		}
		requestElevationLogger.Error(fmt.Sprintf("Failed to insert elevation data: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to insert elevation data", err)
	}

	// Whitelist changed: invalidate the cached settings so pods pick up the new allowlist promptly.
	DeleteEltCache(tenantID)

	return response.JSON(http.StatusCreated, map[string]string{"message": "Request elevation data inserted successfully"})
}

func (p *PluginsAPI) ParseWhiteListedURLsStringIntoRegex(whitelistedURLs map[string][]string) *models.TenantWhiteListedUrls {
	compiled := make(models.TenantWhiteListedUrls)
	for method, patterns := range whitelistedURLs {
		regexList := make([]regexp.Regexp, 0, len(patterns))
		for _, pattern := range patterns {
			compiledPattern, err := regexp.Compile(pattern)
			if err != nil {
				p.cfg.Logger.Error("invalid regex pattern in tenant whitelisted APIs", "error", err, "method", method, "pattern", pattern)
				return nil
			}
			regexList = append(regexList, *compiledPattern)
		}
		compiled[method] = regexList
	}
	return &compiled
}

// DeleteElevateRequestData deletes elevation data for a specific tenant and returns the deleted entry
func (p *PluginsAPI) DeleteElevateRequestData(c *contextmodel.ReqContext) response.Response {
	tenantIDStr := web.Params(c.Req)[":id"]
	if tenantIDStr == "" {
		return response.Error(http.StatusBadRequest, "tenant ID is required", nil)
	}

	tenantID, err := strconv.ParseInt(tenantIDStr, 10, 64)
	if err != nil {
		requestElevationLogger.Error(fmt.Sprintf("Invalid tenant ID: %v", err), "tenantID", tenantIDStr)
		return response.Error(http.StatusBadRequest, "invalid tenant ID", err)
	}

	// Clearing the whitelist keeps an active elevation config intact (only the
	// whitelist is reset); a whitelist-only row is removed entirely.
	deletedEntry, err := p.store.ClearWhitelistedURLs(c.Req.Context(), tenantID)

	if err != nil {
		if errors.Is(err, sqlstore.ErrElevatedAccessEntryNotFound) {
			return response.Error(http.StatusNotFound, "elevation data not found for tenant", err)
		}
		requestElevationLogger.Error(fmt.Sprintf("Failed to delete elevation data: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to delete elevation data", err)
	}

	// Whitelist cleared: invalidate the cached settings so removed paths stop being elevated promptly.
	DeleteEltCache(tenantID)

	return response.JSON(http.StatusOK, deletedEntry)
}
