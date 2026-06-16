package schemaversion

import (
	"context"
)

// V36 migrates dashboard datasource references from legacy string format to structured UID-based objects.
//
// This migration addresses a critical evolution in Grafana's datasource architecture where datasource
// identification shifted from potentially ambiguous display names to reliable UIDs. The original format
// used string references that could break when datasources were renamed, moved between organizations,
// or when multiple datasources shared similar names. This created reliability and portability issues
// for dashboard sharing and automation workflows.
//
// The migration works by:
// 1. Processing annotations, template variables, and panels (including nested panels in rows)
// 2. Converting string datasource references to structured objects containing uid, type, and apiVersion
// 3. Handling null/missing datasource references by setting appropriate defaults
// 4. Maintaining consistency between panel and target datasource configurations
// 5. Preserving special datasource types like Mixed datasources and expression queries
func V36(dsIndexProvider DataSourceIndexProvider) SchemaVersionMigrationFunc {
	return func(ctx context.Context, dashboard map[string]interface{}) error {
		dsIndex := dsIndexProvider.Index(ctx)
		dashboard["schemaVersion"] = int(36)

		migrateAnnotations(dashboard, dsIndex)
		migrateTemplateVariables(dashboard, dsIndex)
		migratePanels(dashboard, dsIndex)

		return nil
	}
}

// migrateAnnotations updates datasource references in dashboard annotations
func migrateAnnotations(dashboard map[string]interface{}, index *DatasourceIndex) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return
	}

	list, ok := annotations["list"].([]interface{})
	if !ok {
		return
	}

	for _, query := range list {
		queryMap, ok := query.(map[string]interface{})
		if !ok {
			continue
		}

		ds := queryMap["datasource"]
		queryMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, index)
	}
}

// migrateTemplateVariables updates datasource references in dashboard variables
func migrateTemplateVariables(dashboard map[string]interface{}, index *DatasourceIndex) {
	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return
	}

	list, ok := templating["list"].([]interface{})
	if !ok {
		return
	}

	defaultDS := index.GetDefault()
	for _, variable := range list {
		varMap, ok := variable.(map[string]interface{})
		if !ok {
			continue
		}

		varType := GetStringValue(varMap, "type")
		if varType != "query" {
			continue
		}

		ds, exists := varMap["datasource"]
		if exists && ds == nil {
			varMap["datasource"] = GetDataSourceRef(defaultDS)
		}
	}
}

// migratePanels updates datasource references in dashboard panels
func migratePanels(dashboard map[string]interface{}, index *DatasourceIndex) {
	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}
		migratePanelDatasources(panelMap, index)

		nestedPanels, hasNested := panelMap["panels"].([]interface{})
		if !hasNested {
			continue
		}

		for _, nestedPanel := range nestedPanels {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			migratePanelDatasourcesInternal(np, index, true)
		}
	}
}

// migratePanelDatasources updates datasource references in a single panel and its targets
func migratePanelDatasources(panelMap map[string]interface{}, index *DatasourceIndex) {
	migratePanelDatasourcesInternal(panelMap, index, false)
}

// migratePanelDatasourcesInternal updates datasource references with nesting awareness
func migratePanelDatasourcesInternal(panelMap map[string]interface{}, index *DatasourceIndex, isNested bool) {
	defaultDS := index.GetDefault()
	panelDataSourceWasDefault := false

	targets, hasTargets := panelMap["targets"].([]interface{})
	if !hasTargets || len(targets) == 0 {
		if !isNested {
			targets = []interface{}{
				map[string]interface{}{
					"refId": "A",
				},
			}
			panelMap["targets"] = targets
			hasTargets = true
		} else {
			return
		}
	}

	ds, exists := panelMap["datasource"]
	if !exists || ds == nil {
		if len(targets) > 0 {
			panelMap["datasource"] = GetDataSourceRef(defaultDS)
			panelDataSourceWasDefault = true
		}
	} else {
		if dsMap, ok := ds.(map[string]interface{}); ok && len(dsMap) == 0 {
			panelMap["datasource"] = ds
		} else {
			migrated := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, index)
			panelMap["datasource"] = migrated
		}
	}

	if !hasTargets {
		return
	}

	for _, target := range targets {
		targetMap, ok := target.(map[string]interface{})
		if !ok {
			continue
		}

		ds, exists := targetMap["datasource"]

		needsDefault := false
		if !exists || ds == nil {
			needsDefault = true
		} else if dsMap, ok := ds.(map[string]interface{}); ok {
			uid, hasUID := dsMap["uid"]
			if !hasUID || uid == nil {
				needsDefault = true
			}
		}

		if needsDefault {
			panelDS, ok := panelMap["datasource"].(map[string]interface{})
			if ok {
				uid := GetStringValue(panelDS, "uid")
				isMixed := uid == "-- Mixed --"

				if !isMixed {
					result := make(map[string]interface{})
					for k, v := range panelDS {
						result[k] = v
					}
					targetMap["datasource"] = result
				} else {
					targetMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, index)
				}
			}
		} else {
			targetMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, index)
		}

		if panelDataSourceWasDefault {
			targetDS, ok := targetMap["datasource"].(map[string]interface{})
			if ok {
				uid := GetStringValue(targetDS, "uid")
				if uid != "" && uid != "__expr__" {
					panelMap["datasource"] = targetDS
				}
			}
		}
	}
}
