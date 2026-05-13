// BMC file
package remotecache

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const redisClusterCacheType = "redis-cluster"

var redisClusterLogger = log.New("remotecache.rediscluster")

type redisClusterStorage struct {
	c *redis.ClusterClient
}

// parseRedisClusterConnStr parses k=v pairs in csv and builds a redis ClusterOptions object
// Note: Only one address is required as Redis Cluster automatically discovers other nodes
func parseRedisClusterConnStr(connStr string) (*redis.ClusterOptions, error) {
	keyValueCSV := strings.Split(connStr, ",")
	options := &redis.ClusterOptions{}
	var addr string
	setTLSIsTrue := false
	for _, rawKeyValue := range keyValueCSV {
		keyValueTuple := strings.SplitN(rawKeyValue, "=", 2)
		if len(keyValueTuple) != 2 {
			if strings.HasPrefix(rawKeyValue, "password") {
				// don't log the password
				rawKeyValue = "password" + setting.RedactedPassword
			}
			return nil, fmt.Errorf("incorrect redis cluster connection string format detected for '%v', format is key=value,key=value", rawKeyValue)
		}
		connKey := keyValueTuple[0]
		connVal := keyValueTuple[1]
		switch connKey {
		case "addr":
			addr = connVal
		case "password":
			options.Password = connVal
		case "pool_size":
			i, err := strconv.Atoi(connVal)
			if err != nil {
				return nil, fmt.Errorf("%v: %w", "value for pool_size in redis cluster connection string must be a number", err)
			}
			options.PoolSize = i
		case "db":
			// Redis Cluster only supports database 0, so we ignore this parameter
			// This allows the same connection string format to work for both regular Redis and Redis Cluster
			_ = connVal
		case "ssl":
			if connVal != "true" && connVal != "false" && connVal != "insecure" {
				return nil, fmt.Errorf("ssl must be set to 'true', 'false', or 'insecure' when present")
			}
			if connVal == "true" {
				setTLSIsTrue = true // Needs addr already parsed, so set later
			}
			if connVal == "insecure" {
				options.TLSConfig = &tls.Config{InsecureSkipVerify: true}
			}
		default:
			return nil, fmt.Errorf("unrecognized option '%v' in redis cluster connection string", connKey)
		}
	}
	if addr == "" {
		return nil, fmt.Errorf("addr must be provided in redis cluster connection string")
	}
	options.Addrs = []string{addr}
	if setTLSIsTrue {
		// Get hostname from the Addr and set it on the configuration for TLS
		sp := strings.Split(addr, ":")
		if len(sp) < 1 {
			return nil, fmt.Errorf("unable to get hostname from the addr field, expected host:port, got '%v'", addr)
		}
		options.TLSConfig = &tls.Config{ServerName: sp[0]}
	}
	return options, nil
}

func newRedisClusterStorage(opts *setting.RemoteCacheSettings) (*redisClusterStorage, error) {
	redisClusterLogger.Debug("Initializing Redis Cluster storage")

	opt, err := parseRedisClusterConnStr(opts.ConnStr)
	if err != nil {
		redisClusterLogger.Error("Failed to parse Redis Cluster connection string", "error", err)
		return nil, err
	}

	redisClusterLogger.Debug("Parsed Redis Cluster options", "addrs", opt.Addrs, "poolSize", opt.PoolSize, "hasPassword", opt.Password != "", "hasTLS", opt.TLSConfig != nil)

	client := redis.NewClusterClient(opt)
	storage := &redisClusterStorage{c: client}

	// Ping the Redis Cluster to verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	redisClusterLogger.Info("Pinging Redis Cluster to verify connection", "addr", opt.Addrs[0])
	result, err := client.Ping(ctx).Result()
	if err != nil {
		redisClusterLogger.Error("Failed to ping Redis Cluster", "error", err, "addr", opt.Addrs[0])
		return storage, nil
	}

	redisClusterLogger.Debug("Redis Cluster client initialized successfully", "addr", opt.Addrs[0], "pingResult", result)

	return storage, nil
}

// Set sets value to a given key
func (s *redisClusterStorage) Set(ctx context.Context, key string, data []byte, expires time.Duration) error {
	status := s.c.Set(ctx, key, data, expires)
	return status.Err()
}

// GetByteArray returns the value as byte array
func (s *redisClusterStorage) Get(ctx context.Context, key string) ([]byte, error) {
	item, err := s.c.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, ErrCacheItemNotFound
		}
		return nil, err
	}

	return item, nil
}

// Delete delete a key from session.
func (s *redisClusterStorage) Delete(ctx context.Context, key string) error {
	cmd := s.c.Del(ctx, key)
	return cmd.Err()
}
