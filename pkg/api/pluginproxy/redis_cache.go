// BMC file
package pluginproxy

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/golang/snappy"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	redisClient         *redis.Client
	redisVarCacheLogger = glog.New("data-proxy-log.redisvarcache")
	// We need to check for remoteVariableCaheSettings.Enabled before doing any redis server call/operation such as get, ping, set, etc
	remoteVariableCacheSettings *setting.RemoteVariableCacheSettings
	configSetToDisabledError    = errors.New("not performing operation since config is set to disabled")
)

const (
	// varc_orgID:dashboardUID:variableName:userID
	dashboardQueryKeyFormat = "varc_%v:%s:"
	variableQueryKeyFormat  = dashboardQueryKeyFormat + "%s:"
	queryKeyFormat          = variableQueryKeyFormat + "%v" // "varc_%v:%s:%s:%v"
)

func InitRedisClient(remoteVariableCache *setting.RemoteVariableCacheSettings) {
	remoteVariableCacheSettings = remoteVariableCache
	if remoteVariableCache.Host == "" {
		redisVarCacheLogger.Error("missing addr in config")
		return
	}

	addr := fmt.Sprintf("%s:%d", remoteVariableCache.Host, remoteVariableCache.Port)

	redisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: remoteVariableCache.Password,
		DB:       remoteVariableCache.DB,
		// Max pool size
		PoolSize:     remoteVariableCache.PoolSize,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
		DialTimeout:  1 * time.Second,
	})

	if remoteVariableCacheSettings.Enabled {
		_, err := redisClient.Ping(context.Background()).Result()

		if err != nil {
			redisVarCacheLogger.Error("failed to ping Redis, disabling redis cache", "err", err, "redisAddr", redisClient.Options().Addr, "db", redisClient.Options().DB)
			remoteVariableCacheSettings.Enabled = false
		} else {
			redisVarCacheLogger.Info("redis client initialized successfully", "redisAddr", redisClient.Options().Addr, "db", redisClient.Options().DB)
		}
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "operation", "ping")
	}
}

// When changing pattern, also change in DeleteDashboardCache and DeleteVariableCache
func GenerateQueryKey(orgID int64, dashboardUID string, variableName string, userID int64) string {
	queryKey := fmt.Sprintf(queryKeyFormat, orgID, dashboardUID, variableName, userID)
	return queryKey
}

func GetFromCache(ctx context.Context, queryKey string) (string, bool) {
	if remoteVariableCacheSettings.Enabled {
		val, err := redisClient.Get(ctx, queryKey).Result()

		if err == redis.Nil {
			redisVarCacheLogger.Info("no cache found for query key", "operation", "get", "queryKey", queryKey)
			return "", false
		} else if err != nil {
			redisVarCacheLogger.Error("redis GET error", "queryKey", "operation", "get", queryKey, "error", err)
			return "", false
		}

		redisVarCacheLogger.Debug("redis cache hit", "key", queryKey)
		decompressedVal, decompressErr := snappyDecompress([]byte(val))
		if decompressErr != nil {
			logger.Error("gzip decompression error", "queryKey", queryKey, "operation", "get", "err", decompressErr)
			return "", false
		}
		return decompressedVal, true
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "queryKey", queryKey, "operation", "get")
		return "", false
	}
}

func SetToCache(ctx context.Context, queryKey string, value []byte, duration time.Duration) {
	if remoteVariableCacheSettings.Enabled {
		compressedValue, err := snappyCompress(value)
		if err != nil {
			redisVarCacheLogger.Error("failed to compress data", err, "operation", "set")
			return
		}
		redisVarCacheLogger.Debug("setting cached value", "operation", "set", "queryKey", queryKey, "size", len(compressedValue))

		compressedValueLen := len(compressedValue)
		if compressedValueLen <= remoteVariableCacheSettings.MaxResponseSize {
			err = redisClient.Set(ctx, queryKey, compressedValue, duration).Err()
			if err != nil {
				redisVarCacheLogger.Error("redis SET error", "operation", "set", "queryKey", queryKey, "err", err)
			} else {
				redisVarCacheLogger.Info("cached value successfully stored", "operation", "set", "queryKey", queryKey)
			}
		} else {
			redisVarCacheLogger.Error("compressed size of response is more than max allowed size", "compressedValueLen", compressedValueLen, "maxResponseSize", remoteVariableCacheSettings.MaxResponseSize)
		}
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "queryKey", queryKey, "operation", "set")
	}
}

func DeleteFromCache(ctx context.Context, queryKeys []string) bool {
	if remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Debug("deleting cache", "lengthOfQueryKeys", len(queryKeys), "operation", "delete")
		if len(queryKeys) > 0 {
			err := redisClient.Del(ctx, queryKeys...).Err()
			if err != nil {
				redisVarCacheLogger.Error("redis DEL error", "lengthOfQueryKeys", len(queryKeys), "operation", "delete", "err", err)
				return false
			}
			redisVarCacheLogger.Info("cache deleted successfully", "lengthOfQueryKeys", len(queryKeys))
			return true
		} else {
			redisVarCacheLogger.Warn("cannot pass empty queryKeys array", "operation", "delete", "lengthOfQueryKeys", len(queryKeys))
		}
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "lengthOfQueryKeys", len(queryKeys), "operation", "delete")
	}
	return false
}

