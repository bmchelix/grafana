// BMC file
package rbac

import (
	"context"
	"fmt"
	"slices"

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
			} else {
				out = append(out, accesscontrol.Permission{
					Action: rel,
					Scope:  fmt.Sprintf("%s:*", rel),
				})
			}
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
