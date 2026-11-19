// BMC file
package rbac

import (
	"context"
	"fmt"
	"slices"
	"strings"

	bhdperm "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac/bhd_permissions"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// expandBHDMergedPermissions returns permission rows derived from BMC BHD roles for the
// given user, matching loadBHDPermissions in acimpl for the requested action (and action
// sets). Unified storage authz Check uses only the permission store union unless these
// are merged explicitly.
func expandBHDMergedPermissions(ctx context.Context, ac accesscontrol.Store, orgID, userID int64, action string, actionSets []string) ([]accesscontrol.Permission, error) {
	if ac == nil {
		return nil, nil
	}

	bhdRoles, err := ac.GetBHDRoleIdByUserId(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}
	if len(bhdRoles) == 0 {
		return nil, nil
	}

	raw, err := ac.GetBHDPermissionsByRoles(ctx, bhdRoles)
	if err != nil {
		return nil, err
	}

	seenRel := make(map[string]struct{})
	var out []accesscontrol.Permission

	for _, bhdPermission := range raw {
		for _, rel := range bhdperm.GetRelatedPermissions(bhdPermission.Action) {
			if !actionMatchesBHDFilter(rel, action, actionSets) {
				continue
			}
			if _, ok := seenRel[rel]; ok {
				continue
			}
			seenRel[rel] = struct{}{}

			// Match acimpl loadBHDPermissions: create actions get folders:uid:general only (no
			// action:* wildcard) so authz folder checks are not widened to scopeMap["*"].
			if rel == "dashboards:create" || rel == "folders:create" {
				out = append(out, accesscontrol.Permission{
					Action: rel,
					Scope:  "folders:uid:general",
				})
				continue
			}

			// dashboards/folders resource actions (e.g. dashboards:delete, dashboards:write,
			// dashboards.permissions:write, folders:delete) are the only ones enforced through the
			// unified-storage authz Check by per-resource uid scope. In legacy acimpl these bundle
			// members were stored with a malformed "<action>:*" scope (kind=dashboards,
			// attribute=delete, identifier=*) that never matched a real "dashboards:uid:<id>" scope,
			// so they granted NO access on specific dashboards/folders. In this path getScopeMap
			// treats identifier=="*" as a global wildcard (scopeMap["*"]=true), which would let a
			// user holding only dashboards:create delete/overwrite ANY dashboard - the regression vs
			// legacy. Skip them so create stays scoped to the general folder and edit/delete on a
			// specific dashboard/folder must still come from a real per-resource (uid) grant.
			if strings.HasPrefix(rel, "dashboards") || strings.HasPrefix(rel, "folders") {
				continue
			}

			out = append(out, accesscontrol.Permission{
				Action: rel,
				Scope:  fmt.Sprintf("%s:*", rel),
			})
		}
	}

	return out, nil
}

func actionMatchesBHDFilter(rel, action string, actionSets []string) bool {
	if rel == action {
		return true
	}
	return slices.Contains(actionSets, rel)
}
