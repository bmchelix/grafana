package bhd_recently_deleted

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

// DeleteReportSchedulesForDashboard removes report_scheduler / report_data rows for a dashboard id (BMC reporting).
func DeleteReportSchedulesForDashboard(sess *db.Session, dashboardID int64) error {
	if _, err := sess.Exec(
		"DELETE FROM report_scheduler WHERE id IN (SELECT report_scheduler_id FROM report_data WHERE dashboard_id = ?)",
		dashboardID,
	); err != nil {
		return err
	}
	if _, err := sess.Exec("DELETE FROM report_data WHERE dashboard_id = ?", dashboardID); err != nil {
		return err
	}
	return nil
}

// InsertArchive persists a snapshot of a dashboard row before it is removed from the dashboard table.
func InsertArchive(sess *db.Session, orgID, originalID int64, uid, slug, title, folderUID string, isFolder bool, dataJSON string, deletedAt time.Time) error {
	row := &Row{
		OrgID:      orgID,
		OriginalID: originalID,
		UID:        uid,
		Slug:       slug,
		Title:      title,
		FolderUID:  folderUID,
		IsFolder:   isFolder,
		Data:       dataJSON,
		DeletedAt:  deletedAt,
	}
	_, err := sess.Insert(row)
	return err
}
