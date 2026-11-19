package bhd_recently_deleted

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// ListItem is a slim view for GET /api/bhd-recently-deleted (does not return raw dashboard JSON).
type ListItem struct {
	ID         int64     `json:"id"`
	OrgID      int64     `json:"orgId"`
	OriginalID int64     `json:"originalId"`
	UID        string    `json:"uid"`
	Slug       string    `json:"slug"`
	Title      string    `json:"title"`
	FolderUID  string    `json:"folderUid"`
	IsFolder   bool      `json:"isFolder"`
	Tags       []string  `json:"tags"`
	DeletedAt  time.Time `json:"deletedAt"`
}

func tagsFromArchivedData(data string) []string {
	if data == "" {
		return nil
	}
	j, err := simplejson.NewJson([]byte(data))
	if err != nil {
		return nil
	}
	return j.Get("tags").MustStringArray()
}

func RowToListItem(r Row) ListItem {
	return ListItem{
		ID:         r.ID,
		OrgID:      r.OrgID,
		OriginalID: r.OriginalID,
		UID:        r.UID,
		Slug:       r.Slug,
		Title:      r.Title,
		FolderUID:  r.FolderUID,
		IsFolder:   r.IsFolder,
		Tags:       tagsFromArchivedData(r.Data),
		DeletedAt:  r.DeletedAt,
	}
}
