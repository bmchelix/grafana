package bmc

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

var requestElevationLogger = glog.New("request-elevation")

// GetElevateRequestData retrieves elevation data for a specific tenant
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

	result, err := p.store.GetDSElevationData(c.Req.Context(), tenantID)
	if err != nil {
		if errors.Is(err, sqlstore.ErrMiscellaneousStoreEntryNotFound) {
			return response.Error(http.StatusNotFound, "elevation data not found for tenant", err)
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

	cmd := &models.DSElevationDataDTO{}
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

	// Serialize the DTO to JSON string for storage
	opValueBytes, err := json.Marshal(cmd)
	if err != nil {
		requestElevationLogger.Error(fmt.Sprintf("failed to serialize elevation data before storing it: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to serialize elevation data before storing it", err)
	}

	if err := p.store.SaveMiscellaneousStoreEntry(c.Req.Context(), tenantID, opValueBytes); err != nil {
		if errors.Is(err, sqlstore.ErrMiscellaneousStoreEntryAlreadyExists) {
			return response.Error(http.StatusConflict, "elevation data already exists for tenant", err)
		}
		requestElevationLogger.Error(fmt.Sprintf("Failed to insert elevation data: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to insert elevation data", err)
	}

	return response.JSON(http.StatusCreated, map[string]string{"message": "Request elevation data inserted successfully"})
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

	deletedEntry, err := p.store.DeleteMiscellaneousStoreEntry(c.Req.Context(), tenantID)

	if err != nil {
		if errors.Is(err, sqlstore.ErrMiscellaneousStoreEntryNotFound) {
			return response.Error(http.StatusNotFound, "elevation data not found for tenant", err)
		}
		requestElevationLogger.Error(fmt.Sprintf("Failed to delete elevation data: %v", err), "tenantID", tenantID)
		return response.Error(http.StatusInternalServerError, "failed to delete elevation data", err)
	}

	return response.JSON(http.StatusOK, deletedEntry)
}
