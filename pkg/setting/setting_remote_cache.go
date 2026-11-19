package setting

type RemoteCacheSettings struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
	RedisClusterModeEnabled bool //BMC Code
}

func (cfg *Cfg) readRemoteCacheSettings() {
	cacheServer := cfg.Raw.Section("remote_cache")
	dbName := valueAsString(cacheServer, "type", "database")
	connStr := valueAsString(cacheServer, "connstr", "")
	prefix := valueAsString(cacheServer, "prefix", "")
	encryption := cacheServer.Key("encryption").MustBool(false)
	redisClusterModeEnabled := cacheServer.Key("redis_cluster_mode_enabled").MustBool(false) //BMC Code

	cfg.RemoteCacheOptions = &RemoteCacheSettings{
		Name:       dbName,
		ConnStr:    connStr,
		Prefix:     prefix,
		Encryption: encryption,
		RedisClusterModeEnabled: redisClusterModeEnabled, //BMC Code
	}
}
