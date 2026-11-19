package bmc

import (
	"github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginsAPI struct {
	route    routing.RouteRegister
	service  ac.Service
	dashSvc  dashboards.DashboardService
	panelSvc libraryelements.Service
	store    sqlstore.SQLStore
	teamSvc  team.Service
	cfg      *setting.Cfg
}

// NewPluginsAPI returns a new instance of PluginsAPI.
// Added cfg *setting.Cfg field to PluginsAPI struct and constructor (needed for gravatar URL generation)
func NewPluginsAPI(r routing.RouteRegister, s sqlstore.SQLStore, service ac.Service, d dashboards.DashboardService, lp libraryelements.Service, teamSvc team.Service, cfg *setting.Cfg) *PluginsAPI {
	return &PluginsAPI{
		route:    r,
		store:    s,
		service:  service,
		dashSvc:  d,
		panelSvc: lp,
		teamSvc:  teamSvc,
		cfg:      cfg,
	}
}

func (p *PluginsAPI) RegisterImportExportBackendPlugin() {
	p.route.Group("/api/bmc", func(apiRoute routing.RouteRegister) {
		apiRoute.Post("/import-dashboards", p.ImportPlugin)
		apiRoute.Post("/export-dashboards", p.ExportPlugin)
	}, middleware.ReqSignedIn)
}

func (p *PluginsAPI) RegisterCustomPersonalizationBackendPlugin() {
	p.route.Group("/api/bmc", func(apiRoute routing.RouteRegister) {
		apiRoute.Get("/dashboard/:uid/personalization", p.GetCustomPersonalization)
		apiRoute.Post("/dashboard/:uid/personalization", p.SaveCustomPersonalization)
		apiRoute.Delete("/dashboard/:uid/personalization", p.DeleteDashPersonalization)
		apiRoute.Delete("/dashboard/:uid/variable/cache", p.DeleteVariableCache)
	}, middleware.ReqSignedIn)
}

func (p *PluginsAPI) RegisterMiscellaneousRoutes() {
	// register routes available to only grafana admin
	p.route.Group("/api/bmc", func(apiRoute routing.RouteRegister) {
		apiRoute.Post("/updatedb", p.RunUpsert)
	}, middleware.ReqGrafanaAdmin)
}

// RegisterHCGProxyRoutes registers the backend proxy route for HCG service.
func (p *PluginsAPI) RegisterHCGProxyRoutes() {
	p.route.Group("/api/bmc/hcg", func(apiRoute routing.RouteRegister) {
		apiRoute.Get("/services", routing.Wrap(p.GetHCGServices))
	}, middleware.ReqGrafanaAdmin)
}

// RegisterRoutes registers routes for the variable API.
func (p *PluginsAPI) ExternalDashboardsApi() {
	p.route.Group("/api/external", func(apiRoute routing.RouteRegister) {
		apiRoute.Post("/dashboards", p.getAllDashboards)
		apiRoute.Get("/dashboards/:uid", p.getVariablesMetadata)
	})
}

