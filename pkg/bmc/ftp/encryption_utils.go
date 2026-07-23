package ftp

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/services/secrets"
)

const encryptedPrefix = "{enc}"

func IsFipsEnabled() bool {
	return os.Getenv("FIPS_ENABLED") == "true"
}

// No support for re-encrypting FTP passwords, if we want to support keys rotation then we need to support re-encrypting the passwords.
func EncryptPassword(ctx context.Context, base64Pwd string, secretSrv secrets.Service) (string, error) {
	if !IsFipsEnabled() {
		return base64Pwd, nil
	}

	// Encrypt the base64 password
	encryptedPwd, err := secretSrv.Encrypt(ctx, []byte(base64Pwd), secrets.WithoutScope())
	if err != nil {
		return "", errors.New("failed to encrypt password: " + err.Error())
	}

	// Append the encrypted prefix with encoded encrypted password concatenated.
	return encryptedPrefix + base64.StdEncoding.EncodeToString(encryptedPwd), nil
}

func DecryptPassword(ctx context.Context, storedPwd string, secretSrv secrets.Service) (string, error) {
	if strings.HasPrefix(storedPwd, encryptedPrefix) {
		raw := strings.TrimPrefix(storedPwd, encryptedPrefix)
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return "", errors.New("failed to decode encrypted password: " + err.Error())
		}
		decryptedPwd, err := secretSrv.Decrypt(ctx, decoded)
		if err != nil {
			return "", errors.New("failed to decrypt password: " + err.Error())
		}
		return string(decryptedPwd), nil
	}

	return storedPwd, nil
}
