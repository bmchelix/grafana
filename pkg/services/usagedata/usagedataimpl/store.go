package usagedataimpl

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/usagedata"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	GetDashboardsUsingDepPlugs(context.Context, int64) (usagedata.PluginInfoResponse, error)
	GetUserDataService(ctx context.Context, orgID int64, loginId string, status string) (usagedata.UserCountResponse, error)
	GetDashboardsRepoSchedule(context.Context, string, string, int64) (usagedata.ScheduleResponse, error)
	GetOrgLevelDashboardStatistics(context.Context, int64) (usagedata.OrgLevelDashboardStatisticsResponse, error)
	GetIndividualDashboardStatistics(context.Context, int64, int64) (usagedata.IndividualDashboardStatisticsResponse, error)
	GetDashboardHits(context.Context, string, string, int64, int64) (usagedata.DashboardHitsResponse, error)
	GetDashboardLoadTimes(context.Context, string, string, int64, int64) (usagedata.DashboardLoadTimesResponse, error)
	GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, user string, dashboard string) (usagedata.UsageDataResponse, error)
	GetDashboardDetails(ctx context.Context, orgID int64, folder string, title string, status string) (usagedata.DashboardDetailsResponse, error)
}

//Query object for executing usagedata query on grafana postgres database
type pgDbQuery struct{
	// contains raw sql string
	sql string
	// any parameters required in raw sql string
	parameters []any
	// description related to query for logging
	description string
	// organization Id
	orgId int64 
}

//Create default structure variable for postgres database sql query execution (constructor)
func getQueryObject() *pgDbQuery {
	query := new(pgDbQuery)
	query.sql = "SELECT 1"
	query.description = "SQL statement"
	return query
}

func (queryObj *pgDbQuery) executeQuery(ss *sqlStore, dbSess *db.Session, response any) (error) {
	err := dbSess.SQL(queryObj.sql, queryObj.parameters...).Find(response)
	if err != nil {
		ss.log.Error("Error while running SQL query to fetch " + queryObj.description, "tenant id", queryObj.orgId, "Parameters",queryObj.parameters)
	}
	// check if response array contains any data or not
	v := reflect.ValueOf(response)
    if v.Kind() == reflect.Ptr && v.Elem().Kind() == reflect.Slice {
        if v.Elem().Len() == 0 {
            ss.log.Warn("No Data fetched for " + queryObj.description, "tenant id", queryObj.orgId, "Parameters",queryObj.parameters)
        }
    }
	return err
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	log     log.Logger
	cfg     *setting.Cfg
}

func (ss *sqlStore) GetDashboardsUsingDepPlugs(ctx context.Context, orgID int64) (usagedata.PluginInfoResponse, error) {
	var result usagedata.PluginInfoResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info("Running SQL query to fetch all panels")

		// Raw SQL to run on the DB to fetch list of dashboards using deprecated plugins.
		rawSQL := `
		SELECT 
			title AS DashboardTitle,
			uid AS DashboardUID,			 
			(SELECT login FROM PUBLIC.user WHERE id=d.created_by) AS DashboardCreator,
			created as CreateDate,
			updated as UpdateDate,	
			CASE
				WHEN panel_element->>'type' IS NULL
				THEN (SELECT TYPE FROM library_element WHERE uid=(panel_element->'libraryPanel'->>'uid') limit 1)
				ELSE panel_element->>'type'
				END
				AS PluginType, 
			panel_element->>'title' AS PanelTitle,
			(SELECT COUNT(id) FROM report_data WHERE dashboard_id=d.id) AS NoOfReportSchedules
		FROM dashboard d,
		LATERAL jsonb_array_elements(data::jsonb->'panels') AS panel_element
		WHERE
			jsonb_typeof(data::jsonb->'panels') = 'array'	
			AND is_folder=false
			AND org_id=?
		LIMIT 25000;
		`

		err := dbSess.SQL(rawSQL, orgID).Find(&result.Data)

		if err != nil {
			ss.log.Error("Error while running SQL query to fetch all panels")
			return err
		}
		if result.Len() == 0 {
			ss.log.Error("No panels exist for the org")
			return usagedata.ErrNoDashboardsFound
		}
		return nil
	})
	if err != nil {
		return result, err
	}

	ss.log.Info("Ran SQL query to fetch all panels. Returning")

	return result, nil
}

