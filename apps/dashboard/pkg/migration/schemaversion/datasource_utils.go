package schemaversion

// Shared utility functions for datasource migrations across different schema versions.
// These functions handle the common logic for migrating datasource references from
// string names/UIDs to structured reference objects with uid, type, and apiVersion.

// DatasourceIndex provides O(1) lookup of datasources by name or UID.
type DatasourceIndex struct {
	ByName    map[string]*DataSourceInfo
	ByUID     map[string]*DataSourceInfo
	DefaultDS *DataSourceInfo
}

// NewDatasourceIndex creates an index from a list of datasources.
// Iterates once through the list to build name and UID maps for O(1) lookups.
func NewDatasourceIndex(datasources []DataSourceInfo) *DatasourceIndex {
	idx := &DatasourceIndex{
		ByName: make(map[string]*DataSourceInfo, len(datasources)),
		ByUID:  make(map[string]*DataSourceInfo, len(datasources)),
	}

	for i := range datasources {
		ds := &datasources[i]

		if ds.Name != "" {
			idx.ByName[ds.Name] = ds
		}
		if ds.UID != "" {
			idx.ByUID[ds.UID] = ds
		}
		if ds.Default {
			idx.DefaultDS = ds
		}
	}

	return idx
}

// Lookup finds a datasource by name or UID string.
func (idx *DatasourceIndex) Lookup(nameOrUID string) *DataSourceInfo {
	if idx == nil {
		return nil
	}
	if ds := idx.ByName[nameOrUID]; ds != nil {
		return ds
	}
	return idx.ByUID[nameOrUID]
}

// GetDefault returns the default datasource, if one exists.
func (idx *DatasourceIndex) GetDefault() *DataSourceInfo {
	if idx == nil {
		return nil
	}
	return idx.DefaultDS
}

// GetDataSourceRef creates a datasource reference object with uid, type and optional apiVersion
func GetDataSourceRef(ds *DataSourceInfo) map[string]interface{} {
	if ds == nil {
		return nil
	}
	ref := map[string]interface{}{
		"uid":  ds.UID,
		"type": ds.Type,
	}
	if ds.APIVersion != "" {
		ref["apiVersion"] = ds.APIVersion
	}
	return ref
}

// GetDefaultDSInstanceSettings returns the default datasource if one exists
func GetDefaultDSInstanceSettings(datasources []DataSourceInfo) *DataSourceInfo {
	for _, ds := range datasources {
		if ds.Default {
			return &DataSourceInfo{
				UID:        ds.UID,
				Type:       ds.Type,
				Name:       ds.Name,
				APIVersion: ds.APIVersion,
			}
		}
	}
	return nil
}

// isDataSourceRef checks if the object is a valid DataSourceRef (has uid or type)
// Matches the frontend isDataSourceRef function in datasource.ts
func isDataSourceRef(ref interface{}) bool {
	dsRef, ok := ref.(map[string]interface{})
	if !ok {
		return false
	}

	hasUID := false
	if uid, exists := dsRef["uid"]; exists {
		if uidStr, ok := uid.(string); ok && uidStr != "" {
			hasUID = true
		}
	}

	hasType := false
	if typ, exists := dsRef["type"]; exists {
		if typStr, ok := typ.(string); ok && typStr != "" {
			hasType = true
		}
	}

	return hasUID || hasType
}

// MigrateDatasourceNameToRef converts a datasource name/uid string to a reference object
// Matches the frontend migrateDatasourceNameToRef function in DashboardMigrator.ts
// Options:
//   - returnDefaultAsNull: if true, returns nil for "default" datasources (used in V33)
//   - returnDefaultAsNull: if false, returns reference for "default" datasources (used in V36)
func MigrateDatasourceNameToRef(nameOrRef interface{}, options map[string]bool, index *DatasourceIndex) map[string]interface{} {
	if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
		return nil
	}

	if isDataSourceRef(nameOrRef) {
		return nameOrRef.(map[string]interface{})
	}

	if nameOrRef == nil || nameOrRef == "default" {
		if index == nil {
			return nil
		}
		if ds := index.GetDefault(); ds != nil {
			return GetDataSourceRef(ds)
		}
	}

	if str, ok := nameOrRef.(string); ok {
		if str == "" {
			return map[string]interface{}{}
		}
		if index != nil {
			if ds := index.Lookup(str); ds != nil {
				return GetDataSourceRef(ds)
			}
		}
		return map[string]interface{}{
			"uid": str,
		}
	}

	return nil
}
