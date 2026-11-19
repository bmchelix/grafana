// BMC Helix code changes start - DRJ71-22513
// TODO: REMOVE BEFORE UPGRADE
// Build tag excludes this file from hdb_no_zanzana production builds (OpenFGA CVE remediation).
//go:build !hdb_no_zanzana
// BMC Helix code changes end - DRJ71-22513

package schema

import (
	_ "embed"

	"github.com/openfga/language/pkg/go/transformer"
)

var (
	//go:embed schema_core.fga
	coreDSL string
	//go:embed schema_folder.fga
	folderDSL string
	//go:embed schema_resource.fga
	resourceDSL string
	//go:embed schema_subresource.fga
	subresourceDSL string
)

var SchemaModules = []transformer.ModuleFile{
	{
		Name:     "schema_core.fga",
		Contents: coreDSL,
	},
	{
		Name:     "schema_folder.fga",
		Contents: folderDSL,
	},
	{
		Name:     "schema_resource.fga",
		Contents: resourceDSL,
	},
	{
		Name:     "schema_subresource.fga",
		Contents: subresourceDSL,
	},
}
