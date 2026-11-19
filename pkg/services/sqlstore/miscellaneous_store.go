package sqlstore

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var (
	ErrMiscellaneousStoreEntryNotFound      = errors.New("miscellaneous store entry not found")
	ErrMiscellaneousStoreEntryAlreadyExists = errors.New("miscellaneous store entry already exists")
)

const DSElevationOpKey = "DS_ELEVATION"

// GetMiscellaneousStoreEntry retrieves an entry from miscellaneous_store table
func (ss *SQLStore) GetMiscellaneousStoreEntry(ctx context.Context, query *models.GetMiscellaneousStoreEntry) (*models.MiscellaneousStoreEntry, error) {
	var result models.MiscellaneousStoreEntry
	err := ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		row := &models.MiscellaneousStoreEntry{}
		has, err := dbSession.Table("miscellaneous_store").
			Where("tenant_id = ?", query.TenantID).
			Where("op_key = ?", query.OpKey).
			Limit(1).
			Get(row)
		if err != nil {
			return err
		}
		if !has {
			return ErrMiscellaneousStoreEntryNotFound
		}
		query.Result = row
		return nil
	})
	return &result, err
}

// SaveMiscellaneousStoreEntry saves an entry to miscellaneous_store table (insert only if not exists)
func (ss *SQLStore) SaveMiscellaneousStoreEntry(ctx context.Context, query *models.MiscellaneousStoreEntry) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {

		// Check if entry already exists
		existing := &models.MiscellaneousStoreEntry{}

		has, err := dbSess.Table("miscellaneous_store").
			Where("tenant_id = ?", query.TenantID).
			Where("op_key = ?", query.OpKey).
			Limit(1).
			Get(existing)

		if err != nil {
			return err
		}
		if has {
			return ErrMiscellaneousStoreEntryAlreadyExists
		}

		// Insert new entry
		now := time.Now()
		query.CreatedTime = now
		query.UpdatedTime = now

		_, err = dbSess.Table("miscellaneous_store").Insert(query)
		return err
	})
}

// DeleteMiscellaneousStoreEntry deletes an entry from miscellaneous_store table and returns the deleted entry
func (ss *SQLStore) DeleteMiscellaneousStoreEntry(ctx context.Context, tenantId int64) (*models.MiscellaneousStoreEntry, error) {
	var deletedEntry *models.MiscellaneousStoreEntry

	query := &models.DeleteMiscellaneousStoreEntry{
		TenantID: tenantId,
		OpKey:    DSElevationOpKey,
	}

	err := ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		// First, get the entry to return it
		existing := &models.MiscellaneousStoreEntry{}
		has, err := dbSess.Table("miscellaneous_store").
			Where("tenant_id = ?", query.TenantID).
			Where("op_key = ?", query.OpKey).
			Limit(1).
			Get(existing)
		if err != nil {
			return err
		}
		if !has {
			return ErrMiscellaneousStoreEntryNotFound
		}

		deletedEntry = existing

		// Delete the entry
		_, err = dbSess.Table("miscellaneous_store").
			Where("tenant_id = ?", query.TenantID).
			Where("op_key = ?", query.OpKey).
			Delete(&models.MiscellaneousStoreEntry{})
		return err
	})

	return deletedEntry, err
}
