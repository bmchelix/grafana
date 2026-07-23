package resource

import (
	"crypto/md5"
	"crypto/sha256"
	"hash"
	"os"
)

// NewBlobHasher returns a FIPS-approved hash function (SHA-256) when FIPS mode
// is enabled, and MD5 otherwise for backward compatibility with S3 Content-MD5.
func NewBlobHasher() hash.Hash {
	if os.Getenv("FIPS_ENABLED") == "true" {
		return sha256.New()
	}
	return md5.New()
}
