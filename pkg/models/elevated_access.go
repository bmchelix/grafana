package models

import (
	"regexp"
	"time"
)

// ElevatedAccessEntry represents a single row in the elevated_access table.
// There is at most one row per tenant (keyed by tenant_id).
type ElevatedAccessEntry struct {
	TenantID        int64     `xorm:"tenant_id" json:"tenantId"`
	UserID          int64     `xorm:"user_id" json:"userId"`
	GroupID         int64     `xorm:"group_id" json:"groupId"`
	CreatedTime     time.Time `xorm:"created_time" json:"createdTime"`
	UpdatedTime     time.Time `xorm:"updated_time" json:"updatedTime"`
	WhitelistedURLs string    `xorm:"whitelisted_urls" json:"whitelistedUrls" omitempty:"true"`
}

// TenantElevationSettings is the input/output struct with string patterns for JSON serialization
type TenantElevationSettings struct {
	UserID  int64 `xorm:"user_id" json:"userId"`
	GroupID int64 `xorm:"group_id" json:"groupId"`
	// A map of methods to URL patterns as strings
	WhiteListedURLs map[string][]string `xorm:"whitelisted_urls" json:"whitelisted_urls"`
}

type TenantWhiteListedUrls map[string][]regexp.Regexp

// GetDSElevationConfigDTO is the response payload for getting ELT config. It serves two usecases:
// 1. config managers receive the full config for the management page
// 2. elevated-group members receive only Visible/Role/UserLogin/GroupName to drive the top-nav logo. Unrelated users receive {visible:false}.
type GetDSElevationConfigDTO struct {
	TenantID  int64     `json:"tenantId"`
	UserID    int64     `json:"userId"`
	GroupID   int64     `json:"groupId"`
	UpdatedAt time.Time `json:"updatedAt"`
	// UserLogin and GroupName are resolved server-side
	// so that non-admin viewers (who might not have permission to see that user or team)
	// can still see who currently owns the configuration and which group is elevated.
	UserLogin string `json:"userLogin" omitempty:"true"`
	GroupName string `json:"groupName" omitempty:"true"`
	// Visible drives the top-nav logo; Role is "owner" or "member".
	Visible bool   `json:"visible"`
	Role    string `json:"role,omitempty"`
}

// GetElevatedAccessEntryForm is the query struct for retrieving a tenant's entry.
// Lookups are scoped by tenant_id only (one row per tenant).
type GetElevatedAccessEntryForm struct {
	TenantID int64
	Result   *ElevatedAccessEntry
}

// CreateDSElevationConfigDTO is the request payload for enabling/updating the ELT elevation
// configuration. The owning user is taken from the session, never from the payload.
type CreateDSElevationConfigDTO struct {
	GroupID int64 `json:"groupId"`
}
