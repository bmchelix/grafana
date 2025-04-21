package audit

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"

	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var Log = log.New("Audit")

// ============================= Dashboard Audit ====================================

func DashboardCreateAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "New dashboard created.", OperationSubType: "Dashboard " + dashboard.Title + " created successfully."}, kp.DashboardCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard create failed.", OperationSubType: "Dashboard " + dashboard.Title + " create failed with error: " + err.Error()}, kp.DashboardCreateAudit)
	}
}

func DashboardUpdateAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard updated.", OperationSubType: "Dashboard " + dashboard.Title + " updated successfully."}, kp.DashboardUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard update failed.", OperationSubType: "Dashboard " + dashboard.Title + " update failed with error: " + err.Error()}, kp.DashboardUpdateAudit)
	}
}

func DashboardDeleteAudit(c *contextmodel.ReqContext, err error, dash ...*dashboards.Dashboard) {
	if err == nil {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard deleted.", OperationSubType: "Dashboard " + dashboard.Title + " deleted successfully."}, kp.DashboardDeleteAudit)
		}
	} else {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard delete failed.", OperationSubType: " Dashboard " + dashboard.Title + " delete failed with error: " + err.Error()}, kp.DashboardDeleteAudit)
		}
	}
}

func DashboardSoftDeleteAudit(c *contextmodel.ReqContext, err error, dash ...*dashboards.Dashboard) {
	if err == nil {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard moved to trash.", OperationSubType: "Dashboard " + dashboard.Title + " moved to trash."}, kp.DashboardSoftDeleteAudit)
		}
	} else {
		for _, dashboard := range dash {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard delete failed.", OperationSubType: "Dashboard " + dashboard.Title + " delete failed with error: " + err.Error()}, kp.DashboardSoftDeleteAudit)
		}
	}
}

func RestoreDeletedDashboardAudit(c *contextmodel.ReqContext, dashboard *dashboards.Dashboard, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboard.Title, ObjectDetails: "Dashboard restored successfully.", OperationSubType: "Dashboard " + dashboard.Title + " restored successfully."}, kp.RestoreDeletedDashboardAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: dashboard.Title, ObjectDetails: "Dashboard restore failed.", OperationSubType: "Dashboard " + dashboard.Title + " restore failed with error: " + err.Error()}, kp.RestoreDeletedDashboardAudit)
	}
}

// =======================================================================================

// ============================= Report Schedule Audit ====================================

type RSAudit struct {
	Id         int64
	Name       string
	ReportType string
}

func RSCreateAudit(c *contextmodel.ReqContext, m *models.InsertRS, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: m.Data.Name, ObjectType: m.Data.ReportType, ObjectDetails: "Report schedule created successfully.", OperationSubType: "Report schedule " + m.Data.Name + " created successfully."}, kp.ReportSchedulerCreateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: m.Data.Name, ObjectType: m.Data.ReportType, ObjectDetails: "Report schedule create failed.", OperationSubType: "Report schedule " + m.Data.Name + " create failed with error: " + err.Error()}, kp.ReportSchedulerCreateAudit)
	}
}

func RSUpdateAudit(c *contextmodel.ReqContext, m *models.UpdateRS, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: m.Data.Name, ObjectType: m.Data.ReportType, ObjectDetails: "Report schedule updated successfully.", OperationSubType: "Report schedule " + m.Data.Name + " updated successfully."}, kp.ReportSchedulerUpdateAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: m.Data.Name, ObjectType: m.Data.ReportType, ObjectDetails: "Report schedule update failed.", OperationSubType: "Report scheduler " + m.Data.Name + " update failed with error: " + err.Error()}, kp.ReportSchedulerUpdateAudit)
	}
}

func RSDeleteAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report schedule deleted successfully.", OperationSubType: "Report scheduler " + rs.Name + " deleted successfully."}, kp.ReportSchedulerDeleteAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report schedule delete failed.", OperationSubType: "Report scheduler " + rs.Name + " delete failed with error: " + err.Error()}, kp.ReportSchedulerDeleteAudit)
		}
	}

}

func RSEnableAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report shedule enabled.", OperationSubType: "Report schedule " + rs.Name + " enabled."}, kp.ReportSchedulerEnableAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report schedule enable failed.", Err: err, OperationSubType: "Report schedule " + rs.Name + " enable failed with error: " + err.Error()}, kp.ReportSchedulerEnableAudit)
		}
	}
}

func RSDisableAudit(c *contextmodel.ReqContext, m []RSAudit, err error) {
	if err == nil {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report schedule disabled.", OperationSubType: "Report schedule " + rs.Name + " disabled."}, kp.ReportSchedulerDisableAudit)
		}
	} else {
		for _, rs := range m {
			sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rs.Name, ObjectType: rs.ReportType, ObjectDetails: "Report schedule disable failed.", OperationSubType: "Report schedule " + rs.Name + " disable dailed with error: " + err.Error()}, kp.ReportSchedulerDisableAudit)
		}
	}
}

