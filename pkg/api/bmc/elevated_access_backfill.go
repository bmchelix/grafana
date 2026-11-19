package bmc

// One-time migration helper.
// This whole file exists only to migrate tenants from the feature-flag based
// DS request elevation (bhd_ds_request_elevation) to the self-service elevated_access table.

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const elevatedAccessFeatureFlagName = "bhd_ds_request_elevation"

// ElevatedAccessBackfillOpKey / ElevatedAccessBackfillTenantID identify the single row that records
// completion of the one-time feature-flag -> elevated_access backfill. tenant_id 1 is reused as the
// "global" value, matching the existing report_events_offset marker row. In miscellaneous_store PK is combination of tenant_id and op_key, which will be always unique and won't cause conflicts.
const ElevatedAccessBackfillOpKey = "ELEVATED_ACCESS_BACKFILL"
const ElevatedAccessBackfillTenantID int64 = 1

var backfillLogger = glog.New("elevated-access-backfill")

type ffElevationValue struct {
	GroupID int64 `json:"group_id"`
	UserID  int64 `json:"user_id"`
}

// backfillMarker is stored as JSON in the miscellaneous_store completion row for auditing.
type backfillMarker struct {
	CompletedAt time.Time `json:"completedAt"`
}

// BackfillElevatedAccessFromFeatureFlags is a ONE-TIME migration that copies every tenant which had DS request elevation enabled via feature flag into the self-service elevated_access table.
// It is safe to run on every startup and across multiple pods: a completion marker in miscellaneous_store prevents repeat work, and per-tenant feature-flag disabling keeps each tenant idempotent even if the marker was never written
func (p *PluginsAPI) BackfillElevatedAccessFromFeatureFlags(ctx context.Context) {

	// Feature flags are disabled for this stack, so there is nothing to migrate. Don't write the marker: this is environment-dependent and cheap to re-check on the next startup.
	if !setting.FeatureFlagEnabled {
		backfillLogger.Info("feature flags disabled, skipping elevated access backfill")
		return
	}

	// Fast path: if the backfill already completed on a previous startup, do nothing (no HTTP call).
	if marker, err := p.store.GetMiscellaneousStoreEntry(ctx, &models.GetMiscellaneousStoreEntry{
		TenantID: ElevatedAccessBackfillTenantID,
		OpKey:    ElevatedAccessBackfillOpKey,
	}); err == nil {
		backfillLogger.Info("elevated access backfill already completed, skipping", "marker", marker.OpValue)
		return
	} else if !errors.Is(err, sqlstore.ErrMiscellaneousStoreEntryNotFound) {
		// Couldn't read the marker - bail without running so we don't risk a partial run; retry next restart.
		backfillLogger.Error("failed to read backfill completion marker, skipping this run", "error", err)
		return
	}
	backfillLogger.Info("Starting elevated access backfill")

	// Fetch every tenant that has the elevation feature flag set, in a single admin call.
	tenantFeatures, err := external.GetTenantFeaturesByNameForGrafanaAdmin(elevatedAccessFeatureFlagName)
	if err != nil {
		// We could not reach/read the feature flag service. Do NOT write the marker so the backfill is retried on the next restart instead of being permanently skipped.
		backfillLogger.Error("failed to fetch tenant feature flags, will retry on next startup", "error", err)
		return
	}

	// migrated/skipped are terminal for a tenant. transientFailures counts DB / FF-service errors that we expect to succeed on a retry; while any exist we intentionally skip writing the marker.
	migrated, skipped, failed := 0, 0, 0
	transientFailures := 0

	for _, tf := range tenantFeatures {
		// ignore global ("*") entries and any flag that is not actually turned on.
		if tf.Tenant == "" || tf.Tenant == "*" || !tf.Status {
			skipped++
			continue
		}

		tenantID, err := strconv.ParseInt(tf.Tenant, 10, 64)
		if err != nil {
			backfillLogger.Warn("skipping tenant with non-numeric id", "tenant", tf.Tenant, "error", err)
			skipped++
			continue
		}

		// user_id and group_id come from the feature flag "Value" JSON.
		var val ffElevationValue
		if err := json.Unmarshal([]byte(tf.Value), &val); err != nil {
			backfillLogger.Error("failed to parse feature flag value, skipping tenant", "tenantId", tenantID, "value", tf.Value, "error", err)
			failed++
			continue
		}

		// an elevated access config must have a valid master (elevated) user and a group id.
		if val.UserID <= 0 || val.GroupID <= 0 {
			backfillLogger.Warn("feature flag value missing user id or group id, skipping tenant", "tenantId", tenantID, "userId", val.UserID, "groupId", val.GroupID)
			failed++
			continue
		}

		// Check whether the tenant already has a self-service config row. GetDSElevationConfig
		// returns ErrElevatedAccessEntryNotFound when absent; err == nil means a row exists.
		_, err = p.store.GetDSElevationConfig(ctx, tenantID)
		if err == nil {
			// Row already exists (already migrated, or the tenant is already on self-service).
			// Not overriding it, and turning off stale feature flag.
			backfillLogger.Info("elevated access already exists for tenant, ensuring feature flag is disabled", "tenantId", tenantID)
			if disableErr := p.disableTenantElevationFF(tf); disableErr != nil {
				transientFailures++
			}
			skipped++
			continue
		}
		if !errors.Is(err, sqlstore.ErrElevatedAccessEntryNotFound) {
			// Unexpected error reading the config - transient, retry when next run.
			backfillLogger.Error("failed to check existing elevated access for tenant", "tenantId", tenantID, "error", err)
			transientFailures++
			continue
		}

		// No row exists - create the self-service row FIRST, then disable the flag.
		// Doing it in this order means a crash in between leaves the row present with the flag still on; the next run takes the "already exists" branch above and finishes disabling the flag.
		now := time.Now().UTC()
		entry := &models.ElevatedAccessEntry{
			TenantID:    tenantID,
			UserID:      val.UserID,
			GroupID:     val.GroupID,
			CreatedTime: now,
			UpdatedTime: now,
		}
		if err := p.store.InsertDSElevationConfig(ctx, entry); err != nil {
			// A concurrent pod may have inserted the row first (PK conflict). Re-check: if the row is now present treat it as migrated-by-other-pod/already-on-self-service and just disable the flag; otherwise it's a real transient DB error to retry next run.
			if _, getErr := p.store.GetDSElevationConfig(ctx, tenantID); getErr == nil {
				backfillLogger.Info("elevated access inserted concurrently by another pod, ensuring feature flag is disabled", "tenantId", tenantID)
				if disableErr := p.disableTenantElevationFF(tf); disableErr != nil {
					transientFailures++
				}
				skipped++
				continue
			}
			backfillLogger.Error("failed to insert elevated access for tenant", "tenantId", tenantID, "error", err)
			transientFailures++
			continue
		}

		// Row created - now disable the feature flag for this tenant.
		if disableErr := p.disableTenantElevationFF(tf); disableErr != nil {
			transientFailures++
		}

		migrated++
		backfillLogger.Info("migrated tenant to self-service elevated access", "tenantId", tenantID, "userId", val.UserID, "groupId", val.GroupID)
	}

	backfillLogger.Info("elevated access backfill pass complete", "migrated", migrated, "skipped", skipped, "failed", failed, "transientFailures", transientFailures)

	// Only record completion when nothing transient failed. Permanent per-tenant data problems (bad FF value) are counted in "failed" but do not block the marker, since retrying them is pointless. Transient failures leave the marker unwritten so the backfill runs again next time; already-migrated tenants are naturally skipped (row present + flag off).

	if transientFailures > 0 {
		backfillLogger.Warn("skipping backfill completion marker due to transient failures; will retry on next startup", "transientFailures", transientFailures)
		return
	}

	markerBytes, err := json.Marshal(backfillMarker{
		CompletedAt: time.Now().UTC(),
	})
	if err != nil {
		backfillLogger.Error("failed to marshal backfill completion marker", "error", err)
		return
	}

	if err := p.store.SaveMiscellaneousStoreEntry(ctx, &models.MiscellaneousStoreEntry{
		TenantID: ElevatedAccessBackfillTenantID,
		OpKey:    ElevatedAccessBackfillOpKey,
		OpValue:  string(markerBytes),
	}); err != nil {
		if errors.Is(err, sqlstore.ErrMiscellaneousStoreEntryAlreadyExists) {
			// Another pod wrote the marker first - that's fine, the backfill is done.
			backfillLogger.Info("backfill completion marker already present (written by another pod)")
			return
		}
		backfillLogger.Error("failed to write backfill completion marker", "error", err)
		return
	}

	backfillLogger.Info("elevated access backfill complete, completion marker written", "migrated", migrated, "skipped", skipped, "failed", failed)
}

// disableTenantElevationFF turns off the elevation feature flag for the given tenant, preserving its value.
func (p *PluginsAPI) disableTenantElevationFF(tf external.Tenantfeatures) error {
	payload := external.SetTenantFeatureRequest{
		Name:         elevatedAccessFeatureFlagName,
		Status:       false,
		Tenant:       tf.Tenant,
		Solution:     "dashboards",
		FeatureLevel: "Service",
		Description:  "DRJ71-20268 - ELT elevated access (disabled after self-service backfill)",
		Value:        tf.Value,
	}
	if err := external.DisableTenantFeatureForGrafanaAdmin(payload); err != nil {
		backfillLogger.Error("failed to disable legacy elevation feature flag for tenant", "tenant", tf.Tenant, "error", err)
		return err
	}
	backfillLogger.Info("disabled legacy elevation feature flag for tenant", "tenant", tf.Tenant)
	return nil
}
