package navtreeimpl

import (
	"github.com/grafana/grafana/pkg/login/social"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ssoutils"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org" // bmc import
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
)

// nolint: gocyclo
func (s *ServiceImpl) getAdminNode(c *contextmodel.ReqContext) (*navtree.NavLink, error) {
	var configNodes []*navtree.NavLink
	ctx := c.Req.Context()
	hasAccess := ac.HasAccess(s.accessControl, c)
	hasGlobalAccess := ac.HasGlobalAccess(s.accessControl, s.authnService, c)
	orgsAccessEvaluator := ac.EvalPermission(ac.ActionOrgsRead)
	authConfigUIAvailable := s.license.FeatureEnabled(social.SAMLProviderName) || s.cfg.LDAPAuthEnabled

	generalNodeLinks := []*navtree.NavLink{}
	if hasAccess(ac.OrgPreferencesAccessEvaluator) {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text:     "Default preferences",
			Id:       "org-settings",
			SubTitle: "Manage preferences across an organization",
			Icon:     "sliders-v-alt",
			Url:      s.cfg.AppSubURL + "/org",
		})
	}

	// BMC Change: RMS starts
	if c.OrgRole == org.RoleAdmin {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text:     "Reporting Metadata Studio",
			Id:       "rms-config",
			SubTitle: "Introduction and starting point to reporting metadata studio",
			Icon:     "cog",
			Url:      s.cfg.AppSubURL + "/org/rms-config",
		})
	}
	// BMC Change: RMS Ends

	if hasAccess(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsAll)) {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text: "Settings", SubTitle: "View the settings defined in your BMC Helix Dashboards config", Id: "server-settings", Url: s.cfg.AppSubURL + "/admin/settings", Icon: "sliders-v-alt",
		})
	}
	if hasGlobalAccess(orgsAccessEvaluator) {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text: "Organizations", SubTitle: "Isolated instances of BMC Helix Dashboards running on the same server", Id: "global-orgs", Url: s.cfg.AppSubURL + "/admin/orgs", Icon: "building",
		})
	}
	if hasAccess(cloudmigration.MigrationAssistantAccess) && s.features.IsEnabled(ctx, featuremgmt.FlagOnPremToCloudMigrations) {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text:     "Migrate to BMC Helix Dashboards Cloud",
			Id:       "migrate-to-cloud",
			SubTitle: "Copy resources from your self-managed installation to a cloud stack",
			Url:      s.cfg.AppSubURL + "/admin/migrate-to-cloud",
		})
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	// BMC code: change role check to Grafana Admin
	if c.IsGrafanaAdmin &&
		(s.cfg.StackID == "" || // show OnPrem even when provisioning is disabled
			s.features.IsEnabledGlobally(featuremgmt.FlagProvisioning)) {
		generalNodeLinks = append(generalNodeLinks, &navtree.NavLink{
			Text:     "Provisioning",
			Id:       "provisioning",
			SubTitle: "View and manage your provisioning connections",
			Url:      s.cfg.AppSubURL + "/admin/provisioning",
		})
	}

	generalNode := &navtree.NavLink{
		Text:     "General",
		SubTitle: "Manage default preferences and settings across BMC Helix Dashboards",
		Id:       navtree.NavIDCfgGeneral,
		Url:      s.cfg.AppSubURL + "/admin/general",
		Icon:     "shield",
		Children: generalNodeLinks,
	}

	if len(generalNode.Children) > 0 {
		configNodes = append(configNodes, generalNode)
	}

	pluginsNodeLinks := []*navtree.NavLink{}
	// FIXME: If plugin admin is disabled or externally managed, server admins still need to access the page, this is why
	// while we don't have a permissions for listing plugins the legacy check has to stay as a default
	// BMC code - added grafana admin check
	if pluginaccesscontrol.ReqCanAdminPlugins(s.cfg)(c) || hasAccess(pluginaccesscontrol.AdminAccessEvaluator) && ac.ReqGrafanaAdmin(c) {
		pluginsNodeLinks = append(pluginsNodeLinks, &navtree.NavLink{
			Text:     "Plugins",
			Id:       "plugins",
			SubTitle: "Extend the Grafana experience with plugins",
			Icon:     "plug",
			Url:      s.cfg.AppSubURL + "/plugins",
		})
	}
	if s.features.IsEnabled(ctx, featuremgmt.FlagCorrelations) && hasAccess(correlations.ConfigurationPageAccess) {
		pluginsNodeLinks = append(pluginsNodeLinks, &navtree.NavLink{
			Text:     "Correlations",
			Icon:     "gf-glue",
			SubTitle: "Add and configure correlations",
			Id:       "correlations",
			Url:      s.cfg.AppSubURL + "/datasources/correlations",
		})
	}

	if (s.cfg.Env == setting.Dev) || s.features.IsEnabled(ctx, featuremgmt.FlagEnableExtensionsAdminPage) && hasAccess(pluginaccesscontrol.AdminAccessEvaluator) {
		pluginsNodeLinks = append(pluginsNodeLinks, &navtree.NavLink{
			Text:     "Extensions",
			Icon:     "plug",
			SubTitle: "Extend the UI of plugins and BMC Helix Dashboards",
			Id:       "extensions",
			Url:      s.cfg.AppSubURL + "/admin/extensions",
		})
	}

	pluginsNode := &navtree.NavLink{
		Text:     "Plugins and data",
		SubTitle: "Install plugins and define the relationships between data",
		Id:       navtree.NavIDCfgPlugins,
		Url:      s.cfg.AppSubURL + "/admin/plugins",
		Icon:     "shield",
		// BMC Change: Next line to remove plugin nodes
		Children: []*navtree.NavLink{},
	}

	if len(pluginsNode.Children) > 0 {
		configNodes = append(configNodes, pluginsNode)
	}

	accessNodeLinks := []*navtree.NavLink{}

	// BMC Change: Next line inline
	// When user is admin or superuser -> true
	// When user have users:read or global:users:* permissions -> true
	if c.OrgRole == org.RoleAdmin || hasAccess(ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)) {
		accessNodeLinks = append(accessNodeLinks, &navtree.NavLink{
			Text: "Users", SubTitle: "Manage users in BMC Helix Dashboards", Id: "global-users", Url: s.cfg.AppSubURL + "/admin/users", Icon: "user",
		})
	}
	if hasAccess(ac.TeamsAccessEvaluator) {
		accessNodeLinks = append(accessNodeLinks, &navtree.NavLink{
			Text:     "Teams",
			Id:       "teams",
			SubTitle: "Groups of users that have common dashboard and permission needs",
			Icon:     "users-alt",
			Url:      s.cfg.AppSubURL + "/org/teams",
		})
	}
	// BMC code
	// RBAC starts
	if c.OrgRole == org.RoleAdmin {
		accessNodeLinks = append(accessNodeLinks, &navtree.NavLink{
			Text:     "Roles",
			Id:       "roles",
			SubTitle: "Manage roles across an organization",
			Icon:     "roles-alt",
			Url:      s.cfg.AppSubURL + "/org/roles",
		})
	}
	// RBAC Ends

	// if enableServiceAccount(s, c) {
	// 	accessNodeLinks = append(accessNodeLinks, &navtree.NavLink{
	// 		Text:     "Service accounts",
	// 		Id:       "serviceaccounts",
	// 		SubTitle: "Use service accounts to run automated workloads in BMC Helix Dashboards",
	// 		Icon:     "gf-service-account",
	// 		Url:      s.cfg.AppSubURL + "/org/serviceaccounts",
	// 	})
	// }

	// if s.license.FeatureEnabled("groupsync") &&
	// 	s.features.IsEnabled(ctx, featuremgmt.FlagGroupAttributeSync) &&
	// 	hasAccess(ac.EvalAny(
	// 		ac.EvalPermission("groupsync.mappings:read"),
	// 		ac.EvalPermission("groupsync.mappings:write"),
	// 	)) {
	// 	accessNodeLinks = append(accessNodeLinks, &navtree.NavLink{
	// 		Text:     "External group sync",
	// 		Id:       "groupsync",
	// 		SubTitle: "Manage mappings of Identity Provider groups to BMC Helix Dashboards Roles",
	// 		Icon:     "",
	// 		Url:      s.cfg.AppSubURL + "/admin/access/groupsync",
	// 	})
	// }
	// BMC code ends

	// BMC Change: To add users and access node only when have children
	if len(accessNodeLinks) > 0 {
		usersNode := &navtree.NavLink{
			Text:     "Users and access",
			SubTitle: "Configure access for individual users, teams, and service accounts",
			Id:       navtree.NavIDCfgAccess,
			Url:      "/admin/access",
			Icon:     "shield",
			Children: accessNodeLinks,
		}
		// Always append admin access as it's injected by grafana-auth-app.
		configNodes = append(configNodes, usersNode)
	}

	if authConfigUIAvailable && hasAccess(ssoutils.EvalAuthenticationSettings(s.cfg)) ||
		hasAccess(ssoutils.OauthSettingsEvaluator(s.cfg)) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:      "Authentication",
			Id:        "authentication",
			SubTitle:  "Manage your auth settings and configure single sign-on",
			Icon:      "signin",
			IsSection: true,
			Url:       s.cfg.AppSubURL + "/admin/authentication",
		})
	}

	if len(configNodes) == 0 {
		return nil, nil
	}

	configNode := &navtree.NavLink{
		Id:         navtree.NavIDCfg,
		Text:       "Administration",
		SubTitle:   "Organization: " + c.GetOrgName(),
		Icon:       "cog",
		SortWeight: navtree.WeightConfig,
		Children:   configNodes,
		Url:        s.cfg.AppSubURL + "/admin",
	}

	return configNode, nil
}

func enableServiceAccount(s *ServiceImpl, c *contextmodel.ReqContext) bool {
	hasAccess := ac.HasAccess(s.accessControl, c)
	return hasAccess(serviceaccounts.AccessEvaluator)
}
