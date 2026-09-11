package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitProducesCandidateOnlyPublicBundle(t *testing.T) {
	dir := t.TempDir()
	secret := "single-use-super-secret-enrollment-code"
	t.Setenv("STRATUM_ENROLLMENT_CODE", secret)
	genesis := strings.Repeat("a", 64)
	if err := initCommand([]string{
		"--dir", dir,
		"--validator-id", "validator-d",
		"--friendly-label", "Validator D",
		"--chain-id", "stratum-devnet-1",
		"--network-name", "STRATUM Devnet",
		"--genesis-hash", genesis,
	}); err != nil {
		t.Fatal(err)
	}
	var cfg BootstrapConfig
	if err := readJSON(filepath.Join(dir, "config.json"), &cfg); err != nil { t.Fatal(err) }
	if cfg.State != "CANDIDATE" || cfg.VoteAuthority { t.Fatalf("unsafe bootstrap state: %+v", cfg) }
	if !contains(cfg.ActivationBlockedReasons, "GOVERNANCE_ACTIVATION_REQUIRED") { t.Fatal("governance activation block missing") }
	if !contains(cfg.ActivationBlockedReasons, "VRF_CONFORMANCE_NOT_YET_IMPLEMENTED") { t.Fatal("VRF conformance block missing") }
	if cfg.Keys["CONSENSUS"].PublicKeyB64 == "" || cfg.Keys["VRF"].PublicKeyB64 == "" || cfg.Keys["TRANSPORT"].PublicKeyB64 == "" { t.Fatal("purpose-separated public keys missing") }
	publicBytes, err := os.ReadFile(filepath.Join(dir, "public-enrollment.json")); if err != nil { t.Fatal(err) }
	if strings.Contains(string(publicBytes), secret) { t.Fatal("raw enrollment secret leaked into public bundle") }
	for _, purpose := range []string{"consensus", "vrf", "transport"} {
		privateBytes, err := os.ReadFile(filepath.Join(dir, "keys", "private", purpose+".pk8")); if err != nil { t.Fatal(err) }
		if len(privateBytes) == 0 { t.Fatalf("%s private key missing", purpose) }
		if strings.Contains(string(publicBytes), base64.StdEncoding.EncodeToString(privateBytes)) { t.Fatalf("%s private key leaked into public bundle", purpose) }
	}
	if err := doctorCommand([]string{"--dir", dir}); err != nil { t.Fatal(err) }
}

func TestInitRefusesIdentityOverwrite(t *testing.T) {
	dir := t.TempDir(); t.Setenv("STRATUM_ENROLLMENT_CODE", "one-time-code")
	args := []string{"--dir",dir,"--validator-id","validator-d","--friendly-label","Validator D","--chain-id","stratum-devnet-1","--network-name","STRATUM Devnet","--genesis-hash",strings.Repeat("b",64)}
	if err := initCommand(args); err != nil { t.Fatal(err) }
	if err := initCommand(args); err == nil { t.Fatal("expected second init to refuse overwriting validator identity") }
}

func TestEnrollmentSecretIsHashed(t *testing.T) {
	dir := t.TempDir(); secret := "another-secret"; t.Setenv("STRATUM_ENROLLMENT_CODE", secret)
	if err := initCommand([]string{"--dir",dir,"--friendly-label","Validator Test","--chain-id","chain-test","--network-name","Test","--genesis-hash",strings.Repeat("c",64)}); err != nil { t.Fatal(err) }
	var cfg BootstrapConfig; if err := readJSON(filepath.Join(dir,"config.json"),&cfg); err != nil { t.Fatal(err) }
	d := sha256.Sum256([]byte(secret)); if cfg.EnrollmentCodeHash != hex.EncodeToString(d[:]) { t.Fatal("enrollment hash mismatch") }
}

func TestVerifyGenesisUsesPinnedIdentity(t *testing.T) {
	dir := t.TempDir(); t.Setenv("STRATUM_ENROLLMENT_CODE", "genesis-code"); hash := strings.Repeat("d",64)
	if err := initCommand([]string{"--dir",dir,"--friendly-label","Validator D","--chain-id","chain-d","--network-name","Network D","--genesis-hash",hash}); err != nil { t.Fatal(err) }
	genesisPath := filepath.Join(dir,"genesis.json")
	if err := writeJSON(genesisPath,map[string]any{"objectType":"GenesisDIR","chainId":"chain-d","GenesisDIRHash":hash},0o600); err != nil { t.Fatal(err) }
	if err := verifyGenesisCommand([]string{"--dir",dir,"--file",genesisPath}); err != nil { t.Fatal(err) }
	if err := writeJSON(genesisPath,map[string]any{"objectType":"GenesisDIR","chainId":"chain-d","GenesisDIRHash":strings.Repeat("e",64)},0o600); err != nil { t.Fatal(err) }
	if err := verifyGenesisCommand([]string{"--dir",dir,"--file",genesisPath}); err == nil { t.Fatal("expected mismatched Genesis hash rejection") }
}

func TestSignedPackageManifestVerification(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader); if err != nil { t.Fatal(err) }
	pubDER, err := x509.MarshalPKIXPublicKey(pub); if err != nil { t.Fatal(err) }
	binaryPath := filepath.Join(t.TempDir(),"validator.bin"); sbomPath := filepath.Join(filepath.Dir(binaryPath),"sbom.json")
	if err := os.WriteFile(binaryPath,[]byte("portable-validator-binary"),0o600); err != nil { t.Fatal(err) }
	if err := os.WriteFile(sbomPath,[]byte(`{"spdxVersion":"SPDX-2.3"}`),0o600); err != nil { t.Fatal(err) }
	binaryHash, _ := hashFile(binaryPath); sbomHash, _ := hashFile(sbomPath)
	m := PackageManifest{PackageID:"stratum-validator",ValidatorVersion:"0.1.0",ProtocolVersion:"POVI/1",Platform:"linux",Architecture:"arm64",BinaryHash:binaryHash,SBOMHash:sbomHash,PublisherKeyID:"publisher-test",MinimumResources:map[string]string{"memory":"512MiB"},SupportedFeatures:[]string{"CANDIDATE_BOOTSTRAP"},ReleaseChannel:"dev"}
	u := unsignedManifest{m.PackageID,m.ValidatorVersion,m.ProtocolVersion,m.Platform,m.Architecture,m.BinaryHash,m.SBOMHash,m.PublisherKeyID,m.MinimumResources,m.SupportedFeatures,m.ReleaseChannel}
	message, err := json.Marshal(u); if err != nil { t.Fatal(err) }
	m.PublisherSignature = base64.StdEncoding.EncodeToString(ed25519.Sign(priv,message))
	manifestPath := filepath.Join(filepath.Dir(binaryPath),"manifest.json"); if err := writeJSON(manifestPath,m,0o600); err != nil { t.Fatal(err) }
	pubPath := filepath.Join(filepath.Dir(binaryPath),"publisher.der"); if err := os.WriteFile(pubPath,pubDER,0o600); err != nil { t.Fatal(err) }
	if err := verifyPackageCommand([]string{"--manifest",manifestPath,"--publisher-public-key",pubPath,"--binary",binaryPath,"--sbom",sbomPath}); err != nil { t.Fatal(err) }
}
