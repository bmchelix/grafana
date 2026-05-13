import { Subscription } from 'rxjs';

import { AnnotationQuery, DashboardCursorSync, dateTimeFormat, DateTimeInput, EventBusSrv } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { dataLayersToAnnotations } from '../serialization/dataLayersToAnnotations';

import { PanelModelCompatibilityWrapper } from './PanelModelCompatibilityWrapper';
import { dashboardSceneGraph } from './dashboardSceneGraph';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from './utils';

/**
 * Will move this to make it the main way we remain somewhat compatible with getDashboardSrv().getCurrent
 */
export class DashboardModelCompatibilityWrapper {
  public events = new EventBusSrv();
  private _subs = new Subscription();

  public constructor(private _scene: DashboardScene) {
    const timeRange = sceneGraph.getTimeRange(_scene);

    // Copied from DashboardModel, as this function is passed around
    this.formatDate = this.formatDate.bind(this);

    this._subs.add(
      timeRange.subscribeToState((state, prev) => {
        if (state.value !== prev.value) {
          this.events.publish(new TimeRangeUpdatedEvent(state.value));
        }
      })
    );
  }

  public get id(): number | null {
    return this._scene.state.id ?? null;
  }

  public get uid() {
    return this._scene.state.uid ?? null;
  }

  public get title() {
    return this._scene.state.title;
  }

  public get description() {
    return this._scene.state.description;
  }

  public get editable() {
    return this._scene.state.editable;
  }

  public get graphTooltip() {
    return this._getSyncMode();
  }

  public get timepicker() {
    return {
      refresh_intervals: this._scene.state.controls!.state.refreshPicker.state.intervals,
      hidden: this._scene.state.controls!.state.hideTimeControls ?? false,
    };
  }

  public get timezone() {
    return this.getTimezone();
  }

  public get weekStart() {
    return sceneGraph.getTimeRange(this._scene).state.weekStart;
  }

  public get tags() {
    return this._scene.state.tags;
  }

  public get links() {
    return this._scene.state.links;
  }

  public get meta() {
    return this._scene.state.meta;
  }

  public get time() {
    const time = sceneGraph.getTimeRange(this._scene);
    return {
      from: time.state.from,
      to: time.state.to,
    };
  }

  public get panels() {
    const panels = findAllObjects(this._scene, (o) => {
      return Boolean(o instanceof VizPanel);
    });
    return panels.map((p) => new PanelModelCompatibilityWrapper(p as VizPanel));
  }

  /**
   * Used from from timeseries migration handler to migrate time regions to dashboard annotations
   */
  public get annotations(): { list: AnnotationQuery[] } {
    const annotations: { list: AnnotationQuery[] } = { list: [] };

    if (this._scene.state.$data instanceof DashboardDataLayerSet) {
      annotations.list = dataLayersToAnnotations(this._scene.state.$data.state.annotationLayers);
    }

    return annotations;
  }

  public getTimezone() {
    const time = sceneGraph.getTimeRange(this._scene);
    return time.getTimeZone();
  }

  public sharedTooltipModeEnabled() {
    return this._getSyncMode() > 0;
  }

  public sharedCrosshairModeOnly() {
    return this._getSyncMode() === 1;
  }

  private _getSyncMode() {
    if (this._scene.state.$behaviors) {
      for (const behavior of this._scene.state.$behaviors) {
        if (behavior instanceof behaviors.CursorSync) {
          return behavior.state.sync;
        }
      }
    }

    return DashboardCursorSync.Off;
  }

  public otherPanelInFullscreen(panel: unknown) {
    return false;
  }

  public formatDate(date: DateTimeInput, format?: string) {
    return dateTimeFormat(date, {
      format,
      timeZone: this.getTimezone(),
    });
  }

  public getPanelById(id: number): PanelModelCompatibilityWrapper | null {
    const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(id));
    if (vizPanel) {
      return new PanelModelCompatibilityWrapper(vizPanel);
    }

    return null;
  }

  /**
   * Mainly implemented to support Getting started panel's dissmis button.
   */
  public removePanel(panel: PanelModelCompatibilityWrapper) {
    const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(panel.id));
    if (!vizPanel) {
      console.error('Trying to remove a panel that was not found in scene', panel);
      return;
    }

    this._scene.removePanel(vizPanel);
  }

  public canEditAnnotations(dashboardUID?: string) {
    if (!this._scene.canEditDashboard()) {
      return false;
    }

    if (dashboardUID) {
      return Boolean(this._scene.state.meta.annotationsPermissions?.dashboard.canEdit);
    }

    return Boolean(this._scene.state.meta.annotationsPermissions?.organization.canEdit);
  }

  public panelInitialized() {}

  public destroy() {
    this.events.removeAllListeners();
    this._subs.unsubscribe();
  }

  public hasUnsavedChanges() {
    return this._scene.state.isDirty;
  }

  // BMC Change: Starts
  public makeRecordDetailsResposive() {
    const panelHeightMap = dashboardSceneGraph.getRecordDetailsHeightMap();
    if (Object.keys(panelHeightMap).length > 0) {
      const newChildren: SceneObject[] = [];
      (this._scene.state.body as DefaultGridLayoutManager).state.grid?.state.children.forEach((item, index) => {
        Array.prototype.push.apply(
          newChildren,
          dashboardSceneGraph.getDeflatedLayoutChildren(item, index, panelHeightMap)
        );
      });
      (this._scene.state.body as DefaultGridLayoutManager).state.grid.setState({
        children: newChildren,
      });
    }
  }

  public getPanelsForRenderer() {
    return this.panels
      .filter((p) => p._vizPanel.isActive)
      .map((p) => {
        return {
          // Use pathId (e.g., "P2$panel-5") instead of key — pathIds are unique across
          // repeated panels and match what SoloPanelContext expects for viewPanel URLs.
          id: p._vizPanel.getPathId(),
          description: p.description,
          type: p.type,
          title: p._vizPanel.interpolate(p.title, undefined, 'text'),
          transformations: p.transformations,
          datasource: p.datasource,
          options: p.options,
          fieldConfig: p.fieldConfig,
          pluginVersion: p.pluginVersion,
          _vizPanel: p._vizPanel,
        };
      });
  }

  public getPanelByIdForRenderer(id: string) {
    return this.getPanelsForRenderer().find((p) => p.id === id);
  }

  /**
   * Opens the inspect drawer for a panel identified by pathId or key.
   * Called by the renderer via grafanaRuntime.openInspect() after panels have loaded.
   */
  public openInspect(panelId: string, tab = 'data'): boolean {
    // Search all panels in the scene tree (not just active ones) so this works
    // immediately after navigation, before React has rendered/activated all panels.
    const panel = this.panels.find((p) => p._vizPanel.getPathId() === panelId || p.key === panelId)?._vizPanel;
    if (!panel) {
      return false;
    }

    const currentTab = Object.values(InspectTab).find((t) => t === tab) ?? InspectTab.Data;
    this._scene.setState({
      inspectPanelKey: panelId,
      overlay: new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab }),
    });
    return true;
  }
  // BMC Change: Ends
}

function findAllObjects(root: SceneObject, check: (o: SceneObject) => boolean) {
  let result: SceneObject[] = [];
  root.forEachChild((child) => {
    if (check(child)) {
      result.push(child);
    } else {
      result = result.concat(findAllObjects(child, check));
    }
  });

  return result;
}
