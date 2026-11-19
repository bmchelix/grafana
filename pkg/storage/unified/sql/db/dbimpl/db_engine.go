package dbimpl

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func getEngine(config *sqlstore.DatabaseConfig) (*xorm.Engine, error) {
	// BMC code - start - DRJ71-22817
	dbType := sqlstore.ResolvePostgresDriverType(config.Type)
	// BMC code - end
	switch dbType {
	// BMC code - DRJ71-22817
	case dbTypeMySQL, dbTypePostgres, migrator.PostgresPgx, dbTypeSQLite:
		engine, err := xorm.NewEngine(dbType, config.ConnectionString)
		if err != nil {
			return nil, fmt.Errorf("open database: %w", err)
		}

		engine.SetMaxOpenConns(config.MaxOpenConn)
		engine.SetMaxIdleConns(config.MaxIdleConn)
		engine.SetConnMaxLifetime(time.Duration(config.ConnMaxLifetime) * time.Second)

		return engine, nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbType)
	}
}
