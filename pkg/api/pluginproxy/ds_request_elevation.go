// BMC file - DRJ71-20341 - vishaln

package pluginproxy

import (
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
)

type TenantWhiteListedUrls map[string][]regexp.Regexp

const (
	TenantElevationCacheKey         = "tenant_ds_elevation_"
	ElevatedJWTCacheKey             = "elevated_jwt_"
	ElevationSettingsTTL            = 1 * time.Hour
	ElevatedJWTTTL                  = 10 * time.Minute
	BhdRequestElevationUserIdHeader = "x-bhd-request-elevation-userid"
)

var (
	elevationLogger = glog.New("data-proxy-log.elevation")
	// Errors
	couldNotGenerateJwtError  = errors.New("could not get JWT token for impersonation")
	elevationSettingsNotFound = errors.New("elevation settings not found for tenant")
	invalidElevationSettings  = errors.New("invalid elevation settings JSON")
	jwtValidationFailedError  = errors.New("JWT validation failed")
	pathNotWhitelistedError   = errors.New("request path is not whitelisted for elevation")
)

// Method to URLs path mapping
// We are using regex to accomodate variable parts in the URL paths like version numbers in smart-graph-api.
// Be careful when updating these regex patterns as they are used to whitelist certain endpoints for request elevation.
// The endpoints MUST BE read-only and should not allow any modifications to the underlying data.
// Make sure to test compilation since MustCompile will panic if the regex is invalid.
var defaultWhiteListedPaths = TenantWhiteListedUrls{
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

type tenantElevationSettings struct {
	ElevationGroupId      int64                 `json:"group_id"`
	ElevatedUserId        int64                 `json:"user_id"`
	TenantWhiteListedURLs TenantWhiteListedUrls `json:"whitelisted_urls,omitempty"`
}

// We allow tenants to have their own whitelisted APIs for request elevation.
// This method fetches those whitelisted APIs from the tenant elevation settings.
// If no tenant-specific whitelisted APIs are found, it returns nil
// We can also use SQL store but don't want to add sqlservice to ds_proxy, so using localhost API call
func (proxy *DataSourceProxy) getTenantWhitelistedAPIs() TenantWhiteListedUrls {
	// Prepare basic auth header using admin credentials
	username := proxy.cfg.AdminUser
	password := proxy.cfg.AdminPassword

	if username == "" || password == "" {
		elevationLogger.Error("admin credentials not configured, cannot fetch tenant whitelisted APIs", "orgId", proxy.ctx.OrgID)
		return nil
	}

	// Combine username and password in the format "username:password"
	auth := username + ":" + password
	// Encode the auth string to base64
	encodedAuth := base64.StdEncoding.EncodeToString([]byte(auth))

	// Make a GET request to localhost Grafana API to fetch tenant elevation settings
	host := proxy.cfg.HTTPAddr + ":" + proxy.cfg.HTTPPort
	scheme := "http"
	url := fmt.Sprintf("%s://%s/api/external/ds-elevate-request/%d", scheme, host, proxy.ctx.OrgID)

	req, err := http.NewRequest("GET", url, nil)

	if err != nil {
		elevationLogger.Error("failed to create request for tenant whitelisted APIs", "error", err, "orgId", proxy.ctx.OrgID)
		return nil
	}

	// Set basic auth header
	req.Header.Set("Authorization", "Basic "+encodedAuth)
	req.Header.Set("Content-Type", "application/json")

	// Create HTTP client and make the request
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		elevationLogger.Error("failed to fetch tenant whitelisted APIs", "error", err, "orgId", proxy.ctx.OrgID)
		return nil
	}
	defer resp.Body.Close()

	// Handle 404 - no tenant-specific whitelisted APIs configured
	if resp.StatusCode == http.StatusNotFound {
		elevationLogger.Debug("no tenant-specific whitelisted APIs found", "orgId", proxy.ctx.OrgID)
		return nil
	}

	// Handle other non-200 status codes
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		elevationLogger.Error("failed to fetch tenant whitelisted APIs", "status", resp.StatusCode, "response", string(bodyBytes), "orgId", proxy.ctx.OrgID)
		return nil
	}

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		elevationLogger.Error("failed to read response body for tenant whitelisted APIs", "error", err, "orgId", proxy.ctx.OrgID)
		return nil
	}

	// Parse response into DTO with raw patterns
	var elevationData models.DSElevationDataDTO
	if err := json.Unmarshal(bodyBytes, &elevationData); err != nil {
		elevationLogger.Error("failed to unmarshal tenant whitelisted APIs response", "error", err, "orgId", proxy.ctx.OrgID)
		return nil
	}

	compiled := make(TenantWhiteListedUrls)
	for method, patterns := range elevationData.WhiteListedURLs {
		regexList := make([]regexp.Regexp, 0, len(patterns))
		for _, pattern := range patterns {
			compiledPattern, err := regexp.Compile(pattern)
			if err != nil {
				elevationLogger.Error("invalid regex pattern in tenant whitelisted APIs", "error", err, "orgId", proxy.ctx.OrgID, "method", method, "pattern", pattern)
				return nil
			}
			regexList = append(regexList, *compiledPattern)
		}
		compiled[method] = regexList
	}

	// Return the whitelisted URLs, could be nil if the field is not set
	elevationLogger.Debug("successfully fetched tenant whitelisted APIs", "orgId", proxy.ctx.OrgID, "methodsCount", len(compiled))
	return compiled
}

