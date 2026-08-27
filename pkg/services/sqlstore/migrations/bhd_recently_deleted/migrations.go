/*
 * BMC / BHD: Recently deleted dashboards (SQL archive before hard remove from dashboard table).
 */

package bhd_recently_deleted

import (
	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddMigration(mg *mig.Migrator) {
	table := mig.Table{
		Name: "bhd_recently_deleted_dashboard",
		Columns: []*mig.Column{
			{Name: "id", Type: mig.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true, Nullable: false},
			{Name: "org_id", Type: mig.DB_BigInt, Nullable: false},
			{Name: "original_id", Type: mig.DB_BigInt, Nullable: false},
			{Name: "uid", Type: mig.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "slug", Type: mig.DB_NVarchar, Length: 189, Nullable: false},
			{Name: "title", Type: mig.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "folder_uid", Type: mig.DB_NVarchar, Length: 40, Nullable: true},
			{Name: "is_folder", Type: mig.DB_Bool, Nullable: false},
			{Name: "data", Type: mig.DB_MediumText, Nullable: false},
			{Name: "deleted_at", Type: mig.DB_DateTime, Nullable: false},
		},
		Indices: []*mig.Index{
			{Name: "idx_bhd_recently_deleted_org", Cols: []string{"org_id"}},
			{Name: "idx_bhd_recently_deleted_org_uid", Cols: []string{"org_id", "uid"}},
		},
	}
	mg.AddMigration("bhd: create bhd_recently_deleted_dashboard table v1", mig.NewAddTableMigration(table))
	mg.AddMigration("bhd: add index bhd_recently_deleted_dashboard org_id", mig.NewAddIndexMigration(table, table.Indices[0]))
	mg.AddMigration("bhd: add index bhd_recently_deleted_dashboard org_id_uid", mig.NewAddIndexMigration(table, table.Indices[1]))
}
