// BMC file
package setting

import "time"

type RemoteVariableCacheSettings struct {
	Enabled                      bool
	Host                         string
	Port                         int
	DB                           int
	Password                     string
	TTL                          time.Duration
	PoolSize                     int
	SSL                          bool
	MaxResponseSize              int
	ARRowLimitForCachedVariables int
	ConnStr                      string
}

func (cfg *Cfg) readRemoteVariableCacheSettings() {
	cacheServer := cfg.Raw.Section("remote_variable_cache")

	enabled := cacheServer.Key("enabled").MustBool(true)
	host := valueAsString(cacheServer, "host", "")
	port := cacheServer.Key("port").MustInt(6379)
	db := cacheServer.Key("db").MustInt(1)
	password := valueAsString(cacheServer, "password", "")
	ttl := cacheServer.Key("ttl").MustDuration(10 * 24 * time.Hour)
	poolSize := cacheServer.Key("pool_size").MustInt(10)
	ssl := cacheServer.Key("ssl").MustBool(false)
	maxResponseSizeInMB := cacheServer.Key("max_response_size").MustInt(1)
	arRowLimitForCachedVariables := cacheServer.Key("ar_row_limit_for_cached_variables").MustInt(10000)
	connStr := valueAsString(cacheServer, "bmc_varcache_connstr", "")

	cfg.RemoteVariableCacheSettings = &RemoteVariableCacheSettings{
		Enabled:                      enabled,
		Host:                         host,
		Port:                         port,
		DB:                           db,
		Password:                     password,
		TTL:                          ttl,
		PoolSize:                     poolSize,
		SSL:                          ssl,
		MaxResponseSize:              maxResponseSizeInMB * 1024 * 1024,
		ARRowLimitForCachedVariables: arRowLimitForCachedVariables,
		ConnStr:                      connStr,
	}
}
