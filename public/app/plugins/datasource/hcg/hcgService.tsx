// bmc change: hcgservice (kaazing)
import { getBackendSrv } from '@grafana/runtime';

// Feature flag name for external datasource
export const HCG_NAMESPACE_FEATURE_FLAG = 'bhd-external-ds';

export interface HCGServiceConfig {
  serviceName: string;
  serviceDescription: string;
  servicePorts: number[];
  resourceId?: string;
  resourceType: string;
  resourceInfo?: string;
}

export type ResourceType =
  | 'grafana-postgresql-datasource'
  | 'elasticsearch'
  | 'prometheus'
  | 'mysql'
  | 'mssql';

interface HCGBackendResponse {
  namespace: string;
  services: HCGServiceConfig[];
}

export interface HCGFetchResult {
  services: HCGServiceConfig[];
  namespace: string | null;
  error: string | null;
  isConfigured: boolean;
}

/**
 * Fetches the list of available HCG on-premise resources for a given resource type.
 * 
 * The namespace is resolved server-side by the Grafana backend from the feature flag service
 *
 * API: GET /api/bmc/hcg/services?type=reverse&resourceType=<resourceType>
 *
 * @param resourceType - Type of resource to fetch (elasticsearch, prometheus, etc.)
 * @returns Object with services array, resolved namespace, error message, and configuration status
 */
export async function fetchHCGServices(resourceType: ResourceType): Promise<HCGFetchResult> {
  try {
    const response = await getBackendSrv().get<HCGBackendResponse>('/api/bmc/hcg/services', {
      type: 'reverse',
      resourceType: resourceType,
    });

    return {
      services: response.services || [],
      namespace: response.namespace || null,
      error: null,
      isConfigured: true,
    };
  } catch (error: any) {
    console.error('Failed to fetch HCG services:', error);

    let errorMessage = 'Failed to connect to HCG service.';
    if (error?.status === 400) {
      // Namespace not configured — feature flag not set
      errorMessage = 'HCG is not configured for this tenant. Please contact your administrator to enable the external datasource feature for SAAS environment';
      return {
        services: [],
        namespace: null,
        error: errorMessage,
        isConfigured: false,
      };
    } else if (error?.status === 502) {
      errorMessage = 'HCG service is unreachable. Please verify the service is running.';
    } else if (error?.data?.message) {
      errorMessage = error.data.message;
    }

    return {
      services: [],
      namespace: null,
      error: errorMessage,
      isConfigured: true,
    };
  }
}

/**
 * Constructs a URL from HCG service configuration.
 * Format: https://<serviceName>.<namespace>.svc.cluster.local:<servicePort>
 * Uses the first port from the servicePorts array.
 *
 * @param service - HCG service configuration object
 * @param namespace - The HCG namespace
 * @returns Formatted URL
 */
export function buildServiceUrl(service: HCGServiceConfig, namespace: string | null, resourceType: ResourceType): string {
  const port = service.servicePorts?.[0] ?? '';
  const isDatabaseResource = resourceType === 'grafana-postgresql-datasource' || resourceType === 'mysql' || resourceType === 'mssql';
  const host = `kaazing.${namespace}.svc.cluster.local:${port}`;
  return isDatabaseResource ? host : `https://${host}`;
}
