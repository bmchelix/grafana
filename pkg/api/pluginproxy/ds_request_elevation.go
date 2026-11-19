// BMC file - DRJ71-20341 - vishaln

package pluginproxy

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"time"

	"github.bmc.com/DSOM-ADE/authz-go"
	"github.com/grafana/grafana/pkg/api/bmc/external"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type TenantElevationSettings struct {
	TenantID        int64                        `json:"tenantId"`
	UserID          int64                        `json:"userId"`
	GroupID         int64                        `json:"groupId"`
	WhitelistedURLs models.TenantWhiteListedUrls `json:"whitelistedUrls"`
}

const (
	ElevatedJWTCacheKey             = "elevated_jwt_"
	ElevatedJWTTTL                  = 10 * time.Minute
	BhdRequestElevationUserIdHeader = "x-bhd-request-elevation-userid"
)

var (
	elevationLogger = glog.New("data-proxy-log.elevation")
	// Errors
	couldNotGenerateJwtError  = errors.New("could not get JWT token for impersonation")
	elevationSettingsNotFound = errors.New("elevation settings not found for tenant")
	jwtValidationFailedError  = errors.New("JWT validation failed")
	pathNotWhitelistedError   = errors.New("request path is not whitelisted for elevation")

	getEltSettingsFromCacheFn func(ctx context.Context, orgID int64) (*models.TenantElevationSettings, bool, bool)
	setEltSettingsToCacheFn   func(ctx context.Context, orgID int64, settings *models.TenantElevationSettings)
	setEltNegativeCacheFn     func(ctx context.Context, orgID int64)
	deleteEltCacheFn          func(orgID int64)
)