// surghosh change
func (ss *sqlStore) GetUserDataService(ctx context.Context, orgID int64, loginId string, status string) (usagedata.UserCountResponse, error) {
	var result usagedata.UserCountResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		ss.log.Info("Running SQL query to fetch user counts")
		rawSQL := `SELECT
						COUNT(u.id) OVER () AS TotalUsers,
						COUNT(u.id) FILTER (WHERE u.last_seen_at >= NOW() - INTERVAL '30 days') OVER () AS ActiveUsers,
						EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') As reference_epoch,
						u.id,
						u.login,
						u.email,
						u.name,
						u.created,
						EXTRACT(EPOCH FROM u.last_seen_at) AS last_seen_at_epoch
					FROM
						public."user" u
					WHERE
						%s
						%s
						u.org_id = ?;
					`
		condition := ""
		activeCondition := ""
		// preparing login filter
		if loginId != "" {
			condition = fmt.Sprintf("u.login = '%s' AND", loginId)
		}
		// preparing active user filter
		if strings.EqualFold(status, "active") {
			activeCondition = "u.last_seen_at >= NOW() - INTERVAL '30 days' AND"
		}
		rawSQL = fmt.Sprintf(rawSQL, condition, activeCondition)
		err := dbSess.SQL(rawSQL, orgID).Find(&result.Data)
		if err != nil {
			ss.log.Error("Error while running SQL query to fetch user counts")
			return err
		}
		if result.Len() == 0 {
			ss.log.Error("No User Found")
			return usagedata.ErrNoUserCountsFound
		}

		return nil
	})
	if err != nil {
		return result, err
	}
	ss.log.Info("Ran all Queries, Returning")
	return result, nil
}

// purva change
func (ss *sqlStore) GetDashboardsRepoSchedule(ctx context.Context, fromTime string, toTime string, orgID int64) (usagedata.ScheduleResponse, error) {
	var result usagedata.ScheduleResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info(fmt.Sprintf("Running SQL query to fetch report scheduler info between %v - %v", fromTime, toTime))

		// Raw SQL to run on the DB to fetch list of dashboards using deprecated plugins.
		rawSQL := `
		SELECT 
			r.id AS ReportId,
			r.enabled AS IsActive,
			r.name AS ScheduleName,
			(SELECT login FROM public.user WHERE id=r.user_id limit 1) AS Creator,	
			(SELECT title from dashboard where id=dashboard_id limit 1) AS DashboardName,
			(SELECT uid from dashboard where id=dashboard_id limit 1) AS DashboardUid,
			created_at AS Created,
			updated_at AS LastUpdated,
			report_type AS ReportType,
			schedule_type AS ScheduleType,
			CASE WHEN js.Status = 1 THEN 'Success' ELSE 'Fail' END AS LastRunStatus,
			js.Description
		FROM report_data r 
		LEFT JOIN (
		SELECT DISTINCT ON(j.report_data_id)
			j.Id As ExecutionId,
			j.report_data_id AS ScheduleId,
			s.value AS Status,
			s.description AS Description
			FROM job_queue j LEFT JOIN job_status s ON j.id=s.job_queue_id 
		WHERE 
			j.started_at >=? and j.finished_at <= ?) js ON r.id=js.ScheduleId 
		WHERE 
			org_id=?
		LIMIT 1000;
		`

		err := dbSess.SQL(rawSQL, fromTime, toTime, orgID).Find(&result.Data)

		if err != nil {
			ss.log.Error(fmt.Sprintf("Error while running SQL query to fetch report scheduler info between %v - %v", fromTime, toTime))
			return err
		}
		if result.Len() == 0 {
			ss.log.Error(fmt.Sprintf("No scheduled reports found between %v - %v", fromTime, toTime))
			return usagedata.ErrNoScheduledReportsFound
		}
		return nil
	})
	if err != nil {
		return result, err
	}
	ss.log.Info("Ran SQL query to fetch scheduler info. Returning")
	return result, nil
}

