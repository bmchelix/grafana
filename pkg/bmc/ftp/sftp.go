package ftp

import (
	"bufio"
	"errors"
	"fmt"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"os"
	"path/filepath"
	"strings"
)

type _SFTP struct {
	config    ConnConfig
	sshClient *ssh.Client
	client    *sftp.Client
}

func newSFTP(config ConnConfig) _Instance {
	return &_SFTP{config, nil, nil}

}

func (s *_SFTP) Ping() error {
	err := s.Connect()
	if err != nil {
		return err
	}
	defer s.Close()
	return nil
}

func (s *_SFTP) UploadFile(fileUpload FileUpload) error {
	if s.client == nil {
		// If client is nil try to connect
		if err := s.Connect(); err != nil {
			return err
		}
	}

	if err := s.client.MkdirAll(fileUpload.FTPFolder); err != nil {
		return err
	}

	// Create file in SFTP server
	path := filepath.Join(fileUpload.FTPFolder, fileUpload.FTPFileName)
	f, err := s.client.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// Open and read local file
	file, err := os.ReadFile(fileUpload.LocalFilepath)
	if err != nil {
		return errors.New(fmt.Sprintf("Failed to open file %s: %v", fileUpload.LocalFilepath, err))
	}

	// Write local file to SFTP server
	if _, err := f.Write(file); err != nil {
		return errors.New(fmt.Sprintf("Failed to upload file: %s", err.Error()))
	}
	f.Close()

	return nil
}

func (s *_SFTP) Connect() error {
	config, err := sshClientConfig(s.config)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	s.sshClient, err = ssh.Dial("tcp", url, config)
	if err != nil {
		return err
	}

	client, err := sftp.NewClient(s.sshClient)
	if err != nil {
		return err
	}
	s.client = client
	return nil
}

func (s *_SFTP) Close() error {
	if s.sshClient != nil {
		defer s.sshClient.Close()
	}
	if s.client != nil {
		defer s.client.Close()
	}
	return nil
}

func sshClientConfig(conn ConnConfig) (*ssh.ClientConfig, error) {
	fipsEnabled := os.Getenv("FIPS_ENABLED") == "true"

	hostKeyCallback := ssh.InsecureIgnoreHostKey()
	if !conn.IgnoreHostKey {
		hostKey, err := getHostKey(conn.Host)
		if err != nil {
			return nil, err
		}
		hostKeyCallback = ssh.FixedHostKey(*hostKey)
	}

	config := &ssh.ClientConfig{
		User: conn.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(conn.Password),
		},
		HostKeyCallback: hostKeyCallback,
		Timeout:         conn.Timeout,
	}

	// In FIPS mode, restrict SSH algorithms to FIPS-approved only.
	// golang.org/x/crypto/ssh is outside the Go FIPS boundary;
	// restricting algorithm lists ensures only approved primitives are negotiated.
	if fipsEnabled {
		config.Ciphers = []string{
			"aes128-ctr", "aes256-ctr",
			"aes128-gcm@openssh.com", "aes256-gcm@openssh.com",
		}
		config.KeyExchanges = []string{
			"ecdh-sha2-nistp256", "ecdh-sha2-nistp384", "ecdh-sha2-nistp521",
		}
		config.MACs = []string{
			"hmac-sha2-256", "hmac-sha2-512",
			"hmac-sha2-256-etm@openssh.com", "hmac-sha2-512-etm@openssh.com",
		}
	}

	return config, nil
}

func getHostKey(host string) (*ssh.PublicKey, error) {
	// parse OpenSSH known_hosts file
	// ssh or use ssh-keyscan to get initial key
	file, err := os.Open(filepath.Join(os.Getenv("HOME"), ".ssh", "known_hosts"))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var hostKey ssh.PublicKey
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), " ")
		if len(fields) != 3 {
			continue
		}
		if strings.Contains(fields[0], host) {
			var err error
			hostKey, _, _, _, err = ssh.ParseAuthorizedKey(scanner.Bytes())
			if err != nil {
				return nil, errors.New(fmt.Sprintf("Error parsing %q: %v", fields[2], err))
			}
			break
		}
	}

	if hostKey == nil {
		return nil, errors.New(fmt.Sprintf("No hostkey found for %s", host))
	}

	return &hostKey, nil
}
