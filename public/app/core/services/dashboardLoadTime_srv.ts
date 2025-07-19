import { LoadingState } from '@grafana/data';
import config from 'app/core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getWidgetPluginMeta } from 'app/features/panel/state/util';

type DashboardInfo = { 
  id: string;
  name: string;
  panelIsInViewCount: Number;
  dashboardInEdit: Boolean;
}

const POST_FRONTEND_METRICS = '/api/frontend-metrics';
const VISIBILITY_CHANGE = "visibilitychange";


class DashboardLoadTime {
  static _instance: DashboardLoadTime;
  private loadTimeRecorded: boolean | false;
  private startTime: number | 0;
  private loadTimeBeforeInActiveTab: number | 0;
  private dashboardInfo: DashboardInfo;
  private dashboardPanelRendered: number | 0;
  private dashboardPanelRenderedFailed: boolean | false;
  private skipPanels: string[];

  constructor() {
    this.loadTimeRecorded = false;
    this.startTime = 0;
    this.loadTimeBeforeInActiveTab = 0;
    this.dashboardInfo = this.extractDashboardInfo(null);
    this.dashboardPanelRendered = 0;
    this.dashboardPanelRenderedFailed = false;
    this.skipPanels = getWidgetPluginMeta().map((p)=> p.id);
  }

  private extractDashboardInfo(dashboard: any): DashboardInfo {
    const localDashboardInfo: DashboardInfo = {
      id: dashboard?.id || '',
      name: dashboard?.title || '',
      panelIsInViewCount: dashboard?.panels?.filter((panel: any) => panel.isInView && !this.skipPanels.includes(panel.type))?.length || 0,
      dashboardInEdit: dashboard?.panelInEdit ? true : false || false
    };
    return localDashboardInfo;
  }


  public setDashboardInfo(dashboardInfo: any) {
    this.dashboardInfo = this.extractDashboardInfo(dashboardInfo);
  }

  public setDashboardPanelRendered(panelStatus: LoadingState) {
    if (!this.dashboardInfo.dashboardInEdit) {
      if (panelStatus === LoadingState.Done) {
        this.dashboardPanelRendered = this.dashboardPanelRendered + 1;
      } else if (panelStatus === LoadingState.Error) {
        // Counting as rendered even for if panel has error, since it is still counted as a valid view (for usage data API)
        this.dashboardPanelRendered = this.dashboardPanelRendered + 1;
        this.dashboardPanelRenderedFailed = true;
      }
      this.checkDashboardIsReady();
    }
  }

  public reset() {
    this.loadTimeRecorded = false;
    this.dashboardPanelRenderedFailed = false;
    this.startTime = new Date().getTime();
    this.dashboardInfo = this.extractDashboardInfo(null);
    this.dashboardPanelRendered = 0;
    this.loadTimeBeforeInActiveTab = 0;
    document.addEventListener(VISIBILITY_CHANGE, this.handleVisibilityChange);
  }

  private checkDashboardIsReady(): void {
    if (
      !this.isPuppeteer() &&
      !this.loadTimeRecorded &&
      !this.dashboardInfo.dashboardInEdit &&
      this.startTime &&
      this.dashboardInfo.panelIsInViewCount &&
      this.dashboardInfo.panelIsInViewCount === this.dashboardPanelRendered
    ) {
      const END_TIME = new Date().getTime();
      const loadTime = Math.round((END_TIME - this.startTime) / 1000) + this.loadTimeBeforeInActiveTab;
      this.loadTimeRecorded = true;
      console.log(`The ${this.dashboardInfo.name}, dashboard load time: ${loadTime}`);
      document.removeEventListener(VISIBILITY_CHANGE, this.handleVisibilityChange);
      
      // Post dashboard insight
      getBackendSrv().post(
        POST_FRONTEND_METRICS,
        this.constructPostRequest(loadTime, this.dashboardInfo.id, !this.dashboardPanelRenderedFailed),
        {
          retry: 0,
          showErrorAlert: false,
        }
      );
    }
  }

  private handleVisibilityChange = () => {
    if(!this.isPuppeteer() && !this.loadTimeRecorded){
      if (document.hidden) {
        const END_TIME = new Date().getTime();
        this.loadTimeBeforeInActiveTab = Math.round((END_TIME - this.startTime) / 1000) + this.loadTimeBeforeInActiveTab;
      } else {
        this.startTime = new Date().getTime();
      }
    }
  };

  private isPuppeteer = () => navigator.webdriver === true;

  private constructPostRequest(loadTime: number, dashboardId: string, dashboardAllPanelsLoadedSuccess: boolean): any {
    let postBody = {
      events: [
        {
          name: 'api_dashboard_hit',
          value: 1,
          labels: {
            dashboard_id: dashboardId?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
        {
          name: 'api_dashboard_hit_with_user_info',
          value: 1,
          labels: {
            dashboard_id: dashboardId?.toString(),
            user_id: config.bootData.user.id?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
        {
          name: 'api_user_dashboard_hit',
          value: 1,
          labels: {
            user_id: config.bootData.user.id?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
      ],
    };
    if (dashboardAllPanelsLoadedSuccess) {
      // we consider load time metric only if all panels in view have been loaded sucessfully .
      postBody.events.push({
        name: 'api_dashboard_loadtime',
        value: loadTime,
        labels: {
          dashboard_id: dashboardId?.toString(),
          tenant_id: config.bootData.user.orgId?.toString(),
        },
      });
    }
    return postBody;
  }

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }
}

export const dashboardLoadTime = DashboardLoadTime.Instance;