// getTenantElevationSettings retrieves elevation settings from cache
// If absent, fetches from feature flag service and stores in cache
func (proxy *DataSourceProxy) getTenantElevationSettings() (*tenantElevationSettings, error) {
	cacheInstance := authz.GetInstance()
	cacheKey := TenantElevationCacheKey + strconv.FormatInt(proxy.ctx.OrgID, 10)

	// Check if settings exist in cache
	if cachedSettings, found := cacheInstance.Get(cacheKey); found {
		if settings, ok := cachedSettings.(*tenantElevationSettings); ok {
			if settings != nil {
				elevationLogger.Debug("returning cached elevation settings", "orgId", proxy.ctx.OrgID)
				return settings, nil
			}
		}
	}

	// Fetch from FeatureFlag.Value()
	settingsJSON := external.FeatureFlagDSRequestElevation.Value(proxy.ctx.Req, proxy.ctx.SignedInUser)
	if settingsJSON == "" {
		elevationLogger.Debug("elevation settings not found in feature flag", "orgId", proxy.ctx.OrgID)
		return nil, elevationSettingsNotFound
	}

	// Parse JSON to tenantElevationSettings
	var settings tenantElevationSettings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		elevationLogger.Error("failed to parse elevation settings JSON", "error", err, "orgId", proxy.ctx.OrgID, "json", settingsJSON)
		return nil, invalidElevationSettings
	}

	// Validate settings
	if settings.ElevatedUserId <= 0 {
		elevationLogger.Error("invalid elevated user id in settings", "elevatedUserId", settings.ElevatedUserId, "orgId", proxy.ctx.OrgID)
		return nil, invalidElevationSettings
	}

	// Fetch custom whitelisted URLs
	customWhitelistedAPIs := proxy.getTenantWhitelistedAPIs()
	if customWhitelistedAPIs != nil {
		settings.TenantWhiteListedURLs = customWhitelistedAPIs
		elevationLogger.Info("using custom tenant whitelisted URLs", "orgId", proxy.ctx.OrgID, "methodsCount", len(customWhitelistedAPIs))
	} else {
		elevationLogger.Info("no custom tenant whitelisted URLs found, using default", "orgId", proxy.ctx.OrgID)
	}

	// Save to cache for 1 hour
	cacheInstance.Set(cacheKey, &settings, ElevationSettingsTTL)
	elevationLogger.Info("cached elevation settings", "orgId", proxy.ctx.OrgID, "elevatedUserId", settings.ElevatedUserId, "elevationGroupId", settings.ElevationGroupId)

	return &settings, nil
}

// canElevateRequest checks if the request is eligible for elevation.
// Does FF check, has atleast 1 team, method and path is whitelisted.
// Returns canElevate(bool), elevatedUserId(int64), error
func (proxy *DataSourceProxy) canElevateRequest() (bool, int64) {
	// Feature flag must be enabled
	if !external.FeatureFlagDSRequestElevation.Enabled(proxy.ctx.Req, proxy.ctx.SignedInUser) {
		return false, -1
	}

	// User must belong to atleast 1 team
	if len(proxy.ctx.SignedInUser.Teams) == 0 {
		return false, -1
	}

	// Get tenant elevation settings from cache or feature flag
	elevationSettings, err := proxy.getTenantElevationSettings()

	if err != nil {
		elevationLogger.Error("failed to get elevation settings", "error", err, "orgId", proxy.ctx.OrgID, "userId", proxy.ctx.UserID)
		return false, -1
	}

	// Check if user belongs to the elevation group
	userInElevationGroup := slices.Contains(proxy.ctx.SignedInUser.Teams, elevationSettings.ElevationGroupId)

	if !userInElevationGroup {
		elevationLogger.Debug("user not in elevation group", "userId", proxy.ctx.UserID, "orgId", proxy.ctx.OrgID, "elevationGroupId", elevationSettings.ElevationGroupId)
		// Most users not being part of elevation group is expected and normal, so not logging as error
		return false, -1
	}

	// Determine which whitelisted paths to use: tenant-specific or default
	var whiteListedPathsMap map[string][]regexp.Regexp
	if elevationSettings.TenantWhiteListedURLs != nil {
		// Use tenant-specific whitelisted URLs from database
		whiteListedPathsMap = elevationSettings.TenantWhiteListedURLs
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
			return true, elevationSettings.ElevatedUserId
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
