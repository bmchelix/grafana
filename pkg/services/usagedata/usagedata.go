package usagedata

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Service interface {
	GetDashboardsUsingDeprecatedPlugins(context.Context, int64) (PluginInfoResponse, error)
	GetUserData(context.Context, int64, string, string, string) (UserCountResponse, error)
	GetDashboardsReportScheduler(context.Context, string, string, int64, bool, bool) (UsageDataResponse, error)
	GetRolesAndPermissions(context.Context, int64, accesscontrol.DashboardPermissionsService, accesscontrol.FolderPermissionsService, int64) (RolesPermissionsResponse, error)
	GetOrgLevelDashboardStats(context.Context, string, string, int64) (OrgLevelDashboardStatisticsResponse, error)
	GetIndividualDashboardStats(context.Context, int64, int64) (IndividualDashboardStatisticsResponse, error)
	GetDashboardHits(context.Context, string, string, int64, int64) (DashboardHitsResponse, error)
	GetDashboardLoadTimes(context.Context, string, string, int64, int64) (DashboardLoadTimesResponse, error)
	GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, userID int64, dashboardID int64) (UsageDataResponse, error)
	GetDashboardDetails(context.Context, int64, string, string, string) (DashboardDetailsResponse, error)
	GetReportSchedulerStaging(context.Context, int64, string, string, string, bool) (ScheduleStagingResponse, error)
	GetNextRunSchedules(context.Context, int64) (ScheduleShortInfoResponse, error)
	GetActiveDashboardsCount(ctx context.Context, orgID int64) (ActiveDashboardsCountResponse, error)
	GetDataVolume(context.Context, int64, int64, string, string) (DataVolumeResponse, error)
	GetIFValueRealization(context.Context, int64, int64, string, string) (IFValueRealizationResponse, error)
	GetIFDashboardCount(context.Context, int64, int64, string, string) (IFDashboardCountResponse, error)
}
