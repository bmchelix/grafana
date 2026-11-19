// BMC Changes: this file is used to normalize the dashboard for diffing.
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

// Kept dependency-light (type-only imports) so this can be used from the
// DetectChangesWorker web worker without pulling in heavy modules.

function isV2Spec(model: Dashboard | DashboardV2Spec): model is DashboardV2Spec {
  return 'elements' in model;
}

// Mutates `panel` in place, dropping auto-injected empty defaults.
function normalizePanel(panel: unknown): void {
  if (!panel || typeof panel !== 'object') {
    return;
  }

  // The scene serializer always emits `fieldConfig` (defaulting to
  // { defaults: {}, overrides: [] }) and a `title` for every panel. Old
  // dashboards (e.g. created on Grafana 9.2.2) don't store these keys, so the
  // initial-vs-changed diff flags them as spurious additions. Drop the
  // auto-injected empties so they don't count as user changes.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const p = panel as { fieldConfig?: { defaults?: unknown; overrides?: unknown }; title?: unknown };

  if (p.fieldConfig && typeof p.fieldConfig === 'object') {
    const { defaults, overrides } = p.fieldConfig;
    const defaultsEmpty =
      !defaults || (typeof defaults === 'object' && !Array.isArray(defaults) && Object.keys(defaults).length === 0);
    const overridesEmpty = !overrides || (Array.isArray(overrides) && overrides.length === 0);

    if (defaultsEmpty && overridesEmpty) {
      delete p.fieldConfig;
    }
  }

  if (p.title === '') {
    delete p.title;
  }
}

/**
 * Normalize a dashboard before diffing so that harmless, auto-injected defaults
 * (empty `fieldConfig` or empty panel `title`) don't count as user changes.
 *
 * This only affects how we compare "initial" vs "changed" when deciding if the
 * dashboard is dirty. It does NOT change what we send to the backend, nor the
 * `initialSaveModel` used elsewhere (export, tracking, JSON editor).
 */
export function normalizeDashboardForDiff<T extends Dashboard | DashboardV2Spec>(model: T): T {
  // v2 panels live under `elements` with a different shape; nothing to do here.
  if (isV2Spec(model)) {
    return model;
  }

  // Work on a deep clone so we never mutate the original objects.
  let clone: Dashboard;
  try {
    clone = JSON.parse(JSON.stringify(model));
  } catch {
    return model;
  }

  if (!Array.isArray(clone.panels)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return clone as T;
  }

  for (const panel of clone.panels) {
    if (!panel || typeof panel !== 'object') {
      continue;
    }

    // Row panels contain nested panels we should normalize too.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rowPanel = panel as { type?: string; panels?: unknown[] };
    if (rowPanel.type === 'row' && Array.isArray(rowPanel.panels)) {
      rowPanel.panels.forEach(normalizePanel);
      continue;
    }

    normalizePanel(panel);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return clone as T;
}
