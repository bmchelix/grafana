package models

import (
	"time"
)

// DSElevationDataDTO is the input/output struct with string patterns for JSON serialization
type DSElevationDataDTO struct {
	// A map of methods to URL patterns as strings
	WhiteListedURLs map[string][]string `json:"whitelisted_urls"`
}

// MiscellaneousStoreEntry represents a row in the miscellaneous_store table
type MiscellaneousStoreEntry struct {
	TenantID    int64     `xorm:"tenant_id" json:"tenantId"`
	OpKey       string    `xorm:"op_key" json:"opKey"`
	OpValue     string    `xorm:"op_value" json:"opValue"`
	CreatedTime time.Time `xorm:"created_time" json:"createdTime"`
	UpdatedTime time.Time `xorm:"updated_time" json:"updatedTime"`
}

// GetMiscellaneousStoreEntry is the query struct for retrieving entries
type GetMiscellaneousStoreEntry struct {
	TenantID int64
	OpKey    string
	Result   *MiscellaneousStoreEntry
}

// SaveMiscellaneousStoreEntry is the struct for saving entries
type SaveMiscellaneousStoreEntry struct {
	TenantID    int64     `xorm:"tenant_id"`
	OpKey       string    `xorm:"op_key"`
	OpValue     string    `xorm:"op_value"`
	CreatedTime time.Time `xorm:"created_time"`
	UpdatedTime time.Time `xorm:"updated_time"`
}

// DeleteMiscellaneousStoreEntry is the struct for deleting entries
type DeleteMiscellaneousStoreEntry struct {
	TenantID int64
	OpKey    string
}
