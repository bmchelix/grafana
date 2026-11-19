package sqlstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var ErrElevatedAccessEntryNotFound = errors.New("elevated access is not enabled")
var ErrFailedToFetchConfig = errors.New("failed to fetch current elevation config")

// getElevatedAccessEntry retrieves the elevated_access entry for a tenant.
// This is exact entry from DB without modifications
func (ss *SQLStore) getElevatedAccessEntry(c context.Context, query *models.GetElevatedAccessEntryForm) error {
	return ss.WithDbSession(c, func(dbSession *DBSession) error {
		result := &models.ElevatedAccessEntry{}
		has, err := dbSession.Table("elevated_access").
			Where("tenant_id = ?", query.TenantID).
			Limit(1).
			Get(result)

		if err != nil {
			return err
		}

		if !has {
			// no entry found
			return ErrElevatedAccessEntryNotFound
		}

		query.Result = result
		return nil
	})
}

// GetDSElevationConfig retrieves ELT config from elevated_access table
// returns data in user friendly way (with username and group name resolved)
func (ss *SQLStore) GetDSElevationConfig(c context.Context, tenantID int64) (*models.GetDSElevationConfigDTO, error) {
	query := &models.GetElevatedAccessEntryForm{
		TenantID: tenantID,
	}

	if err := ss.getElevatedAccessEntry(c, query); err != nil {
		return nil, err
	}

	dto := &models.GetDSElevationConfigDTO{
		TenantID:  query.Result.TenantID,
		UserID:    query.Result.UserID,
		GroupID:   query.Result.GroupID,
		UpdatedAt: query.Result.UpdatedTime,
	}

	// Resolve display names server-side so non-admin viewers can render the owner/group
	// without the admin-scoped /api/users/:id or /api/teams/:id endpoints. Best-effort:
	// on any lookup failure the name is left empty and the UI falls back to the id.
	_ = ss.WithDbSession(c, func(dbSess *DBSession) error {
		if dto.UserID > 0 {
			owner := struct {
				Login string `xorm:"login"`
				Name  string `xorm:"name"`
			}{}
			if has, err := dbSess.Table("user").Where("id = ?", dto.UserID).Where("org_id = ?", tenantID).Cols("login", "name").Get(&owner); err == nil && has {
				if owner.Name != "" {
					dto.UserLogin = owner.Name
				} else {
					dto.UserLogin = owner.Login
				}
			}
		}
		if dto.GroupID > 0 {
			group := struct {
				Name string `xorm:"name"`
			}{}
			if has, err := dbSess.Table("team").Where("id = ?", dto.GroupID).Where("org_id = ?", tenantID).Cols("name").Get(&group); err == nil && has {
				dto.GroupName = group.Name
			}
		}
		return nil
	})

	// Always apply the id fallback outside the session callback so it fires even when the
	// name-lookup session fails to open (e.g. transient DB connectivity issue).
	if dto.UserLogin == "" {
		dto.UserLogin = fmt.Sprintf("user %d", dto.UserID)
	}
	if dto.GroupName == "" {
		dto.GroupName = fmt.Sprintf("group %d", dto.GroupID)
	}

	return dto, nil
}

// InsertDSElevationConfig creates the elevation config row for a tenant, enabling the feature.
func (ss *SQLStore) InsertDSElevationConfig(ctx context.Context, entry *models.ElevatedAccessEntry) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		rowsAffected, err := dbSess.Table("elevated_access").Insert(entry)
		ss.log.Info("inserted elevation config", "rowsAffected", rowsAffected, "tenantID", entry.TenantID)
		return err
	})
}

// UpdateDSElevationConfig repoints an existing tenant row at a new owner/group. Only the owner
// columns are written so a devops-managed allowlist and the original created_time survive.
func (ss *SQLStore) UpdateDSElevationConfig(ctx context.Context, entry *models.ElevatedAccessEntry) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		rowsAffected, err := dbSess.Table("elevated_access").
			Where("tenant_id = ?", entry.TenantID).
			Update(map[string]interface{}{
				"user_id":      entry.UserID,
				"group_id":     entry.GroupID,
				"updated_time": entry.UpdatedTime,
			})

		if err != nil {
			return err
		}

		if rowsAffected == 0 {
			ss.log.Error("no rows affected when updating elevation config", "tenantID", entry.TenantID, "userID", entry.UserID, "groupID", entry.GroupID)
			return ErrElevatedAccessEntryNotFound
		}

		return nil
	})
}

