// BMC Helix code changes start - DRJ71-22056
// TODO: REMOVE BEFORE UPGRADE
// Build tag gates upstream plugin-container path; HDB uses client_process_only.go instead.
// handshake, pluginSet, PluginDescriptor, and factories moved to client_shared.go.
//go:build !hdb_no_plugincontainers
// BMC Helix code changes end - DRJ71-22056

package grpcplugin

import (
	"os/exec"
	"runtime"

	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/hashicorp/go-plugin/runner"
	"github.com/hashicorp/go-secure-stdlib/plugincontainer"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/plugins/log"
)

func newClientConfig(descriptor PluginDescriptor, env []string, logger log.Logger, tracer trace.Tracer) *goplugin.ClientConfig {
	executablePath := descriptor.executablePath
	skipHostEnvVars := descriptor.skipHostEnvVars
	versionedPlugins := descriptor.versionedPlugins

	if runtime.GOOS == "linux" && descriptor.containerMode.enabled {
		return containerClientConfig(executablePath, descriptor.containerMode.image, descriptor.containerMode.tag, logger, versionedPlugins, skipHostEnvVars, tracer)
	}

	logger.Debug("Using process mode", "os", runtime.GOOS, "executablePath", executablePath)

	// We can ignore gosec G201 here, since the dynamic part of executablePath comes from the plugin definition
	// nolint:gosec
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
			// https://github.com/grafana/app-platform-wg/issues/140
			// external plugins are loaded before k8s API server
			// configures the tracing service thus failing to
			// record trace span in the middleware.
			// With code below we are passing the same tracer that k8s API server
			// uses so that middleware is configured with tracer.
			grpc.WithStatsHandler(otelgrpc.NewClientHandler(otelgrpc.WithTracerProvider(newClientTracerProvider(tracer)))),
		},
	}
}

func containerClientConfig(executablePath, containerImage, containerTag string, logger log.Logger, versionedPlugins map[int]goplugin.PluginSet, skipHostEnvVars bool, tracer trace.Tracer) *goplugin.ClientConfig {
	logger.Info("Using container mode", "executable", executablePath, "image", containerImage, "tag", containerTag)
	return &goplugin.ClientConfig{
		RunnerFunc: func(l hclog.Logger, cmd *exec.Cmd, tmpDir string) (runner.Runner, error) {
			logger.Info("Creating container runner", "executablePath", executablePath, "tmpDir", tmpDir)
			config := &plugincontainer.Config{
				Image: containerImage,
				Tag:   containerTag,
				Env:   cmd.Env,
			}

			return config.NewContainerRunner(l, cmd, tmpDir)
		},
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
