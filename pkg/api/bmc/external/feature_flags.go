package external

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.bmc.com/DSOM-ADE/authz-go"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	TenantFeatureCacheKey = "tenant_features_"
	TenantValuesCacheKey  = "tenant_values_"
)

// GlobalFeatureResponse type
type GlobalFeatureResponse struct {
	Features []Features `json:"features"`
}

// Features type
type Features struct {
	Name         string `json:"Name"`
	State        string `json:"State"`
	Status       bool   `json:"Status"`
	Solution     string `json:"Solution"`
	Description  string `json:"Description"`
	FeatureLevel string `json:"FeatureLevel"`
	ID           int    `json:"id"`
}

type TenantFeatureResponse struct {
	Tenantfeatures []Tenantfeatures `json:"tenantfeatures"`
}
type Tenantfeatures struct {
	Name         string `json:"Name"`
	State        string `json:"State,omitempty"`
	Status       bool   `json:"Status"`
	Solution     string `json:"Solution"`
	Description  string `json:"Description,omitempty"`
	FeatureLevel string `json:"FeatureLevel"`
	ID           int    `json:"id"`
	Tenant       string `json:"Tenant"`
	Disabled     bool   `json:"disabled,omitempty"`
	Value        string `json:"value,omitempty"`
}

func GetTenantFeaturesFromService(tenantId int64, imsToken string) []Tenantfeatures {
	var logger = log.New("feature_flag")

	tenantFeatureResponse := TenantFeatureResponse{
		Tenantfeatures: make([]Tenantfeatures, 0),
	}
	tenantFeaturesURL := fmt.Sprintf("%s/tenantfeatures?Tenant=%d", setting.FeatureFlagEndpoint, tenantId)
	client := http.Client{}
	req, _ := http.NewRequest("GET", tenantFeaturesURL, nil)
	req.Header.Add("Authorization", "Bearer "+imsToken)

	res, err := client.Do(req)
	if res != nil {
		if res.StatusCode != 200 {
			body, _ := ioutil.ReadAll(res.Body)
			defer res.Body.Close()
			if err != nil {
				logger.Info(string(body))
			}
			logger.Info("status is not 200 returning empty array", "status", res.Status)
			return tenantFeatureResponse.Tenantfeatures
		}
	} else {
		logger.Info("result set is null or tenant feature flag service is not available, returning empty array")
		return tenantFeatureResponse.Tenantfeatures
	}
	if err != nil {
		logger.Info(err.Error())
	}

	body, err := io.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		logger.Info(err.Error())
	}
	if err := json.Unmarshal(body, &tenantFeatureResponse); err != nil {
		logger.Error("failed to unmarshal body")
	}
	return tenantFeatureResponse.Tenantfeatures
}

func GetTenantFeaturesFromServiceForGrafanaAdmin(tenantId int64) []Tenantfeatures {
	var logger = log.New("feature_flag")

	tenantFeatureResponse := TenantFeatureResponse{
		Tenantfeatures: make([]Tenantfeatures, 0),
	}
	tenantFeaturesURL := fmt.Sprintf("%s/admin/tenantfeatures?Tenant=%d", setting.FeatureFlagEndpoint, tenantId)
	apiKey := os.Getenv("OPS_API_KEY")
	if apiKey == "" {
		logger.Error("OPS_API_KEY not set")
		return tenantFeatureResponse.Tenantfeatures
	}
	client := http.Client{}
	req, _ := http.NewRequest("GET", tenantFeaturesURL, nil)
	req.Header.Add("x-bmc-ops-api-key", apiKey)

	res, err := client.Do(req)
	if err != nil {
		logger.Info(err.Error())
		return tenantFeatureResponse.Tenantfeatures
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(res.Body)
		defer res.Body.Close()
		if err != nil {
			logger.Info(string(body))
		}
		logger.Info("status is not 200 returning empty array", "status", res.Status)
		return tenantFeatureResponse.Tenantfeatures
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		logger.Error("failed to read response body", "error", err)
		return tenantFeatureResponse.Tenantfeatures
	}
	if err := json.Unmarshal(body, &tenantFeatureResponse); err != nil {
		logger.Error("failed to unmarshal body", "error", err)
		return tenantFeatureResponse.Tenantfeatures
	}
	return tenantFeatureResponse.Tenantfeatures
}

type FeatureFlag int

const (
	// FeatureFlagRMSMetadata is the feature flag for RMS Metadata
	FeatureFlagRMSMetadata FeatureFlag = iota

	// FeatureFlagGainSight is the feature flag for GainSight
	FeatureFlagGainSight

	// FeatureFlagDashboardBranding is the feature flag for Dashboard Branding
	FeatureFlagDashboardBranding

	// FeatureFlagReportsLogo is the feature flag to enable logo upload for reports
	FeatureFlagReportsLogo

	// FeatureFlagInsightFinder is the feature flag to enable Insight Finder application
	FeatureFlagInsightFinder

	// FeatureFlagBHDLocalization is the feature flag to enable bhd localization
	FeatureFlagBHDLocalization

	// FeatureFlagBHDScenes	is the feature flag to enable dashboard scenes
	FeatureFlagBHDScenes

	// FeatureFlagBHDVariableCaching is the feature flag to enable Redis Variable Caching - DRJ71-18644
	BHD_ENABLE_VAR_CACHING
	// FeatureFlagExternalDatasource is the feature flag to enable elasticsearch and prometheus datasource
	FeatureFlagExternalDatasource
	// BhdDynamicReportBurstingHeader is the feature flag to enable Dynamic Report Bursting - DRJ71-19432
	FeatureFlagDynamicReportBursting
	// FeatureFlagDSRequestElevation is the feature flag to enable DS Request Elevation
	FeatureFlagDSRequestElevation
)

