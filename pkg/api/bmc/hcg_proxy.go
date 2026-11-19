package bmc

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
)

var hcgLogger = log.New("hcg-proxy")

// buildHCGApiUrl constructs the HCG kaazing service URL from the namespace.
func buildHCGApiUrl(namespace string) string {
	port := strings.TrimSpace(os.Getenv("HCG_KAAZING_API_PORT"))
	if port == "" {
		port = "2009"
	}
	return fmt.Sprintf("http://kaazing.%s.svc.cluster.local:%s", namespace, port)
}

// hcgServicesResponse wraps the HCG services list with the resolved namespace
type hcgServicesResponse struct {
	Namespace string            `json:"namespace"`
	Services  []json.RawMessage `json:"services"`
}

// GetHCGServices proxies the HCG service config request through the Grafana backend.

// GET /api/bmc/hcg/services?type=reverse&resourceType=<resourceType>
func (p *PluginsAPI) GetHCGServices(c *contextmodel.ReqContext) response.Response {
	// Resolve namespace from feature flag service
	namespace := external.GetHCGNamespace(c.Req, c.SignedInUser)
	if namespace == "" {
		return response.Error(http.StatusBadRequest, "HCG namespace not configured for this tenant", nil)
	}

	serviceType := c.Query("type")
	serviceType = strings.TrimSpace(serviceType)
	if serviceType == "" {
		serviceType = "reverse"
	}
	if serviceType != "reverse" {
		return response.Error(http.StatusBadRequest, "Invalid HCG service type", nil)
	}

	resourceType := c.Query("resourceType")
	resourceType = strings.TrimSpace(resourceType)
	if resourceType == "" {
		return response.Error(http.StatusBadRequest, "Missing HCG resource type", nil)
	}

	hcgBaseUrl := buildHCGApiUrl(namespace)
	apiUrl := fmt.Sprintf("%s/api/v1/services/config?type=%s&resourceType=%s", hcgBaseUrl, serviceType, resourceType)

	hcgLogger.Debug("Proxying HCG services request", "namespace", namespace, "url", apiUrl, "resourceType", resourceType, "orgId", c.OrgID)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", apiUrl, nil)
	if err != nil {
		hcgLogger.Error("Failed to create HCG request", "error", err)
		return response.Error(http.StatusInternalServerError, "Failed to create HCG request", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		hcgLogger.Error("Failed to connect to HCG service", "error", err, "url", apiUrl)
		return response.Error(http.StatusBadGateway, "Failed to connect to HCG service", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		hcgLogger.Error("Failed to read HCG response", "error", err)
		return response.Error(http.StatusInternalServerError, "Failed to read HCG response", err)
	}

	// Validate that the response is valid JSON
	var services []json.RawMessage
	if err := json.Unmarshal(body, &services); err != nil {
		hcgLogger.Error("HCG response is not valid JSON array", "error", err, "body", string(body))
		return response.Error(http.StatusInternalServerError, "Invalid response from HCG service", err)
	}

	result := hcgServicesResponse{
		Namespace: namespace,
		Services:  services,
	}

	return response.JSON(http.StatusOK, result)
}
