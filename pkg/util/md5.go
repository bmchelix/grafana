package util

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"io"
	"os"
	"strings"
)

// Md5Sum calculates a checksum of a stream.
// When FIPS mode is enabled, SHA-256 is used (FIPS-approved).
// When FIPS mode is disabled, MD5 is used (legacy behavior).
func Md5Sum(reader io.Reader) (string, error) {
	var h hash.Hash
	if os.Getenv("FIPS_ENABLED") == "true" {
		h = sha256.New()
	} else {
		h = md5.New()
	}

	if _, err := io.Copy(h, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// Md5SumString calculates a checksum of a string.
// When FIPS mode is enabled, SHA-256 is used (FIPS-approved).
// When FIPS mode is disabled, MD5 is used (legacy behavior).
func Md5SumString(input string) (string, error) {
	buffer := strings.NewReader(input)
	return Md5Sum(buffer)
}
