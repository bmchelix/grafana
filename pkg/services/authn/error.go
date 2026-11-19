package authn

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrTokenNeedsRotation  = errutil.Unauthorized("session.token.rotate", errutil.WithLogLevel(errutil.LevelDebug))
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
	// BMC Code : custom error messages : Starts
	ErrInvalidPermission = errutil.Unauthorized("missing-reporting-permission")
	ErrProxyAuthFailed   = errutil.Unauthorized(
		"auth-proxy.failed",
		errutil.WithPublicMessage("Oops... something went wrong. Please try again."),
	)
	ErrUserSyncInternal = errutil.Internal(
		"user.sync.internal",
		errutil.WithPublicMessage("Unable to access dashboard. Please contact your administrator."),
	)
	ErrUserSyncFetchNotFound = errutil.Unauthorized(
		"user.sync.fetch-not-found",
		errutil.WithPublicMessage("Unable to access dashboard. Please contact your administrator."),
	)
	ErrRequestForDedicatedTenant = errutil.Internal("dedicated-tenant-request")
	// BMC Code : custom error messages : Ends
)

// BMC Code : Starts
// ErrShowsAuthFailurePage reports whether auth failed with an error that should
// render the HTML error page instead of redirecting to login.
func ErrShowsAuthFailurePage(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrInvalidPermission) ||
		errors.Is(err, ErrProxyAuthFailed) ||
		errors.Is(err, ErrUserSyncInternal) ||
		errors.Is(err, ErrUserSyncFetchNotFound)
}

// AuthFailurePageTitle returns the HTML error page title for auth errors handled by ErrShowsAuthFailurePage.
func AuthFailurePageTitle(err error) (string, bool) {
	switch {
	case errors.Is(err, ErrInvalidPermission):
		return "Oops... sorry you dont have access to this Dashboard", true
	case errors.Is(err, ErrProxyAuthFailed):
		return "Oops... something went wrong. Please try again.", true
	case errors.Is(err, ErrUserSyncInternal):
		return "Unable to access dashboard. Please contact your administrator.", true
	case errors.Is(err, ErrUserSyncFetchNotFound):
		return "Unable to access dashboard. Please contact your administrator.", true
	default:
		return "", false
	}
}

// BMC Code : Ends