// DisableDSElevationConfig turns the feature off from the UI by deleting the row. Any whitelisted URLs configured by devops are also removed; devops must re-add them after a user re-enables the feature. If the row doesn't exist, the delete is considered successful (idempotent).
func (ss *SQLStore) DisableDSElevationConfig(ctx context.Context, tenantID int64) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		rowsAffected, err := dbSess.Table("elevated_access").
			Where("tenant_id = ?", tenantID).
			Delete(&models.ElevatedAccessEntry{})

		if err != nil {
			return err
		}

		if rowsAffected == 0 {
			ss.log.Warn("no rows affected when deleting elevation config", "tenantID", tenantID)
		}

		ss.log.Info("deleted elevation config", "rowsAffected", rowsAffected, "tenantID", tenantID)
		return err
	})
}

// Whitelisted URLs code starts

// GetDSElevationWhitelistedURls retrieves the tenant's whitelist DTO along with the owner columns.
// The whitelist patterns come from the stored JSON; tenant_id/user_id/group_id come from
// the dedicated columns (authoritative).
func (ss *SQLStore) GetDSElevationWhitelistedURls(c context.Context, tenantID int64) (*models.TenantElevationSettings, error) {
	query := &models.GetElevatedAccessEntryForm{
		TenantID: tenantID,
	}

	if err := ss.getElevatedAccessEntry(c, query); err != nil {
		return nil, err
	}

	// Parse the stored whitelist JSON (only whitelisted_urls is persisted there).
	var dto models.TenantElevationSettings

	dto.UserID = query.Result.UserID
	dto.GroupID = query.Result.GroupID
	json.Unmarshal([]byte(query.Result.WhitelistedURLs), &dto.WhiteListedURLs)

	return &dto, nil
}

// UpdateWhitelistedURLs sets the devops-managed allowlist JSON for a tenant.
// It preserves the existing owner (user_id/group_id).
// The feature must already be enabled (row must exist)
// returns ErrElevatedAccessNotEnabled if no row exists.
func (ss *SQLStore) UpdateWhitelistedURLs(c context.Context, tenantID int64, whitelistedURLs string) error {
	return ss.WithTransactionalDbSession(c, func(dbSess *DBSession) error {
		existing := &models.ElevatedAccessEntry{}
		has, err := dbSess.Table("elevated_access").
			Where("tenant_id = ?", tenantID).
			Limit(1).
			Get(existing)

		if err != nil {
			return err
		}

		if !has {
			return ErrElevatedAccessEntryNotFound
		}

		_, err = dbSess.Table("elevated_access").
			Where("tenant_id = ?", tenantID).
			Update(map[string]interface{}{
				"whitelisted_urls": whitelistedURLs,
				"updated_time":     time.Now().UTC(),
			})
		return err
	})
}

// ClearWhitelistedURLs removes the devops-managed allowlist for a tenant. The row is kept with the whitelist reset to default; the feature remains enabled with the existing owner.
func (ss *SQLStore) ClearWhitelistedURLs(ctx context.Context, tenantID int64) (*models.ElevatedAccessEntry, error) {
	var entry *models.ElevatedAccessEntry
	err := ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		existing := &models.ElevatedAccessEntry{}
		has, err := dbSess.Table("elevated_access").
			Where("tenant_id = ?", tenantID).
			Limit(1).
			Get(existing)

		if err != nil {
			return err
		}
		if !has {
			return ErrElevatedAccessEntryNotFound
		}
		entry = existing

		_, err = dbSess.Table("elevated_access").
			Where("tenant_id = ?", tenantID).
			Update(map[string]interface{}{
				"whitelisted_urls": nil,
				"updated_time":     time.Now().UTC(),
			})
		return err
	})
	return entry, err
}
