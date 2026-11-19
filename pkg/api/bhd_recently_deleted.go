// Helix code
// @author: mangesh.d
package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bhd_recently_deleted"
	"github.com/grafana/grafana/pkg/bhdcodes"
	"github.com/grafana/grafana/pkg/bmc/audit"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type restoreArchiveJSON struct {
	FolderUID string `json:"folderUid"`
}

// ListArchiveDashboards returns archived dashboard rows for the org (BMC / BHD).
func (hs *HTTPServer) ListArchiveDashboards(c *contextmodel.ReqContext) response.Response {
	if hs.sqlStore == nil {
		return response.Error(http.StatusInternalServerError, "sql store not configured", nil)
	}
	rows, err := bhd_recently_deleted.ListByOrg(c.Req.Context(), hs.sqlStore, c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to list recently deleted dashboards", err)
	}
	out := make([]bhd_recently_deleted.ListItem, 0, len(rows))
	for i := range rows {
		out = append(out, bhd_recently_deleted.RowToListItem(rows[i]))
	}
	return response.JSON(http.StatusOK, out)
}

// RestoreArchiveDashboard restores a row from bhd_recently_deleted_dashboard table into the dashboard table.
func (hs *HTTPServer) RestoreArchiveDashboard(c *contextmodel.ReqContext) response.Response {
	if hs.sqlStore == nil {
		return response.Error(http.StatusInternalServerError, "sql store not configured", nil)
	}
	idStr := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return response.JSON(http.StatusBadRequest, &bhd_recently_deleted.RestoreResponse{
			Message: bhd_recently_deleted.RestoreBadRequestMsg,
			BHDCode: bhdcodes.DashboardRestoreDeletedBadRequest,
		})
	}
	var body restoreArchiveJSON
	if err := web.Bind(c.Req, &body); err != nil {
		return response.JSON(http.StatusBadRequest, &bhd_recently_deleted.RestoreResponse{
			Message: bhd_recently_deleted.RestoreBadRequestMsg,
			BHDCode: bhdcodes.DashboardRestoreDeletedBadRequest,
		})
	}

	result, dash, err := bhd_recently_deleted.RestoreArchive(c.Req.Context(), hs.sqlStore, hs.DashboardService, &bhd_recently_deleted.RestoreCommand{
		ArchiveID: id,
		OrgID:     c.GetOrgID(),
		FolderUID: body.FolderUID,
		User:      c.SignedInUser,
	})
	if err != nil {
		if result != nil && result.BHDCode != "" {
			if errors.Is(err, bhd_recently_deleted.ErrRestoreArchiveRemoveFailed) {
				hs.log.Error(
					"restore import succeeded but archive removal failed",
					"archiveId", id,
					"uid", result.UID,
					"error", err,
				)
				go audit.RestoreDeletedDashboardAudit(c, dash, nil)
				return response.JSON(http.StatusMultiStatus, result)
			}
			if dash != nil {
				go audit.RestoreDeletedDashboardAudit(c, dash, err)
			}
			return response.JSON(bhd_recently_deleted.RestoreErrorHTTPStatus(err), result)
		}
		return response.Error(http.StatusInternalServerError, "failed to restore dashboard", err)
	}

	go audit.RestoreDeletedDashboardAudit(c, dash, nil)
	return response.JSON(http.StatusOK, result)
}