func (feature FeatureFlag) String() string {
	switch feature {
	case FeatureFlagRMSMetadata:
		return "rms-metadata"
	case FeatureFlagGainSight:
		return "gainsight"
	case FeatureFlagDashboardBranding:
		return "branding"
	case FeatureFlagReportsLogo:
		return "bhd-reports-logo"
	case FeatureFlagInsightFinder:
		return "bhd-insightfinder"
	case FeatureFlagBHDLocalization:
		return "bhd-localization"
	case FeatureFlagBHDScenes:
		return "bhd-scenes"
	case BHD_ENABLE_VAR_CACHING:
		return "bhd_enable_var_caching"
	case FeatureFlagExternalDatasource:
		return "bhd-external-ds"
	case FeatureFlagDynamicReportBursting:
		return "bhd_dynamic_report_bursting"
	case FeatureFlagDSRequestElevation:
		return "bhd_ds_request_elevation"
	default:
		return ""
	}
}

func (feature FeatureFlag) Enabled(req *http.Request, signedInUser *user.SignedInUser) bool {
	if signedInUser.IsGrafanaAdmin && feature != FeatureFlagExternalDatasource {
		return true
	}

	if !setting.FeatureFlagEnabled {
		return true
	}

	if feature.String() == "" {
		return false
	}

	// BHD_ENABLE_VAR_CACHING requires FeatureFlagBHDScenes to be enabled
	if feature == BHD_ENABLE_VAR_CACHING {
		if !FeatureFlagBHDScenes.Enabled(req, signedInUser) {
			return false
		}
	}

	cacheInstance := authz.GetInstance()
	cacheKey := TenantFeatureCacheKey + strconv.Itoa(int(signedInUser.OrgID))
	if featureFlags, found := cacheInstance.Get(cacheKey); found {
		// enabled features is an array of strings of enabled feature names. we cache this array
		enabledFeatures := featureFlags.([]string)
		exists := false
		for _, val := range enabledFeatures {
			if val == feature.String() {
				exists = true
				break
			}
		}
		return exists
	} else {
		var tenantFeatures []Tenantfeatures
		if signedInUser.IsGrafanaAdmin {
			tenantFeatures = GetTenantFeaturesFromServiceForGrafanaAdmin(signedInUser.OrgID)
		} else {
			imsToken, err := GetIMSToken(req, signedInUser.OrgID, signedInUser.UserID)
			if err != nil && setting.Env != "development" {
				return false
			}
			tenantFeatures = GetTenantFeaturesFromService(signedInUser.OrgID, imsToken)
		}
		featureFlags := make([]string, 0)
		m := make(map[string]bool)
		for _, tf := range tenantFeatures {
			if tf.Status && !m[tf.Name] {
				m[tf.Name] = true
				featureFlags = append(featureFlags, tf.Name)
			}
		}
		cacheInstance.Set(cacheKey, featureFlags, 60*time.Minute)
		return m[feature.String()]
	}
}

// Returns the "Value" field of feature flag JSON if it exists, else empty string
// It caches a map of feature name -> value under key prefix TenantFeatureValuesCacheKey.
// If a feature's value is absent, it returns an empty string.
// Returns empty string when FF is disabled too!!
func (feature FeatureFlag) Value(req *http.Request, signedInUser *user.SignedInUser) string {
	// Not supported for Grafana Admin
	if signedInUser.IsGrafanaAdmin {
		return ""
	}

	if feature.String() == "" {
		return ""
	}

	if !setting.FeatureFlagEnabled {
		return ""
	}

	// we need to use a different cache key than enabled since that is a string -> bool map and here we need string -> string map
	cacheInstance := authz.GetInstance()
	cacheKey := TenantValuesCacheKey + strconv.Itoa(int(signedInUser.OrgID))
	if featureValues, found := cacheInstance.Get(cacheKey); found {
		// ffValues is a map of feature name -> string value
		ffValues := featureValues.(map[string]string)
		if v, ok := ffValues[feature.String()]; ok {
			logger.Debug("Fetched feature flag value from cache ", " tenantID ", signedInUser.OrgID, " feature ", feature.String(), " value ", v)
			return v
		}
	} else {
		imsToken, err := GetIMSToken(req, signedInUser.OrgID, signedInUser.UserID)
		if err != nil && setting.Env != "development" {
			return ""
		}
		tenantFeatures := GetTenantFeaturesFromService(signedInUser.OrgID, imsToken)
		ffValues := make(map[string]string)
		for _, feature := range tenantFeatures {
			if _, exists := ffValues[feature.Name]; !(exists && feature.Status) {
				logger.Info("Caching feature flag value ", " tenantID ", signedInUser.OrgID, " feature ", feature.Name, " value ", feature.Value)
				ffValues[feature.Name] = feature.Value
			}
		}
		cacheInstance.Set(cacheKey, ffValues, 60*time.Minute)
		if v, ok := ffValues[feature.String()]; ok {
			return v
		}
	}
	return ""
}

func FeatureAccess(feature FeatureFlag) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		ok := feature.Enabled(c.Req, c.SignedInUser)
		if !ok {
			accessForbidden(c)
		}
	}
}

func accessForbidden(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}
