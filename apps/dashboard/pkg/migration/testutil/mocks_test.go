package testutil

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigurableDataSourceProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("standard test config", func(t *testing.T) {
		provider := NewDataSourceProvider(StandardTestConfig)
		idx := provider.Index(ctx)
		require.NotNil(t, idx)
		require.NotNil(t, idx.DefaultDS)
		assert.Equal(t, "default-ds-uid", idx.DefaultDS.UID)
		assert.Equal(t, "prometheus", idx.DefaultDS.Type)
		assert.Equal(t, "v1", idx.DefaultDS.APIVersion)
		assert.Contains(t, idx.ByName, "Default Test Datasource Name")
	})

	t.Run("dev dashboard config", func(t *testing.T) {
		provider := NewDataSourceProvider(DevDashboardConfig)
		idx := provider.Index(ctx)
		require.NotNil(t, idx)
		require.NotNil(t, idx.DefaultDS)
		assert.Equal(t, "testdata-type-uid", idx.DefaultDS.UID)
		assert.Equal(t, "grafana-testdata-datasource", idx.DefaultDS.Type)

		testDataDS := idx.ByName["TestData"]
		require.NotNil(t, testDataDS)
		assert.Equal(t, "testdata", testDataDS.UID)
		assert.Equal(t, "", testDataDS.APIVersion)
	})

	t.Run("equivalent configurations", func(t *testing.T) {
		standardProvider1 := NewDataSourceProvider(StandardTestConfig)
		standardProvider2 := NewDataSourceProvider(StandardTestConfig)
		devProvider1 := NewDataSourceProvider(DevDashboardConfig)
		devProvider2 := NewDataSourceProvider(DevDashboardConfig)

		s1 := standardProvider1.Index(ctx)
		s2 := standardProvider2.Index(ctx)
		d1 := devProvider1.Index(ctx)
		d2 := devProvider2.Index(ctx)

		require.NotNil(t, s1.DefaultDS)
		require.NotNil(t, s2.DefaultDS)
		require.NotNil(t, d1.DefaultDS)
		require.NotNil(t, d2.DefaultDS)

		assert.Equal(t, s1.DefaultDS.UID, s2.DefaultDS.UID)
		assert.Equal(t, d1.DefaultDS.UID, d2.DefaultDS.UID)
		assert.Equal(t, "default-ds-uid", s1.DefaultDS.UID)
		assert.Equal(t, "testdata-type-uid", d1.DefaultDS.UID)
	})

	t.Run("unknown config defaults to standard", func(t *testing.T) {
		provider := NewDataSourceProvider("unknown-config")
		idx := provider.Index(ctx)
		require.NotNil(t, idx.DefaultDS)
		assert.Equal(t, "default-ds-uid", idx.DefaultDS.UID)
		assert.Equal(t, "prometheus", idx.DefaultDS.Type)
	})
}

func TestModernUsageExample(t *testing.T) {
	t.Run("modern test setup", func(t *testing.T) {
		provider := NewDataSourceProvider(StandardTestConfig)
		idx := provider.Index(context.Background())
		require.NotNil(t, idx.DefaultDS)
		assert.Equal(t, "prometheus", idx.DefaultDS.Type)
	})

	t.Run("dev dashboard test setup", func(t *testing.T) {
		provider := NewDataSourceProvider(DevDashboardConfig)
		idx := provider.Index(context.Background())
		require.NotNil(t, idx.DefaultDS)
		assert.Equal(t, "grafana-testdata-datasource", idx.DefaultDS.Type)
	})
}
