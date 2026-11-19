// BMC file - Redis cache for self-service elevated dashboard access (ELT) tenant settings.
//
// This is a typed adapter over the shared GetFromCache, SetToCache, and DeleteFromCache helpers.
package bmc

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var eltCacheLogger = glog.New("data-proxy-log.eltcache")

func init() {
	pluginproxy.RegisterEltCacheHandlers(GetEltSettingsFromCache, SetEltSettingsToCache, SetEltNegativeCache, DeleteEltCache)
}

// Cache key per tenant. The shared helpers (SetToCache/GetFromCache) Snappy-compress the value;
// any old raw-JSON entry under this key is treated as a miss and repopulated on the next request.
const eltSettingsKeyFormat = "elt_settings_%d"

// eltCacheEntry is the JSON envelope stored in Redis. ELTEnabled=false is a negative cache entry
// (the tenant has no elevation config) so we don't hit the DB/API on every request for such tenants.
type eltCacheEntry struct {
	ELTEnabled bool                            `json:"eltEnabled"`
	Settings   *models.TenantElevationSettings `json:"settings,omitempty"`
}

func getELTSettingCacheKey(orgID int64) string {
	return fmt.Sprintf(eltSettingsKeyFormat, orgID)
}

// GetEltSettingsFromCache reads a tenant's elevation settings from Redis.
// Returns (settings, eltEnabled, ok):
//   - ok == false                      cache disabled, miss, or Redis error; caller should fall back to DB/API.
//   - ok == true, eltEnabled == false  negative cache hit (tenant has no elevation config).
//   - ok == true, eltEnabled == true   positive cache hit; settings is non-nil.
func GetEltSettingsFromCache(ctx context.Context, orgID int64) (*models.TenantElevationSettings, bool, bool) {
	key := getELTSettingCacheKey(orgID)

	settings := pluginproxy.GetRemoteVariableCacheSettings()
	if settings == nil || !settings.ELTCacheEnabled {
		eltCacheLogger.Debug("elt cache is disabled or not initialized", "orgId", orgID, "cacheKey", key)
		return nil, false, false
	}

	value, hit := pluginproxy.GetFromCache(ctx, key)
	if !hit {
		eltCacheLogger.Debug("elt redis cache miss", "orgId", orgID, "cacheKey", key)
		return nil, false, false
	}

	var entry eltCacheEntry
	if err := json.Unmarshal([]byte(value), &entry); err != nil {
		eltCacheLogger.Error("failed to unmarshal elt cache entry, treating as miss", "orgId", orgID, "error", err)
		return nil, false, false
	}
	if entry.ELTEnabled && entry.Settings == nil {
		eltCacheLogger.Error("invalid positive elt cache entry, treating as miss", "orgId", orgID)
		return nil, false, false
	}

	eltCacheLogger.Debug("elt redis cache hit", "orgId", orgID, "cacheKey", key, "eltEnabled", entry.ELTEnabled)
	return entry.Settings, entry.ELTEnabled, true
}

// SetEltSettingsToCache stores a positive entry (settings must be non-nil).
func SetEltSettingsToCache(ctx context.Context, orgID int64, settings *models.TenantElevationSettings) {
	setEltEntry(ctx, orgID, eltCacheEntry{ELTEnabled: true, Settings: settings})
}

// SetEltNegativeCache stores a negative entry so lookups for tenants without an elevation config
// don't hit the DB/API on every request.
func SetEltNegativeCache(ctx context.Context, orgID int64) {
	setEltEntry(ctx, orgID, eltCacheEntry{ELTEnabled: false})
}

func setEltEntry(ctx context.Context, orgID int64, entry eltCacheEntry) {
	settings := pluginproxy.GetRemoteVariableCacheSettings()
	if settings == nil {
		eltCacheLogger.Warn("remote variable cache settings not initialized, skipping elt cache set", "orgId", orgID)
		return
	}

	if !settings.ELTCacheEnabled {
		eltCacheLogger.Warn("elt cache is disabled, skipping elt cache set", "orgId", orgID)
		return
	}

	key := getELTSettingCacheKey(orgID)
	payload, err := json.Marshal(entry)
	if err != nil {
		eltCacheLogger.Error("failed to marshal elt cache entry", "orgId", orgID, "error", err)
		return
	}

	ttl := settings.EltCacheTTL
	pluginproxy.SetToCache(ctx, key, payload, ttl)
	eltCacheLogger.Debug("elt redis cache set", "orgId", orgID, "cacheKey", key, "eltEnabled", entry.ELTEnabled, "ttl", ttl)
}

// DeleteEltCache removes a tenant's cached elevation settings. It is safe to call when the cache is
// disabled (no-op) and is breaker-protected. Call this after any write that changes a tenant's
// elevation config (enable/update/disable), its whitelist, or when the owner/group is deleted.
func DeleteEltCache(orgID int64) {
	settings := pluginproxy.GetRemoteVariableCacheSettings()
	if settings == nil {
		eltCacheLogger.Warn("remote variable cache settings not initialized, skipping elt cache delete", "orgId", orgID)
		return
	}

	if !settings.Enabled {
		eltCacheLogger.Debug("redis client is disabled, skipping elt cache delete", "orgId", orgID)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), settings.BackgroundDeletionTimeout)
	defer cancel()

	key := getELTSettingCacheKey(orgID)
	if pluginproxy.DeleteFromCache(ctx, []string{key}) {
		eltCacheLogger.Info("elt redis cache deleted", "orgId", orgID, "cacheKey", key)
		return
	}
	eltCacheLogger.Warn("elt redis cache delete skipped", "orgId", orgID, "cacheKey", key)
}