func (p *PluginsAPI) RegisterCustomRBACBackendPlugin() {
	p.route.Group("/api", func(apiRoute routing.RouteRegister) {
		apiRoute.Group("/rbac", func(rbacRoute routing.RouteRegister) {
			rbacRoute.Group("/auth", func(authRoute routing.RouteRegister) {
				authRoute.Post("/user", middleware.ReqGrafanaAdmin, routing.Wrap(p.IsAuthorizedUSer))
			})
			rbacRoute.Group("/roles", func(rolesRoute routing.RouteRegister) {
				rolesRoute.Post("/", middleware.ReqOrgAdmin, p.CreateBHDRole)
				rolesRoute.Get("/:roleId", middleware.ReqOrgAdmin, p.GetBHDRole)
				rolesRoute.Post("/:roleId", middleware.ReqOrgAdmin, p.UpdateBHDRole)
				rolesRoute.Delete("/:roleId", middleware.ReqOrgAdmin, p.DeleteBHDRole)
				rolesRoute.Get("/", middleware.ReqOrgAdmin, p.SearchBHDRoles)

				//Users
				rolesRoute.Post("/:roleId/users", middleware.ReqOrgAdmin, p.UpdateUsersRole)

				//Teams
				rolesRoute.Post("/:roleId/teams", middleware.ReqOrgAdmin, p.UpdateTeamsRole)

				//Permission
				rolesRoute.Get("/:roleId/permissions", middleware.ReqOrgAdmin, p.GetRolePermissions)
				rolesRoute.Post("/:roleId/permissions", middleware.ReqOrgAdmin, p.UpdateRolePermissions)
			})
			rbacRoute.Group("/users", func(usersRoute routing.RouteRegister) {
				usersRoute.Get("/", middleware.ReqOrgAdmin, p.SearchUser)
				usersRoute.Post("/:userId/role", middleware.ReqOrgAdmin, p.AddUserBHDRole)
				usersRoute.Delete("/:userId/role/:roleId", middleware.ReqOrgAdmin, p.RemoveUserBHDRole)
				usersRoute.Delete("/:userId/role", middleware.ReqOrgAdmin, p.RemoveUserBHDRole)

			})
			rbacRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
				teamsRoute.Get("/", middleware.ReqOrgAdmin, p.SearchTeam)
				teamsRoute.Post("/:teamId/role", middleware.ReqOrgAdmin, p.AddTeamBHDRole)
				teamsRoute.Delete("/:teamId/role/:roleId", middleware.ReqOrgAdmin, p.RemoveTeamBHDRole)
				teamsRoute.Delete("/:teamId/role", middleware.ReqOrgAdmin, p.RemoveTeamBHDRole)
			})
		})
	}, middleware.ReqSignedIn)
}

func (p *PluginsAPI) RegisterLocalizationAPI() {
	p.route.Group("/api/localization", func(apiRoute routing.RouteRegister) {
		// Global locale operations
		apiRoute.Group("/global", func(globalLocales routing.RouteRegister) {
			globalLocales.Get("/", p.GetGlobalLocalesJson)
			globalLocales.Post("/", p.UpdateGlobalLocalesJson)
		}, middleware.ReqEditorRole)

		// Read operations
		apiRoute.Get("/", p.RequireLocalizationFeature, p.CheckLanguage, p.GetLocalesJson)
		apiRoute.Get("/:uid", p.RequireLocalizationFeature, p.CheckLanguage, p.GetLocalesJsonByUID)

		// Update operations
		apiRoute.Post("/:uid", middleware.ReqEditorRole, p.RequireLocalizationFeature, p.CheckLanguage, p.UpdateLocalesJsonByLang)
	}, middleware.ReqSignedIn)
}

func (p *PluginsAPI) RegisterRequestElevationAPI() {
	// If changing these endpoints, also change in ds_request_elevation.go
	p.route.Group("/api/internal", func(apiRoute routing.RouteRegister) {
		apiRoute.Get("/elt-whitelisted-urls/:id", p.GetElevateRequestData)
		apiRoute.Post("/elt-whitelisted-urls/:id", p.InsertElevateRequestData)
		apiRoute.Delete("/elt-whitelisted-urls/:id", p.DeleteElevateRequestData)
	}, middleware.ReqGrafanaAdmin)
}

func (p *PluginsAPI) RegisterDSElevationConfigAPI() {
	// Any signed-in user may read the config; the handler tailors the response by role
	// (managers get the full config, members get logo status, others get nothing).
	p.route.Group("/api/bmc", func(apiRoute routing.RouteRegister) {
		apiRoute.Get("/ds-elevation-config", p.GetDSElevationConfig)
	}, middleware.ReqSignedIn)

	// Self-service route for DS elevation config.
	// Dashboard admins auto-pass via the org-role fallback; all other users must hold the "dashboard.elevated.access:access" BHD permission (granted through a role).
	canManageElevatedAccess := bhd_rbac.RbacMiddleware("dashboard.elevated.access", "access", []org.RoleType{org.RoleAdmin})
	p.route.Group("/api/bmc", func(apiRoute routing.RouteRegister) {
		apiRoute.Post("/ds-elevation-config", p.SaveDSElevationConfig)
		apiRoute.Delete("/ds-elevation-config", p.DeleteDSElevationConfig)
	}, middleware.ReqSignedIn, canManageElevatedAccess)
}
