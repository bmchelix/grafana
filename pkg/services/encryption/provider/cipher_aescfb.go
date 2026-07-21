package provider

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"io"
	"os"

	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/util"
)

func cFBEncrypter(payload []byte, secret string) ([]byte, error) {
	// BMC code changes start - FIPS
	// Disable AES CFB mode when FIPS is enabled, as it's not compliant with FIPS standards
	if os.Getenv("FIPS_ENABLED") == "true" {
		return nil, errors.New("AES CFB mode is not allowed in FIPS mode")
	}
	// BMC code changes - end
	salt, err := util.GetRandomString(encryption.SaltLength)
	if err != nil {
		return nil, err
	}

	key, err := encryption.KeyToBytes(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// The IV needs to be unique, but not secure. Therefore, it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, encryption.SaltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:encryption.SaltLength], salt)
	iv := ciphertext[encryption.SaltLength : encryption.SaltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	//nolint:staticcheck
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[encryption.SaltLength+aes.BlockSize:], payload)

	return ciphertext, nil
}
