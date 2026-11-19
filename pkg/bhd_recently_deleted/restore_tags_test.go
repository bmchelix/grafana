package bhd_recently_deleted

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

func TestAppendRestoredTag(t *testing.T) {
	t.Run("adds Restored tag", func(t *testing.T) {
		data := simplejson.NewFromAny(map[string]any{
			"tags": []any{"prod"},
		})
		AppendRestoredTag(data)
		require.Equal(t, []string{"prod", RestoredDashboardTag}, data.Get("tags").MustStringArray())
	})

	t.Run("does not duplicate Restored tag", func(t *testing.T) {
		data := simplejson.NewFromAny(map[string]any{
			"tags": []any{"Restored", "prod"},
		})
		AppendRestoredTag(data)
		require.Equal(t, []string{"Restored", "prod"}, data.Get("tags").MustStringArray())
	})

	t.Run("creates tags array when missing", func(t *testing.T) {
		data := simplejson.NewFromAny(map[string]any{})
		AppendRestoredTag(data)
		require.Equal(t, []string{RestoredDashboardTag}, data.Get("tags").MustStringArray())
	})
}