func RSRunNowAudit(c *contextmodel.ReqContext, rsName string, reportType string, err error) {
	if err == nil {
		sendAudit(kp.EventOpt{Ctx: c, ObjectName: rsName, ObjectType: reportType, ObjectDetails: "Report schedule run once successful.", OperationSubType: "Report schedule " + rsName + " run now successful."}, kp.ReportSchedulerRunNowAudit)
	} else {
		sendAudit(kp.EventOpt{Ctx: c, Err: err, ObjectName: rsName, ObjectType: reportType, ObjectDetails: "Report schedule run once failed.", OperationSubType: "Report schedule " + rsName + " run now failed with error: " + err.Error()}, kp.ReportSchedulerRunNowAudit)
	}
}

// ========================================================================================

// ============================= DAshboard and Folder permissions update Audit ====================================

func DashboardUserPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, userName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for user " + userName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for user " + userName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for user " + userName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for user " + userName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func DashboardTeamPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, teamName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for team " + teamName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for team " + teamName + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for team " + teamName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for team " + teamName + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func DashboardRolePermissionUpdateAudit(c *contextmodel.ReqContext, permission string, dashboardName string, role string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed.", OperationSubType: "Permission removed for role " + role + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission updated.", OperationSubType: permission + " permission updated for role " + role + " for dashboard " + dashboardName + "."}, kp.DashboardPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission removed failed.", OperationSubType: "Permission remove failed for role " + role + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: dashboardName, ObjectDetails: "Dashboard permission update failed.", OperationSubType: permission + " permission update failed for role " + role + " for dashboard " + dashboardName + " with error: " + err.Error()}, kp.DashboardPermissionUpdateAudit)
		}
	}
}

func FolderUserPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, userName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for user " + userName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for user " + userName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for user " + userName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for user " + userName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func FolderTeamPermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, teamName string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for team " + teamName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for team " + teamName + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for team " + teamName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for team " + teamName + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func FolderRolePermissionUpdateAudit(c *contextmodel.ReqContext, permission string, folderName string, role string, err error) {
	if err == nil {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed.", OperationSubType: "Permission removed for role " + role + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission updated.", OperationSubType: permission + " permission updated for role " + role + " for folder " + folderName + "."}, kp.FolderPermissionUpdateAudit)
		}

	} else {
		if permission == "" {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission removed failed.", OperationSubType: "Permission remove failed for role " + role + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		} else {
			sendAudit(kp.EventOpt{Ctx: c, ObjectName: folderName, ObjectDetails: "Folder permission update failed.", OperationSubType: permission + " permission update failed for role " + role + " for folder " + folderName + " with error: " + err.Error()}, kp.FolderPermissionUpdateAudit)
		}
	}
}

func getResourceNameByUID(a db.DB, ctx context.Context, resourceID string, resource any, resourceObj any, col string) (string, error) {
	resourceGetErr := a.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Table(resource).Where("uid = ?", resourceID).Cols(col).Get(&resourceObj)
		if err != nil {
			return err
		} else if !exists {
			return errors.New("resource not found")
		}
		return nil
	})
	resourceName := resourceObj.(string)
	return resourceName, resourceGetErr
}

func SetUserPermissionAudit(c *contextmodel.ReqContext, a db.DB, userService user.Service, permission string, resourceType string, resourceID string, userID int64, setUserPermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}
	user, err := userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		Log.Error("Error while getting user details for audit")
	}

	if resourceType == "dashboards" {
		DashboardUserPermissionUpdateAudit(c, permission, resourceName, user.Name, setUserPermissionErr)
	} else if resourceType == "folders" {
		FolderUserPermissionUpdateAudit(c, permission, resourceName, user.Name, setUserPermissionErr)
	}
}

func SetTeamPermissionAudit(c *contextmodel.ReqContext, a db.DB, teamService team.Service, permission string, resourceType string, resourceID string, teamID int64, setTeamPermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}
	team, err := teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{OrgID: c.OrgID, ID: teamID})
	if err != nil {
		Log.Error("Error while getting team details for audit")
	}

	if resourceType == "dashboards" {
		DashboardTeamPermissionUpdateAudit(c, permission, resourceName, team.Name, setTeamPermissionErr)
	} else if resourceType == "folders" {
		FolderTeamPermissionUpdateAudit(c, permission, resourceName, team.Name, setTeamPermissionErr)
	}
}

func SetRolePermissionAudit(c *contextmodel.ReqContext, a db.DB, role string, permission string, resourceType string, resourceID string, setRolePermissionErr error) {
	var resourceName string
	var resourceGetErr error
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if resourceType == "dashboards" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, &dashboards.Dashboard{}, dashboards.Dashboard{UID: resourceID, OrgID: c.OrgID}, "title")
	} else if resourceType == "folders" {
		resourceName, resourceGetErr = getResourceNameByUID(a, ctx, resourceID, "folder", folder.Folder{UID: resourceID, OrgID: c.OrgID}, "title")
	}
	if resourceGetErr != nil {
		Log.Error("Error while getting resource details for audit")
	}

	if resourceType == "dashboards" {
		DashboardRolePermissionUpdateAudit(c, permission, resourceName, role, setRolePermissionErr)
	} else if resourceType == "folders" {
		FolderRolePermissionUpdateAudit(c, permission, resourceName, role, setRolePermissionErr)
	}
}

// =======================================Functions to send audit event=================================================

func sendAudit(e kp.EventOpt, kpObj kp.EventType) {
	kpObj.Send(e)
}