func (ss *sqlStore) GetOrgLevelDashboardStatistics(ctx context.Context, orgID int64) (usagedata.OrgLevelDashboardStatisticsResponse, error) {
	var result usagedata.OrgLevelDashboardStatisticsResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info(fmt.Sprintf("Running SQL query to fetch org level dashboard statistics for OrgID %d", orgID))

		rawSQL := `
		SELECT
			t4.id as dashboard_id,
			t4.uid dashboard_uid,
			t4.title dashboard_title,
			COALESCE(t11.avg_load_time, 0) as avg_load_time,
			COALESCE(t5.data_aggregate, 0) as total_views,
			t9.collected_time as last_accessed_time
		FROM
			(
				SELECT
					t1.id as d_hit_metric,
					t2.id as d_loadtime_metric,
					COALESCE(t1.dashboard_id, t2.dashboard_id) as dashboard_id,
					COALESCE(t1.tenant_id, t2.tenant_id) as tenant_id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
					FULL OUTER JOIN metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t2 ON t1.dashboard_id = t2.dashboard_id
					AND t1.tenant_id = t2.tenant_id
			) as t3
			RIGHT JOIN dashboard t4
			ON t4.id = t3.dashboard_id
			AND t4.org_id = t3.tenant_id
			-- We have list of all available dashboards with their metric labels at this point. Right joining with dashboards table takes care of deleted dashboards.
			LEFT JOIN metric_schema.grafana_bmc_hdb_api_dashboard_hit_aggregate t5 ON t5.metric_id = t3.d_hit_metric
			-- Have dashboards with their total views now
			LEFT JOIN (
				SELECT DISTINCT
					ON (t6.metric_id) t6.metric_id,
					t6.collected_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t6
				ORDER BY
					t6.metric_id,
					t6.collected_time DESC
			) t9 ON t9.metric_id = t3.d_hit_metric
			-- Have dashboards with their last accessed time and their time filtered views at this point
			LEFT JOIN (
				SELECT
					t10.metric_id,
					AVG(t10.data_delta) as avg_load_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t10
				GROUP BY
					metric_id
			) t11 ON t11.metric_id = t3.d_loadtime_metric
			-- Have dashboards with their average load times at this point
			WHERE t4.org_id = ?
			AND t4.is_folder = false
		`

		err := dbSess.SQL(rawSQL, orgID).Find(&result.Data)

		if err != nil {
			ss.log.Error(fmt.Sprintf("Error while running SQL query to fetch org level dashboard statistics for OrgID %d", orgID))
			return err
		}
		if result.Len() == 0 {
			ss.log.Error(fmt.Sprintf("No dashboards found with usage data in OrgID %d", orgID))
			return usagedata.ErrNoDashboardsWithUsageDataFound
		}
		return nil
	})
	if err != nil {
		return result, err
	}
	ss.log.Info("Ran SQL query to fetch org level dashboard stats. Returning")
	return result, nil
}

func (ss *sqlStore) GetIndividualDashboardStatistics(ctx context.Context, dashboardID int64, orgID int64) (usagedata.IndividualDashboardStatisticsResponse, error) {
	var result usagedata.IndividualDashboardStatisticsResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info(fmt.Sprintf("Running SQL query to fetch stats for dashboard %d in OrgID %d", dashboardID, orgID))

		rawSQL := `
		SELECT
			t4.id as dashboard_id,
			t4.uid dashboard_uid,
			t4.title dashboard_title,
			COALESCE(t11.avg_load_time, 0) as avg_load_time,
			COALESCE(t5.data_aggregate, 0) as total_views,
			t9.collected_time as last_accessed_time
		FROM
			(
				SELECT
					t1.id as d_hit_metric,
					t2.id as d_loadtime_metric,
					COALESCE(t1.dashboard_id, t2.dashboard_id) as dashboard_id,
					COALESCE(t1.tenant_id, t2.tenant_id) as tenant_id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
					FULL OUTER JOIN metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t2 ON t1.dashboard_id = t2.dashboard_id
					AND t1.tenant_id = t2.tenant_id
			) as t3
			RIGHT JOIN dashboard t4
			ON t4.id = t3.dashboard_id
			AND t4.org_id = t3.tenant_id
			-- We have list of all available dashboards with their metric labels at this point. Inner joining with dashboards table takes care of deleted dashboards.
			LEFT JOIN metric_schema.grafana_bmc_hdb_api_dashboard_hit_aggregate t5 ON t5.metric_id = t3.d_hit_metric
			-- Have dashboards with their total views now
			LEFT JOIN (
				SELECT DISTINCT
					ON (t6.metric_id) t6.metric_id,
					t6.collected_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t6
				ORDER BY
					t6.metric_id,
					t6.collected_time DESC
			) t9 ON t9.metric_id = t3.d_hit_metric
			-- Have dashboards with their last accessed time and their time filtered views at this point
			LEFT JOIN (
				SELECT
					t10.metric_id,
					AVG(t10.data_delta) as avg_load_time
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t10
				GROUP BY
					metric_id
			) t11 ON t11.metric_id = t3.d_loadtime_metric
			-- Have dashboards with their average load times at this point
			WHERE t4.id = ?
			AND t4.org_id = ?
			LIMIT 1
		`

		err := dbSess.SQL(rawSQL, dashboardID, orgID).Find(&result.Data)

		if err != nil {
			ss.log.Error(fmt.Sprintf("Error while running SQL query to fetch stats for dashboard %d in OrgID - %d", dashboardID, orgID))
			return err
		}
		if result.Len() == 0 {
			errMsg := fmt.Sprintf("No stats for dashboard %d in OrgID %d", dashboardID, orgID)
			ss.log.Error(errMsg)
			return errors.New(errMsg)
		}
		return nil
	})
	if err != nil {
		return result, err
	}

	ss.log.Info(fmt.Sprintf("Ran query to fetch stats for dashboard %d in OrgID %d", dashboardID, orgID))
	return result, nil
}