// Method to URLs path mapping
// We are using regex to accomodate variable parts in the URL paths like version numbers in smart-graph-api.
// Be careful when updating these regex patterns as they are used to whitelist certain endpoints for request elevation.
// The endpoints MUST BE read-only and should not allow any modifications to the underlying data.
// Make sure to test compilation since MustCompile will panic if the regex is invalid.
var defaultWhiteListedPaths = models.TenantWhiteListedUrls{
	"GET": {
		*regexp.MustCompile(`\/api\/arsys\/v1.0\/fields\/`),
		*regexp.MustCompile(`\/api\/arsys\/v1.0\/form`),

		*regexp.MustCompile(`\/smart-graph-api\/api\/v\d+\.\d+\/data\/search`), /* Discovery endpoint */

		*regexp.MustCompile(`\/metrics-query-service\/api\/v1\.0\/label\/\w+\/values`), /* BHOM Endpoint - Label values */
		*regexp.MustCompile(`\/metrics-query-service\/api\/v1\.0\/labels`),             /* BHOM Endpoint - Label values */
		*regexp.MustCompile(`\/metrics-query-service\/api\/v1\.0\/series`),             /* BHOM Endpoint - Series query */
		*regexp.MustCompile(`\/metrics-query-service\/api\/v1\.0\/query`),              /* Metric query url */

		*regexp.MustCompile(`\/events-service\/api\/v1\.0\/events\/mapping`),                         /* BHOM Endpoint - Events mapping */
		*regexp.MustCompile(`\/events-service\/api\/v1\.0\/events\/configuration\/eventmgmtservice`), /* BHOM Endpoint - Event management service */

		*regexp.MustCompile(`\/logs-service\/api\/v1\.0\/logs\/mapping`), /* Logs service */

		*regexp.MustCompile(`\/opt\/api\/v1\/datamartservice\/datamarts`),                   /* Datamarts */
		*regexp.MustCompile(`\/opt\/api\/v1\/datamartservice\/datamarts\/\w+\/metadata`),    /* Datamarts */
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/tags`),                           /* Catalog proxy */
		*regexp.MustCompile(`\/opt\/api\/v1\/cfs\/dashboard\/business_services`),            /* Business service */
		*regexp.MustCompile(`\/opt\/api\/v1\/cfs\/dashboard\/business_service/\w+/results`), /* Business service */
	},
	"POST": {
		*regexp.MustCompile(`\/smart-graph-api\/api\/v\d+\.\d+\/data\/search`), /* Discovery endpoint */

		*regexp.MustCompile(`\/api\/arsys\/v1\.0\/report\/arsqlquery`), /* ITSM ARSQL endpoint */

		*regexp.MustCompile(`\/metrics-query-service\/api\/v1\.0\/query_range`), /* BHOM Endpoint - Panel metric query */

		*regexp.MustCompile(`\/events-service\/api\/v1\.0\/events\/msearch`), /* BHOM Endpoint - Events query */

		*regexp.MustCompile(`\/audit\/api\/v1\/audit_records\/search`), /* Audit search */

		*regexp.MustCompile(`\/cloud(security|ops)\/api\/v1\/\w+\/(parallel)?search`), /* Cloud Security search */

		*regexp.MustCompile(`\/managed-object-service\/api\/v1\.0\/entityTag\/(keys)|(values)|(entities)`), /* MOS endpoint - Entity tags */

		*regexp.MustCompile(`\/aif\/api\/v1\.0\/algorithm\/count`),             /* ITSM insights Jobs created */
		*regexp.MustCompile(`\/aif\/api\/v1\.0\/algorithm\/executions\/count`), /* ITSM insights number of executions */
		*regexp.MustCompile(`\/aif\/api\/v1\.0\/algorithm\/clusters`),          /* ITSM insights clusters */

		*regexp.MustCompile(`\/logs-service\/api\/v1\.0\/logs\/msearch`), /* Logs service */

		*regexp.MustCompile(`\/automation-console\/api\/v1\/reporting\/query`),

		*regexp.MustCompile(`\/opt\/api\/v1\/analysis\/execute_real_time\/grafana_support`), /* BHCO endpoint */
		*regexp.MustCompile(`\/opt\/api\/v1\/datamartservice\/datamarts\/\w+\/data`),        /* Datamarts */
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/tags\/types`),                    /* Catalog proxy */
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/tags\/search`),                   /* Catalog proxy */
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/search`),                         /* Catalog proxy */
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/entities\/APP\/\w+\/flatsearch`),
		*regexp.MustCompile(`\/opt\/api\/v1\/catalogproxy\/entities\/APP\/\w+\/children/APP`),
	},
}

func parseWhiteListedURLsStringIntoRegex(whitelistedURLs map[string][]string) models.TenantWhiteListedUrls {
	compiled := make(models.TenantWhiteListedUrls)
	for method, patterns := range whitelistedURLs {
		regexList := make([]regexp.Regexp, 0, len(patterns))
		for _, pattern := range patterns {
			compiledPattern, err := regexp.Compile(pattern)
			if err != nil {
				elevationLogger.Error("invalid regex pattern in tenant whitelisted APIs", "error", err, "method", method, "pattern", pattern)
				return nil
			}
			regexList = append(regexList, *compiledPattern)
		}
		compiled[method] = regexList
	}
	return compiled
}

// getTenantElevationSettings retrieves a tenant's elevation settings, using a cache in front of the
// authoritative self-service config (elevated_access via the internal API).
//
// Redis is shared across pods: a hit (positive or negative) is returned directly, and a miss falls
// through to the API and repopulates Redis. The shared cache helpers also treat Redis failures as
// misses, so elevation settings still fall back to the authoritative API.
func (proxy *DataSourceProxy) getTenantElevationSettings() (*models.TenantElevationSettings, error) {
	orgID := proxy.ctx.OrgID
	ctx := proxy.ctx.Req.Context()

	if settings, eltEnabled, ok := GetEltSettingsFromCache(ctx, orgID); ok {
		if !eltEnabled {
			// Negative cache hit: tenant has no elevation config.
			return nil, elevationSettingsNotFound
		}
		elevationLogger.Debug("returning elevation settings from redis cache", "orgId", orgID)
		return settings, nil
	}

	// Cache miss or Redis failure: fetch the authoritative value.
	settings, err := proxy.getElevationSettingsFromAPI()
	if err != nil {
		if errors.Is(err, elevationSettingsNotFound) {
			// Remember "no config" so we don't hit the API on every request for this tenant.
			SetEltNegativeCache(ctx, orgID)
		}
		// Other transient errors are not cached.
		return nil, err
	}

	SetEltSettingsToCache(ctx, orgID, settings)
	elevationLogger.Debug("cached elevation settings in redis", "orgId", orgID, "elevatedUserId", settings.UserID, "elevationGroupId", settings.GroupID)
	return settings, nil
}

// getElevationSettingsFromAPI fetches user_id, group_id and whitelisted URLs from self-service config (elevated_access).
// Returns nil if config not found or on error.
func (proxy *DataSourceProxy) getElevationSettingsFromAPI() (*models.TenantElevationSettings, error) {
	username := proxy.cfg.AdminUser
	password := proxy.cfg.AdminPassword

	if username == "" || password == "" {
		elevationLogger.Debug("admin credentials not configured, cannot fetch ds elevation config", "orgId", proxy.ctx.OrgID)
		return nil, errors.New("admin credentials not configured")
	}

	auth := username + ":" + password
	encodedAuth := base64.StdEncoding.EncodeToString([]byte(auth))

	host := proxy.cfg.HTTPAddr + ":" + proxy.cfg.HTTPPort
	scheme := "http"
	url := fmt.Sprintf("%s://%s/api/internal/elt-whitelisted-urls/%d", scheme, host, proxy.ctx.OrgID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		elevationLogger.Debug("failed to create request for ds elevation config", "error", err, "orgId", proxy.ctx.OrgID)
		return nil, err
	}

	req.Header.Set("Authorization", "Basic "+encodedAuth)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		elevationLogger.Debug("failed to fetch ds elevation config", "error", err, "orgId", proxy.ctx.OrgID)
		return nil, err
	}
	defer resp.Body.Close()

	// 404 means no ELT config exists for this tenant
	if resp.StatusCode == http.StatusNotFound {
		elevationLogger.Debug("no ELT ds elevation config found", "orgId", proxy.ctx.OrgID)
		return nil, elevationSettingsNotFound
	}

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		elevationLogger.Debug("unexpected status from ds elevation config", "status", resp.StatusCode, "response", string(bodyBytes), "orgId", proxy.ctx.OrgID)
		return nil, errors.New("unexpected status from ds-elevation-config endpoint")
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		elevationLogger.Debug("failed to read ds elevation config response", "error", err, "orgId", proxy.ctx.OrgID)
		return nil, err
	}

	// Parse response: DSElevationConfigDTO has UserID, GroupID, Enabled
	var configDTO = &models.TenantElevationSettings{}

	if err := json.Unmarshal(bodyBytes, &configDTO); err != nil {
		elevationLogger.Debug("failed to unmarshal ds elevation config", "error", err, "orgId", proxy.ctx.OrgID)
		return nil, err
	}

	// Config must be enabled and have valid user_id
	if configDTO == nil || configDTO.UserID <= 0 {
		elevationLogger.Debug("ds elevation config not enabled or invalid user", "userId", configDTO.UserID, "orgId", proxy.ctx.OrgID)
		return nil, elevationSettingsNotFound
	}

	return configDTO, nil
}

// canElevateRequest checks if the request is eligible for elevation.
// Checks: DB/FF config exists, user has at least 1 team, user is in elevation group, method and path is whitelisted.
// Returns canElevate(bool), elevatedUserId(int64)
func (proxy *DataSourceProxy) canElevateRequest() (bool, int64) {
	// User must belong to at least 1 team
	if len(proxy.ctx.SignedInUser.Teams) == 0 {
		elevationLogger.Debug("user does not belong to any team", "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
		return false, -1
	}

	// Get tenant elevation settings from the shared Redis cache, falling back to the authoritative
	// self-service config (elevated_access) on a cache miss or when Redis is unavailable.
	elevationSettings, err := proxy.getTenantElevationSettings()

	if err != nil {
		if errors.Is(err, elevationSettingsNotFound) {
			// No elevation config for this tenant is expected; don't log as an error.
			elevationLogger.Debug("no elevation settings for tenant", "orgId", proxy.ctx.OrgID, "userId", proxy.ctx.UserID)
			return false, -1
		}
		elevationLogger.Error("failed to get elevation settings", "error", err, "orgId", proxy.ctx.OrgID, "userId", proxy.ctx.UserID)
		return false, -1
	}

	// Check if user belongs to the elevation group
	userInElevationGroup := slices.Contains(proxy.ctx.SignedInUser.Teams, elevationSettings.GroupID)

	if !userInElevationGroup {
		elevationLogger.Debug("user not in elevation group", "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID, "elevationGroupId", elevationSettings.GroupID)
		// Most users not being part of elevation group is expected and normal, so not logging as error
		return false, -1
	}

	// Determine which whitelisted paths to use: tenant-specific or default
	var whiteListedPathsMap models.TenantWhiteListedUrls
	if elevationSettings.WhiteListedURLs != nil {
		// Use tenant-specific whitelisted URLs from database
		whiteListedPathsMap = parseWhiteListedURLsStringIntoRegex(elevationSettings.WhiteListedURLs)
		elevationLogger.Debug("using tenant-specific whitelisted URLs", "orgId", proxy.ctx.OrgID, "userId", proxy.ctx.UserID)
	} else {
		// Use default whitelisted paths
		whiteListedPathsMap = defaultWhiteListedPaths
		elevationLogger.Debug("using default whitelisted URLs", "orgId", proxy.ctx.OrgID, "userId", proxy.ctx.UserID)
	}

	// Check if the request method has any whitelisted paths
	whiteListedPaths, methodExists := whiteListedPathsMap[proxy.ctx.Req.Method]
	if !methodExists {
		elevationLogger.Error("request elevation denied: no whitelisted paths for method", "method", proxy.ctx.Req.Method, "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
		return false, -1
	}

	// Check if the request URL matches any of the whitelisted paths
	requestPath := proxy.ctx.Req.URL.Path
	for _, pathRegex := range whiteListedPaths {
		if pathRegex.MatchString(requestPath) {
			elevationLogger.Debug("path match for elevation", "method", proxy.ctx.Req.Method, "path", requestPath, "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
			return true, elevationSettings.UserID
		}
	}

	// If we reach here, no path matched but request was fully eligible for elevation
	elevationLogger.Warn(pathNotWhitelistedError.Error(), "method", proxy.ctx.Req.Method, "path", requestPath, "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
	return false, -1
}

// getOrGenerateUserJWT retrieves JWT from cache or generates a new one
// This is internal method, not to be used directly in ds_proxy. Use getJWTTokenForElevatedRequest instead.
func (proxy *DataSourceProxy) getOrGenerateUserJWT(elevatedUserId int64) (string, error) {
	cacheInstance := authz.GetInstance()
	cacheKey := fmt.Sprintf("%s%d_%d", ElevatedJWTCacheKey, proxy.ctx.OrgID, elevatedUserId)

	// Check if JWT exists in cache
	if cachedJWT, found := cacheInstance.Get(cacheKey); found {
		if jwtToken, ok := cachedJWT.(string); ok && jwtToken != "" {
			// Validate the cached JWT to be safe and to check expiry
			if validateElevatedJWT(jwtToken, proxy.ctx.OrgID, elevatedUserId) {
				elevationLogger.Debug("using cached elevated JWT", "orgId", proxy.ctx.OrgID, "elevatedUserId", elevatedUserId)
				return jwtToken, nil
			}
			elevationLogger.Error("cached JWT validation failed, generating new token", "orgId", proxy.ctx.OrgID, "elevatedUserId", elevatedUserId)
		}
	}

	// Generate new JWT token using GenerateUserJWTUsingServiceAccount
	jwtToken, err := external.GenerateUserJWTUsingServiceAccount(proxy.ctx.OrgID, elevatedUserId)
	if err != nil {
		elevationLogger.Error("failed to generate elevated JWT", "error", err, "orgId", proxy.ctx.OrgID, "elevatedUserId", elevatedUserId)
		return "", couldNotGenerateJwtError
	}

	// Validate the newly generated JWT
	if !validateElevatedJWT(jwtToken, proxy.ctx.OrgID, elevatedUserId) {
		elevationLogger.Error("newly generated JWT validation failed", "orgId", proxy.ctx.OrgID, "elevatedUserId", elevatedUserId)
		return "", jwtValidationFailedError
	}

	// Cache the JWT for 10 minutes
	cacheInstance.Set(cacheKey, jwtToken, ElevatedJWTTTL)
	elevationLogger.Info("generated and cached new elevated JWT", "orgId", proxy.ctx.OrgID, "elevatedUserId", elevatedUserId)

	return jwtToken, nil
}

// validateElevatedJWT validates the JWT token using authz.Authorize
func validateElevatedJWT(jwtToken string, orgID int64, elevatedUserId int64) bool {
	if jwtToken == "" {
		return false
	}

	// Use authz.Authorize to validate the JWT token
	elevatedUser, err := authz.Authorize(jwtToken)

	// if JWT is expired, we expect error
	if err != nil {
		elevationLogger.Error("JWT authorization failed", "error", err, "orgId", orgID, "elevatedUserId", elevatedUserId)
		return false
	}

	// check tenant id
	if elevatedUser.Tenant_Id != strconv.FormatInt(orgID, 10) {
		elevationLogger.Error("elevated JWT tenant ID mismatch", "expected", orgID, "got", elevatedUser.Tenant_Id, "elevatedUserId", elevatedUserId)
		return false
	}

	// check user id
	if elevatedUser.UserID != strconv.FormatInt(elevatedUserId, 10) {
		elevationLogger.Error("elevated JWT user ID mismatch", "expected", elevatedUserId, "got", elevatedUser.UserID, "orgId", orgID)
		return false
	}

	return true
}

// getJWTTokenForElevatedRequest returns a JWT token of the elevated user id if the request is eligible for elevation.
// IF FF is disabled or request is not eligible for elevation, it returns an empty string.
// All errors are logged internally and not returned. This is the method to be used in ds_proxy for request elevation.
func (proxy *DataSourceProxy) getJWTTokenForElevatedRequest() string {
	canElevate, elevationUserId := proxy.canElevateRequest()

	if canElevate && elevationUserId != -1 {
		// Get or generate elevated JWT token
		jwtToken, err := proxy.getOrGenerateUserJWT(elevationUserId)

		if err != nil {
			elevationLogger.Error("failed to get elevated JWT", "error", err, "orgId", proxy.ctx.OrgID, "elevatedUserId", elevationUserId)
			elevationLogger.Info("proceeding without request elevation", "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
			return ""
		}

		if jwtToken != "" {
			proxy.ctx.Resp.Header().Set(BhdRequestElevationUserIdHeader, strconv.FormatInt(elevationUserId, 10))
			elevationLogger.Info("request elevated", "elevationUserId", elevationUserId, "requestingUserId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID)
			return jwtToken
		}
	}

	return ""
}

// ELT caching, helper functions - start

// to get the remote variable cache settings from the setting package
func GetRemoteVariableCacheSettings() *setting.RemoteVariableCacheSettings {
	return remoteVariableCacheSettings
}

// to register the ELT cache handlers
func RegisterEltCacheHandlers(
	getFn func(ctx context.Context, orgID int64) (*models.TenantElevationSettings, bool, bool),
	setFn func(ctx context.Context, orgID int64, settings *models.TenantElevationSettings),
	setNegativeFn func(ctx context.Context, orgID int64),
	deleteFn func(orgID int64),
) {
	getEltSettingsFromCacheFn = getFn
	setEltSettingsToCacheFn = setFn
	setEltNegativeCacheFn = setNegativeFn
	deleteEltCacheFn = deleteFn
}

// to get the ELT settings from the cache
func GetEltSettingsFromCache(ctx context.Context, orgID int64) (*models.TenantElevationSettings, bool, bool) {
	if getEltSettingsFromCacheFn == nil {
		return nil, false, false
	}
	return getEltSettingsFromCacheFn(ctx, orgID)
}

// to set the ELT settings to the cache
func SetEltSettingsToCache(ctx context.Context, orgID int64, settings *models.TenantElevationSettings) {
	if setEltSettingsToCacheFn == nil {
		return
	}
	setEltSettingsToCacheFn(ctx, orgID, settings)
}

// to set the ELT negative cache
func SetEltNegativeCache(ctx context.Context, orgID int64) {
	if setEltNegativeCacheFn == nil {
		return
	}
	setEltNegativeCacheFn(ctx, orgID)
}

// to delete the ELT cache
func DeleteEltCache(orgID int64) {
	if deleteEltCacheFn == nil {
		return
	}
	deleteEltCacheFn(orgID)
}

// ELT caching, helper functions - end
