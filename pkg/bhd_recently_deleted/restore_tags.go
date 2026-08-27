package bhd_recently_deleted

import (
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

const RestoredDashboardTag = "Restored"

// AppendRestoredTag adds the Restored tag to dashboard JSON if not already present.
func AppendRestoredTag(data *simplejson.Json) {
	if data == nil {
		return
	}
	tags := data.Get("tags").MustStringArray()
	for _, tag := range tags {
		if strings.EqualFold(strings.TrimSpace(tag), RestoredDashboardTag) {
			return
		}
	}
	tags = append(tags, RestoredDashboardTag)
	tagValues := make([]any, len(tags))
	for i, tag := range tags {
		tagValues[i] = tag
	}
	data.Set("tags", tagValues)
}