func (ss *sqlStore) GetDashboardHits(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardHitsResponse, error) {
	var result usagedata.DashboardHitsResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info(fmt.Sprintf("Running SQL query to fetch hit count for dashboard %d in OrgID %d", dashboardID, orgID))

		rawSQL := `
		SELECT
			t2.data_delta as hits,
			t2.collected_time as collected_time
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t2
		WHERE
			t2.metric_id = (
				SELECT
					t1.id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels t1
				WHERE
					t1.dashboard_id = ?
					AND t1.tenant_id = ?
				LIMIT 1
			)
			AND t2.collected_time BETWEEN ? AND ?
			`

		err := dbSess.SQL(rawSQL, dashboardID, orgID, fromTime, toTime).Find(&result.Data)

		if err != nil {
			ss.log.Error(fmt.Sprintf("Error while running SQL query to fetch hit count for dashboard %d in OrgID %d", dashboardID, orgID))
			return err
		}
		return nil
	})
	if err != nil {
		return result, err
	}

	ss.log.Info(fmt.Sprintf("Ran query to fetch hit count for dashboard %d in OrgID %d", dashboardID, orgID))
	return result, nil
}

func (ss *sqlStore) GetDashboardLoadTimes(ctx context.Context, fromTime string, toTime string, dashboardID int64, orgID int64) (usagedata.DashboardLoadTimesResponse, error) {
	var result usagedata.DashboardLoadTimesResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info(fmt.Sprintf("Running SQL query to fetch load time for dashboard %d in OrgID %d", dashboardID, orgID))

		rawSQL := `
		SELECT
			t2.data_delta as load_time,
			t2.collected_time as collected_time
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_data t2
		WHERE
			t2.metric_id = (
				SELECT
					t1.id
				FROM
					metric_schema.grafana_bmc_hdb_api_dashboard_loadtime_labels t1
				WHERE
					t1.dashboard_id = ?
					AND t1.tenant_id = ?
				LIMIT 1
			)
			AND t2.collected_time BETWEEN ? AND ?
			`

		err := dbSess.SQL(rawSQL, dashboardID, orgID, fromTime, toTime).Find(&result.Data)

		if err != nil {
			ss.log.Error(fmt.Sprintf("Error while running SQL query to fetch load time for dashboard %d in OrgID %d", dashboardID, orgID))
			return err
		}
		return nil
	})
	if err != nil {
		return result, err
	}

	ss.log.Info(fmt.Sprintf("Ran query to fetch load time for dashboard %d in OrgID %d", dashboardID, orgID))
	return result, nil

}

