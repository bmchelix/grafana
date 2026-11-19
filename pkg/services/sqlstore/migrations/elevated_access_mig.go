package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addElevatedAccessMigrations(mg *Migrator) {
	// One active elevation config per tenant. The row's existence means "enabled";
	// a missing row means "disabled". user_id/group_id are the current owner + elevated
	// group, and whitelisted_urls holds the devops-managed allowlist JSON for the tenant.
	elevatedAccessTableV1 := Table{
		Name: "elevated_access",
		Columns: []*Column{
			{Name: "tenant_id", Type: DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "group_id", Type: DB_BigInt, Nullable: false},
			{Name: "created_time", Type: DB_DateTime, Nullable: false},
			{Name: "updated_time", Type: DB_DateTime, Nullable: false},
			{Name: "whitelisted_urls", Type: DB_LongText, Nullable: true},
		},
		Indices: []*Index{},
	}
	mg.AddMigration("create elevated access table v1", NewAddTableMigration(elevatedAccessTableV1))
}
