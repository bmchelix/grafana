// BMC Helix code changes start - DRJ71-22056
// TODO: REMOVE BEFORE UPGRADE
// HDB production build: process-mode plugin client only (no plugincontainer / Moby).
// Shared handshake, descriptors, and factories are in client_shared.go.
//go:build hdb_no_plugincontainers

package grpcplugin

import (
	"os/exec"

	goplugin "github.com/hashicorp/go-plugin"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func newClientConfig(descriptor PluginDescriptor, env []string, logger log.Logger, tracer trace.Tracer) *goplugin.ClientConfig {
	executablePath := descriptor.executablePath
	skipHostEnvVars := descriptor.skipHostEnvVars
	versionedPlugins := descriptor.versionedPlugins

	if descriptor.containerMode.enabled {
		logger.Warn("Plugin container mode is disabled in this build; using process mode",
			"executablePath", executablePath)
	}

	logger.Debug("Using process mode", "executablePath", executablePath)

	// Grafana backend plugins run as child processes by design; executablePath and
	// executableArgs are set at plugin registration time (plugin.json / provisioning),
	// not from untrusted HTTP input. Same pattern as upstream client.go (gosec G201).
	// nolint:gosec
	// nosemgrep: go.lang.security.audit.dangerous-exec-command.dangerous-exec-command
	cmd := exec.Command(executablePath, descriptor.executableArgs...)
	cmd.Env = env

	return &goplugin.ClientConfig{
		Cmd:              cmd,
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		SkipHostEnv:      skipHostEnvVars,
		Logger:           logWrapper{Logger: logger},
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
		GRPCDialOptions: []grpc.DialOption{
			grpc.WithStatsHandler(otelgrpc.NewClientHandler(otelgrpc.WithTracerProvider(newClientTracerProvider(tracer)))),
		},
	}
}

// BMC Helix code changes end - DRJ71-22056
