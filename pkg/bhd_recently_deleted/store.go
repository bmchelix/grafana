package bhd_recently_deleted

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bhdcodes"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	// DeletedDashboardRetention is how long archived dashboards are kept before permanent purge.
	DeletedDashboardRetention = 60 * 24 * time.Hour
)

func ListByOrg(ctx context.Context, ss *sqlstore.SQLStore, orgID int64) ([]Row, error) {
	var out []Row
	err := ss.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id = ?", orgID).OrderBy("deleted_at DESC").Find(&out)
	})
	return out, err
}

func GetByIDAndOrg(ctx context.Context, ss *sqlstore.SQLStore, id, orgID int64) (*Row, error) {
	var row Row
	err := ss.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Where("id = ? AND org_id = ?", id, orgID).Get(&row)
		if err != nil {
			return err
		}
		if !has {
			return ErrNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// on restore it removes the entry from the archive table
func RemoveFromArchiveByID(ctx context.Context, ss *sqlstore.SQLStore, id, orgID int64) error {
	return ss.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		res, err := sess.Exec("DELETE FROM bhd_recently_deleted_dashboard WHERE id = ? AND org_id = ?", id, orgID)
		if err != nil {
			return err
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// PurgeOlderThan permanently deletes archived dashboards deleted older than the retention period.
// Returns the rows that were purged so callers can emit audit events.
func PurgeOlderThan(ctx context.Context, database db.DB, olderThan time.Time) ([]Row, error) {
	var purged []Row
	err := database.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Where("deleted_at < ?", olderThan).Find(&purged); err != nil {
			return err
		}
		if len(purged) == 0 {
			return nil
		}
		_, err := sess.Exec("DELETE FROM bhd_recently_deleted_dashboard WHERE deleted_at < ?", olderThan)
		return err
	})
	return purged, err
}

// dashboardWithSameTitleExistsInFolder mirrors the SQL title check used during dashboard import.
func dashboardWithSameTitleExistsInFolder(ctx context.Context, ss *sqlstore.SQLStore, orgID int64, title, folderUID string) (bool, error) {
	var exists bool
	err := ss.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var existing dashboards.Dashboard
		condition := "org_id=? AND title=? AND deleted IS NULL"
		args := []any{orgID, strings.TrimSpace(title)}
		if folderUID != "" {
			condition += " AND folder_uid=?"
			args = append(args, folderUID)
		} else {
			condition += " AND folder_uid IS NULL"
		}
		has, err := sess.Where(condition, args...).Cols("id").Get(&existing)
		if err != nil {
			return err
		}
		exists = has
		return nil
	})
	return exists, err
}


func RestoreArchive(
	ctx context.Context,
	ss *sqlstore.SQLStore,
	dashSvc dashboards.DashboardService,
	cmd *RestoreCommand,
) (*RestoreResponse, *dashboards.Dashboard, error) {
	queryResult := RestoreResponse{}

	row, err := GetByIDAndOrg(ctx, ss, cmd.ArchiveID, cmd.OrgID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			queryResult.Message = RecentlyDeletedNotFoundMsg
			queryResult.BHDCode = bhdcodes.RecentlyDeletedNotFound
			return &queryResult, nil, ErrNotFound
		}

		return nil, nil, err
	}

	// Check if a dashboard with the same UID already exists.
	_, err = dashSvc.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		OrgID: cmd.OrgID,
		UID:   row.UID,
	})
	if err == nil {
		queryResult.Message = RecentlyDeletedUIDExistsMsg
		queryResult.BHDCode = bhdcodes.RestoreConflictUID
		return &queryResult, nil, ErrUIDAlreadyExists
	}

	if !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return nil, nil, err
	}

	// Check if a dashboard with the same title already exists
	// in the target folder.
	sameTitleExists, err := dashboardWithSameTitleExistsInFolder(
		ctx,
		ss,
		cmd.OrgID,
		row.Title,
		cmd.FolderUID,
	)
	if err != nil {
		return nil, nil, err
	}

	if sameTitleExists {
		queryResult.Message = RecentlyDeletedNameExistsMsg
		queryResult.BHDCode = bhdcodes.RestoreConflictName
		return &queryResult, nil, ErrNameAlreadyExists
	}

	// Both UID and title checks passed.
	// Now validate and prepare the archived dashboard data.
	data, err := simplejson.NewJson([]byte(row.Data))
	if err != nil {
		queryResult.Message = RecentlyDeletedArchiveInvalidMsg
		queryResult.BHDCode = bhdcodes.RecentlyDeletedArchiveInvalid
		return &queryResult, nil, ErrArchiveInvalid
	}

	data.Del("id")

	if !row.IsFolder {
		AppendRestoredTag(data)
	}

	dash := dashboards.NewDashboardFromJson(data)
	dash.UID = row.UID
	dash.IsFolder = row.IsFolder
	dash.FolderUID = cmd.FolderUID

	dash.Data.Set("uid", row.UID)

	if cmd.FolderUID != "" {
		dash.Data.Set("folderUid", cmd.FolderUID)
	} else {
		dash.Data.Del("folderUid")
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgID:     cmd.OrgID,
		User:      cmd.User,
		Dashboard: dash,
		Message:   "Restored from BMC recently deleted",
		Overwrite: false,
	}

	// Import first so a crash cannot leave the deleted archive  without a live dashboard.
	if _, importErr := dashSvc.ImportDashboard(ctx, dto); importErr != nil {
		queryResult.Message = RecentlyDeletedRestoreFailedMsg
		queryResult.BHDCode = bhdcodes.RecentlyDeletedRestoreFailed

		return &queryResult, dash, errors.Join(
			ErrRestoreFailed,
			importErr,
		)
	}

	if err := RemoveFromArchiveByID(ctx, ss, cmd.ArchiveID, cmd.OrgID); err != nil {
		if errors.Is(err, ErrNotFound) {
			queryResult.UID = row.UID
			queryResult.Title = row.Title
			return &queryResult, dash, nil
		}

		queryResult.UID = row.UID
		queryResult.Title = row.Title
		queryResult.Message = RecentlyDeletedRestoreArchivePendingMsg
		queryResult.BHDCode = bhdcodes.RecentlyDeletedRestoreArchivePending

		return &queryResult, dash, errors.Join(
			ErrRestoreArchiveRemoveFailed,
			err,
		)
	}

	queryResult.UID = row.UID
	queryResult.Title = row.Title

	return &queryResult, dash, nil
}