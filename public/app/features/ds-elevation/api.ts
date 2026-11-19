import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

// UI contract for the combined DS elevation GET endpoint. Config managers receive the full config;
// elevated-group members receive only the logo fields (visible/role/userLogin/groupName). Hence every field except `visible` is optional.
export interface DSElevationConfigResponse {
  tenantId?: number;
  userId?: number;
  groupId?: number;
  updatedAt?: string;
  // Resolved server-side so non-admin viewers can display the owner/group.
  userLogin?: string;
  groupName?: string;
  visible: boolean;
  role?: 'owner' | 'member';
}

// POST payload contract. The tenant and the owning user are derived from the session server-side.
export interface SaveDSElevationConfigRequest {
  groupId: number;
}

export interface DSElevationTeam {
  id: number;
  name: string;
  avatarUrl?: string;
}

const BASE_URL = '/api/bmc/ds-elevation-config';

const isConfigPayload = (data: unknown): data is DSElevationConfigResponse =>
  typeof data === 'object' && data !== null && 'tenantId' in data && typeof data.tenantId === 'number';

// GET endpoint used by both the feature management page and the top-nav logo. The backend tailors the response by role and always includes `visible`. Anything unexpected falls back to {visible:false}.
export const getDSElevationConfig = async (): Promise<DSElevationConfigResponse> => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DSElevationConfigResponse | null>({
      url: BASE_URL,
      method: 'GET',
      showErrorAlert: false,
    })
  );

  if (response.status !== 200 || typeof response.data?.visible !== 'boolean') {
    return { visible: false };
  }

  return response.data;
};

export const saveDSElevationConfig = async (
  payload: SaveDSElevationConfigRequest
): Promise<DSElevationConfigResponse> => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DSElevationConfigResponse>({
      url: BASE_URL,
      method: 'POST',
      data: payload,
      showErrorAlert: false,
    })
  );

  if (response.status !== 200 || !isConfigPayload(response.data)) {
    throw new Error(`Unexpected response status while saving elevated dashboard access: ${response.status}`);
  }

  return response.data;
};

// Resolves with the HTTP status so callers can confirm the 204 delete contract.
export const deleteDSElevationConfig = async (): Promise<boolean> => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<void>({
      url: BASE_URL,
      method: 'DELETE',
      showErrorAlert: false,
    })
  );

  // The backend only confirms the deletion with 204 No Content.
  return response.status === 204;
};
