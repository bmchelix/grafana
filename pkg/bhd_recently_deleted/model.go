package bhd_recently_deleted

import (
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	RestoreBadRequestMsg                   = "bad request data while restoring deleted dashboard"
	RecentlyDeletedNotFoundMsg             = "Recently deleted dashboard not found"
	RecentlyDeletedUIDExistsMsg            = "A dashboard with this UID already exists"
	RecentlyDeletedNameExistsMsg           = "A dashboard with this name already exists"
	RecentlyDeletedArchiveInvalidMsg       = "Archived dashboard data is invalid"
	RecentlyDeletedRestoreFailedMsg       = "Failed to restore dashboard"
	RecentlyDeletedRestoreArchivePendingMsg = "Dashboard was restored but could not be removed from Recently Deleted"
)

var (
	ErrNotFound              = errors.New("bhd_recently_deleted: row not found")
	ErrUIDAlreadyExists      = errors.New("uid-already-exists")
	ErrNameAlreadyExists     = errors.New("name-already-exists")
	ErrArchiveInvalid        = errors.New("archive-invalid")
	ErrRestoreFailed            = errors.New("restore-failed")
	ErrRestoreArchiveRemoveFailed = errors.New("restore-archive-remove-failed")
)

// Row maps to bhd_recently_deleted_dashboard.
type Row struct {
	ID         int64     `json:"id" xorm:"pk autoincr 'id'"`
	OrgID      int64     `json:"orgId" xorm:"org_id"`
	OriginalID int64     `json:"originalId" xorm:"original_id"`
	UID        string    `json:"uid" xorm:"uid"`
	Slug       string    `json:"slug" xorm:"slug"`
	Title      string    `json:"title" xorm:"title"`
	FolderUID  string    `json:"folderUid" xorm:"folder_uid"`
	IsFolder   bool      `json:"isFolder" xorm:"is_folder"`
	Data       string    `json:"data" xorm:"data"`
	DeletedAt  time.Time `json:"deletedAt" xorm:"deleted_at"`
}

func (Row) TableName() string {
	return "bhd_recently_deleted_dashboard"
}

type RestoreCommand struct {
	ArchiveID int64
	OrgID     int64
	FolderUID string
	User      identity.Requester
}

type RestoreResponse struct {
	UID     string `json:"uid,omitempty"`
	Title   string `json:"title,omitempty"`
	Message string `json:"message,omitempty"`
	BHDCode string `json:"bhdCode,omitempty"`
}

func RestoreErrorHTTPStatus(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrUIDAlreadyExists):
		return http.StatusConflict
	case errors.Is(err, ErrNameAlreadyExists):
		return http.StatusConflict
	case errors.Is(err, ErrArchiveInvalid):
		return http.StatusBadRequest
	case errors.Is(err, ErrRestoreArchiveRemoveFailed):
		return http.StatusMultiStatus
	default:
		return http.StatusInternalServerError
	}
}
