/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by amankar at 02/27/2026
 */

package ootb_dashboards_metadata

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

//go:embed ootb_checksums.json
var ootbChecksumsJSON string

type checksumEntry struct {
	ServiceName string `json:"folder_name"`
	FilePath    string `json:"file_path"`
	ContentHash string `json:"content_hash"`
}

func AddMigration(mg *mig.Migrator) {
	ootbDashboardsMetadataTable := mig.Table{
		Name: "ootb_dashboards_metadata",
		Columns: []*mig.Column{
			{Name: "id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false, IsAutoIncrement: true},
			{Name: "folder_name", Type: mig.DB_NVarchar, Length: 189, Nullable: false},
			{Name: "file_path", Type: mig.DB_NVarchar, Length: 512, Nullable: false},
			{Name: "content_hash", Type: mig.DB_Char, Length: 64, Nullable: false},
			{Name: "created_at", Type: mig.DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: mig.DB_DateTime, Nullable: false},
		},
		Indices: []*mig.Index{
			{
				Name: "ootb_dashboards_metadata_file_path_ukey",
				Type: mig.UniqueIndex,
				Cols: []string{"file_path"},
			},
		},
	}

	mg.AddMigration("bhd: create ootb_dashboards_metadata table v1", mig.NewAddTableMigration(ootbDashboardsMetadataTable))
	mg.AddMigration("bhd: create unique index ootb_dashboards_metadata_file_path_ukey", mig.NewAddIndexMigration(ootbDashboardsMetadataTable, ootbDashboardsMetadataTable.Indices[0]))

	mg.AddMigration("bhd: seed ootb_dashboards_metadata data v1", &seedOOTBMetadataMigration{})
}

type seedOOTBMetadataMigration struct {
	mig.MigrationBase
}

func (m *seedOOTBMetadataMigration) SQL(dialect mig.Dialect) string {
	return "code migration"
}

func (m *seedOOTBMetadataMigration) Exec(sess *xorm.Session, mg *mig.Migrator) error {
	var entries []checksumEntry
	if err := json.Unmarshal([]byte(ootbChecksumsJSON), &entries); err != nil {
		return fmt.Errorf("failed to parse ootb_checksums.json: %w", err)
	}

	now := time.Now()

	for _, e := range entries {
		_, err := sess.Exec(
			`INSERT INTO "ootb_dashboards_metadata" (folder_name, file_path, content_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
			e.ServiceName, e.FilePath, e.ContentHash, now, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert checksum for %s: %w", e.FilePath, err)
		}
	}

	mg.Logger.Info("Seeded OOTB dashboard checksums into ootb_dashboards_metadata table", "count", len(entries))
	return nil
}