func GetMatchingKeys(ctx context.Context, pattern string) (*redis.ScanIterator, error) {
	if remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Debug("scanning for pattern in redis cache", "pattern", pattern, "operation", "scan")

		// use a custom time out bigger than the usual readtimeout since scanning cannot finish so quickly for folders and dashboards
		timeoutCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()

		iter := redisClient.Scan(timeoutCtx, 0, pattern, 0).Iterator()
		if err := iter.Err(); err != nil {
			redisVarCacheLogger.Error("redis SCAN error", "pattern", pattern, "operation", "scan", "error", err)
			return nil, err
		}
		return iter, nil
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "scan", "operation", "scan")
		return nil, configSetToDisabledError
	}
}

// Delete all keys that match a given pattern. Always call this/parent function in a goroutine since it is iterating and blocking operation
// Call with empty/different context than request if calling in a go routine, since the request context is closed by the time this spins up a go routine and starts iterating
func DeleteMatchingKeys(ctx context.Context, pattern string) error {
	if remoteVariableCacheSettings.Enabled {
		iter, err := GetMatchingKeys(ctx, pattern)
		if err != nil {
			redisVarCacheLogger.Error("error in fetching keys", "pattern", pattern, "err", err)
			return err
		}

		var keys []string
		// Collect keys to delete in an array
		for iter.Next(ctx) {
			keys = append(keys, iter.Val())
		}

		DeleteFromCache(ctx, keys)
		redisVarCacheLogger.Info("variable cache cleared successfully", "pattern", pattern)
		return nil
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "deleteMatching")
		return configSetToDisabledError
	}
}

func isAllowedCharacter(stringToCheck string) bool {
	// Alphanumeric or '_'
	for _, r := range stringToCheck {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || (r == '_')) {
			return false
		}
	}
	return true
}

func isValidQuerySubStr(subStr string) bool {
	// do not allow empty string or stuff like *
	return (subStr != "" && isAllowedCharacter(subStr))
}

// Always call in a goroutine. we need to check feature flag status before calling this.
// External FF check + this call can be done in goroutine
// This has to be called with any dashboard delete flow
func DeleteDashboardCache(orgID int64, dashboardUID string) {
	// do not allow empty string or *
	if !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid dashboard uid provided for deletion of dashboard cache", "dashboardUID", dashboardUID, "orgID", orgID)
		return
	}
	pattern := fmt.Sprintf(dashboardQueryKeyFormat+"*", orgID, dashboardUID)
	redisVarCacheLogger.Info("deleting redis cache for all entries of dashboard", "orgID", orgID, "dashboardUID", dashboardUID)
	DeleteMatchingKeys(redisClient.Context(), pattern)
}

// Pass a list of dashboards to delete
// This has to be called with any folder delete flow
// Use go routine for calling this and for feature flag check
func DeleteFolderCache(orgID int64, dashboards []*dashboards.Dashboard) {
	redisVarCacheLogger.Info("deleting caching for list of dashboards", "orgID", orgID, "len", len(dashboards))
	for _, dashboard := range dashboards {
		DeleteDashboardCache(orgID, dashboard.UID)
	}
	redisVarCacheLogger.Info("deleted cache for given dashboards", "orgID", orgID, "len", len(dashboards))
}

// No need to check feature flag before this since it is called from API dedicated to deleting cache
func DeleteVariableCacheForUser(orgID int64, dashboardUID string, variableName string, userID int64) bool {
	if !isValidQuerySubStr(variableName) || !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid input provided for deletion", "variableName", variableName, "dashboardUID", dashboardUID, "orgID", orgID, "userID", userID)
		return false
	}

	pattern := GenerateQueryKey(orgID, dashboardUID, variableName, userID)

	redisVarCacheLogger.Info("deleting redis cache for user's entries of variable", "orgID", orgID, "dashboardUID", dashboardUID, "variableName", variableName, "userID", userID)
	return DeleteFromCache(redisClient.Context(), []string{pattern})
}

// No need to check feature flag before this since it is called from API dedicated to deleting cache
func DeleteVariableCache(orgID int64, dashboardUID string, variableName string) {
	if !isValidQuerySubStr(variableName) || !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid input provided for deletion", "variableName", variableName, "dashboardUID", dashboardUID, "orgID", orgID)
		return
	}

	pattern := fmt.Sprintf(variableQueryKeyFormat+"*", orgID, dashboardUID, variableName)
	redisVarCacheLogger.Info("deleting redis cache for all entries of variable", "orgID", orgID, "dashboardUID", dashboardUID, "variableName", variableName)
	DeleteMatchingKeys(redisClient.Context(), pattern)
}

func snappyCompress(data []byte) ([]byte, error) {
	compressed := snappy.Encode(nil, data)
	return compressed, nil
}

func snappyDecompress(data []byte) (string, error) {
	decompressed, err := snappy.Decode(nil, data)
	if err != nil {
		return "", err
	}
	return string(decompressed), nil
}
