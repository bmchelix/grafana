// shared logic between httpserver and teamapi
package prefapi

import (
	"context"
	"fmt"
	"net/http"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

// BMC Change: Function definition inline
// Have context model instead of Req.Context in the argument to be able to push Audit Kafka Event
func UpdatePreferencesFor(c *contextmodel.ReqContext,
	dashboardService dashboards.DashboardService, preferenceService pref.Service, features featuremgmt.FeatureToggles,
	orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {

	//BMC Code - Start
	ctx := c.Req.Context()
	prePref := pref.Preference{}
	if userID == 0 && teamId == 0 {
		prePref = getPreferences(ctx, preferenceService, orgID, userID, teamId)
	}
	//End

	if dtoCmd.Theme != "" && !pref.IsValidThemeID(dtoCmd.Theme) {
		return response.Error(http.StatusBadRequest, "Invalid theme when updating preferences", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	// nolint:staticcheck
	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := dashboards.GetDashboardQuery{UID: *dtoCmd.HomeDashboardUID, OrgID: orgID}
		if query.UID == "" {
			// clear the value
			dashboardID = 0
		} else {
			queryResult, err := dashboardService.GetDashboard(ctx, &query)
			if err != nil {
				return response.Error(http.StatusNotFound, "Dashboard not found", err)
			}
			dashboardID = queryResult.ID
		}
	} else if dtoCmd.HomeDashboardID != 0 {
		// make sure uid is always set if id is set
		queryResult, err := dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: dtoCmd.HomeDashboardID, OrgID: orgID}) // nolint:staticcheck
		if err != nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
		dtoCmd.HomeDashboardUID = &queryResult.UID
	}
	// nolint:staticcheck
	dtoCmd.HomeDashboardID = dashboardID

	saveCmd := pref.SavePreferenceCommand{
		UserID:            userID,
		OrgID:             orgID,
		TeamID:            teamId,
		Theme:             dtoCmd.Theme,
		Language:          dtoCmd.Language,
		Timezone:          dtoCmd.Timezone,
		WeekStart:         dtoCmd.WeekStart,
		HomeDashboardID:   dtoCmd.HomeDashboardID,
		HomeDashboardUID:  dtoCmd.HomeDashboardUID,
		QueryHistory:      dtoCmd.QueryHistory,
		CookiePreferences: dtoCmd.Cookies,
		Navbar:            dtoCmd.Navbar,
		// BMC code - start
		TimeFormat:        dtoCmd.TimeFormat,
		EnabledQueryTypes: dtoCmd.EnabledQueryTypes,
		// BMC code - end
	}

	if features.IsEnabled(ctx, featuremgmt.FlagLocaleFormatPreference) {
		saveCmd.RegionalFormat = dtoCmd.RegionalFormat
	}

	if err := preferenceService.Save(ctx, &saveCmd); err != nil {
		//BMC Code - start
		if userID == 0 && teamId == 0 {
			kp.PreferencesEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to save organization preferences. Error : " + err.Error()})
		}
		//BMC Code - end
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	//BMC Code - start
	if userID == 0 && teamId == 0 {
		newPref := getPreferences(ctx, preferenceService, orgID, userID, teamId)
		kp.PreferencesEvent.Send(kp.EventOpt{Ctx: c, Prev: prePref, New: newPref, OperationSubType: "Organization preference updated successfully"})
	}
	//BMC Code - end

	return response.Success("Preferences updated")
}

func GetPreferencesFor(ctx context.Context,
	dashboardService dashboards.DashboardService, preferenceService pref.Service,
	features featuremgmt.FeatureToggles, orgID, userID, teamID int64) response.Response {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}

	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	dto := preferences.PreferencesSpec{}
	if preference.WeekStart != nil && *preference.WeekStart != "" {
		dto.WeekStart = preference.WeekStart
	}
	if preference.Theme != "" {
		dto.Theme = &preference.Theme
	}
	if preference.HomeDashboardUID != "" {
		dto.HomeDashboardUID = &preference.HomeDashboardUID
	}
	if preference.Timezone != "" {
		dto.Timezone = &preference.Timezone
	}

	if preference.JSONData != nil {
		if preference.JSONData.Language != "" {
			dto.Language = &preference.JSONData.Language
		}

		if features.IsEnabled(ctx, featuremgmt.FlagLocaleFormatPreference) {
			if preference.JSONData.RegionalFormat != "" {
				dto.RegionalFormat = &preference.JSONData.RegionalFormat
			}
		}

		if preference.JSONData.Navbar.BookmarkUrls != nil {
			dto.Navbar = &preferences.PreferencesNavbarPreference{
				BookmarkUrls: []string{},
			}
			dto.Navbar.BookmarkUrls = preference.JSONData.Navbar.BookmarkUrls
		}

		if preference.JSONData.QueryHistory.HomeTab != "" {
			dto.QueryHistory = &preferences.PreferencesQueryHistoryPreference{
				HomeTab: &preference.JSONData.QueryHistory.HomeTab,
			}
		}

		// BMC Code: Start
		if preference.JSONData.TimeFormat != "" {
			dto.TimeFormat = &preference.JSONData.TimeFormat
		}

		dto.EnabledQueryTypes = &preferences.EnabledQueryTypes{
			EnabledTypes:  []string{"FORM", "SQL", "VQB"},
			ApplyForAdmin: &preference.JSONData.EnabledQueryTypes.ApplyForAdmin,
		}

		if len(preference.JSONData.EnabledQueryTypes.EnabledTypes) > 0 {
			dto.EnabledQueryTypes.EnabledTypes = preference.JSONData.EnabledQueryTypes.EnabledTypes
		}
		// BMC Code: End
	}

	return response.JSON(http.StatusOK, &dto)
}

// BMC code - start
func getPreferences(ctx context.Context, preferenceService pref.Service,
	orgID, userID, teamID int64) pref.Preference {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}
	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		fmt.Println("Failed to get preference")
	}
	prePref := *preference
	return prePref
}

//BMC Code - end