func (ss *sqlStore) GetDashboardHitsUserInfo(ctx context.Context, fromTime string, toTime string, orgID int64, user string, dashboard string) (usagedata.UsageDataResponse, error) {
	
	var result usagedata.UsageDataResponse
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {

		ss.log.Info("Running SQL query to fetch Dashboard Hit User Info", "tenant id", orgID)
		
		rawSQL := `
		SELECT
			%s,
			a.data_delta,
			a.collected_time,
			%s
			%s
		FROM
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_with_user_info_data a
		JOIN 
			metric_schema.grafana_bmc_hdb_api_dashboard_hit_with_user_info_labels b on a.metric_id = b.id
		LEFT OUTER JOIN 
			public."user" u on b.user_id = u.id
		LEFT OUTER JOIN 
			public."dashboard" d on b.dashboard_id = d.id
		where
			b.tenant_id = ? AND
			%s
			a.collected_time BETWEEN ? AND ?;
		`
		userCondition := "u.id = %s AND"
		dashboardCondition := "d.id = %s AND"

		// by default set to userView hit info
		idQuery := "b.dashboard_id as id"
		nameQuery := "d.title as name"
		condition := ""

		// Extra column for long response type
		extraColumns := ", b.user_id as user_id, u.name as username"

		// user is given preference if both dashboard and user is given
		if user != "" {
			// it brings dashboard details (user specific)
			condition = fmt.Sprintf(userCondition, user)
			extraColumns = ""
		} else if dashboard != "" {
			// if user not given then add dashboard condition
			// it brings user details (dashboard specific)
			idQuery = "b.user_id as id"
			nameQuery = "u.name as name"
			condition = fmt.Sprintf(dashboardCondition, dashboard)
			extraColumns = ""
		}
		rawSQL = fmt.Sprintf(rawSQL, idQuery, nameQuery, extraColumns, condition)

		// Setting up query object
		sqlQueryParameters := [3]any{orgID, fromTime, toTime}
		queryObj :=  getQueryObject()
		queryObj.sql = rawSQL
		queryObj.parameters = sqlQueryParameters[:]
		queryObj.description = "Dashboard Hit With User Info"
		queryObj.orgId = orgID
		var errorQuery error
		if extraColumns == "" {
			var response usagedata.DashboardHitCountWithUserInfoShortResponse
			errorQuery = queryObj.executeQuery(ss, dbSess, &response.Data)
			result = response
			
		} else {
			var response usagedata.DashboardHitCountWithUserInfoLongResponse
			errorQuery = queryObj.executeQuery(ss, dbSess, &response.Data)
			result = response
		}
		return errorQuery
	})
	if err != nil {
		return result, err
	}

	ss.log.Info(fmt.Sprintf("Ran query to fetch Dashboard Hit User Info for OrgID %d", orgID))
	return result, nil

}

func (ss *sqlStore) GetDashboardDetails(ctx context.Context, orgID int64, folder string, title string, status string) (usagedata.DashboardDetailsResponse, error) {
	var response usagedata.DashboardDetailsResponse
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		ss.log.Info("Running SQL query to fetch all Dashboard Details")
		rawSQL := `SELECT a.id as d_id,
						a.title as d_title,
						case when b.title is null then 'Dashboards'
						else b.title end foldername
					FROM   public.dashboard a
					LEFT JOIN   public.dashboard b
					on a.folder_id = b.id
					%s
					WHERE  a.is_folder = 'false' AND
					%s
					%s
					%s
					a.org_id = ?`
		titleCondition := ""
		folderCondition := ""
		activeConditionQuery := ""
		activeCondition := ""
		// preparing folder condition
		if strings.EqualFold(folder, "Dashboards") {
			folderCondition = "b.title is null AND"
		} else if folder != "" {
			folderCondition = fmt.Sprintf("b.title = '%s' AND", folder)
		}
		// preparing title condition
		if title != "" {
			titleCondition = fmt.Sprintf("a.title = '%s' AND", title)
		} 

		if strings.EqualFold(status, "active") {
			activeConditionQuery = `LEFT JOIN 
					(SELECT
						id as metric_id,
						dashboard_id
					FROM
						metric_schema.grafana_bmc_hdb_api_dashboard_hit_labels) t1
					on t1.dashboard_id = a.id
					LEFT JOIN (
						SELECT DISTINCT
							ON (t2.metric_id) t2.metric_id,
							t2.collected_time
						FROM
							metric_schema.grafana_bmc_hdb_api_dashboard_hit_data t2
						ORDER BY
							t2.metric_id,
							t2.collected_time DESC
					) t3 ON t3.metric_id = t1.metric_id`
			activeCondition = "t3.collected_time >= NOW() - INTERVAL '30 days' AND"
		}
		rawSQL = fmt.Sprintf(rawSQL, activeConditionQuery, folderCondition, titleCondition, activeCondition)
		err := sess.SQL(rawSQL, orgID).Find(&response.Data)
		
		if err != nil {
			ss.log.Error("Error while running SQL query to fetch dashboard details")
			return err
		}
		if response.Len() == 0 {
			ss.log.Warn("No dashboards exist for the org")
			return errors.New("No dashboards exist for the org")
		}
		return nil
	})
	if err != nil {
		return response, err
	}
	ss.log.Info("Ran SQL query to fetch all Dashboard Details.")
	return response, nil
}
