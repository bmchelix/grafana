// BMC Helix code changes start - DRJ71-22056
// TODO: REMOVE BEFORE UPGRADE
// Shared grpcplugin client symbols for client.go and client_process_only.go after
// splitting container vs process-only builds (Moby CVE remediation).

package grpcplugin

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	goplugin "github.com/hashicorp/go-plugin"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/embedded"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Handshake is the HandshakeConfig used to configure clients and servers.
var handshake = goplugin.HandshakeConfig{
	// The ProtocolVersion is the version that must match between Grafana core
	// and Grafana plugins. This should be bumped whenever a (breaking) change
	// happens in one or the other that makes it so that they can't safely communicate.
	ProtocolVersion: grpcplugin.ProtocolVersion,

	// The magic cookie values should NEVER be changed.
	MagicCookieKey:   grpcplugin.MagicCookieKey,
	MagicCookieValue: grpcplugin.MagicCookieValue,
}

// pluginSet is list of plugins supported on v2.
var pluginSet = map[int]goplugin.PluginSet{
	grpcplugin.ProtocolVersion: {
		"diagnostics": &grpcplugin.DiagnosticsGRPCPlugin{},
		"resource":    &grpcplugin.ResourceGRPCPlugin{},
		"data":        &grpcplugin.DataGRPCPlugin{},
		"stream":      &grpcplugin.StreamGRPCPlugin{},
		"admission":   &grpcplugin.AdmissionGRPCPlugin{},
		"conversion":  &grpcplugin.ConversionGRPCPlugin{},
		"renderer":    &pluginextensionv2.RendererGRPCPlugin{},
	},
}

type clientTracerProvider struct {
	tracer trace.Tracer
	embedded.TracerProvider
}

func (ctp *clientTracerProvider) Tracer(_ string, _ ...trace.TracerOption) trace.Tracer {
	return ctp.tracer
}

func newClientTracerProvider(tracer trace.Tracer) trace.TracerProvider {
	return &clientTracerProvider{tracer: tracer}
}

// StartRendererFunc callback function called when a renderer plugin is started.
type StartRendererFunc func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	executableArgs   []string
	skipHostEnvVars  bool
	managed          bool
	containerMode    containerModeOpts
	versionedPlugins map[int]goplugin.PluginSet
	startRendererFn  StartRendererFunc
}

type containerModeOpts struct {
	enabled bool
	image   string
	tag     string
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func NewBackendPlugin(pluginID, executablePath string, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newBackendPlugin(pluginID, executablePath, true, skipHostEnvVars, executableArgs...)
}

// NewUnmanagedBackendPlugin creates a new backend plugin factory used for registering an unmanaged backend plugin.
func NewUnmanagedBackendPlugin(pluginID, executablePath string, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newBackendPlugin(pluginID, executablePath, false, skipHostEnvVars, executableArgs...)
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func newBackendPlugin(pluginID, executablePath string, managed bool, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:         pluginID,
		executablePath:   executablePath,
		executableArgs:   executableArgs,
		skipHostEnvVars:  skipHostEnvVars,
		managed:          managed,
		versionedPlugins: pluginSet,
	})
}

// NewRendererPlugin creates a new renderer plugin factory used for registering a backend renderer plugin.
func NewRendererPlugin(pluginID, executablePath string, startFn StartRendererFunc) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:         pluginID,
		executablePath:   executablePath,
		managed:          false,
		versionedPlugins: pluginSet,
		startRendererFn:  startFn,
	})
}

// BMC Helix code changes end - DRJ71-22056
