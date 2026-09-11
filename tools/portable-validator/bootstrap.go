package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const (
	bootstrapVersion = "STRATUM-PORTABLE-VALIDATOR/0.1"
	candidateState   = "CANDIDATE"
)

type KeyRef struct {
	Purpose       string `json:"purpose"`
	Algorithm     string `json:"algorithm"`
	PublicKeyB64  string `json:"publicKeyB64"`
	PublicKeyHash string `json:"publicKeyHash"`
	KeyVersion    int    `json:"keyVersion"`
}

type BootstrapConfig struct {
	BootstrapVersion         string            `json:"bootstrapVersion"`
	ValidatorID              string            `json:"validatorId"`
	FriendlyLabel            string            `json:"friendlyLabel"`
	ChainID                  string            `json:"chainId"`
	NetworkName              string            `json:"networkName"`
	GenesisDIRHash           string            `json:"GenesisDIRHash"`
	ProtocolVersion          string            `json:"protocolVersion"`
	State                    string            `json:"state"`
	VoteAuthority            bool              `json:"voteAuthority"`
	ActivationBlockedReasons []string          `json:"activationBlockedReasons"`
	EnrollmentCodeHash       string            `json:"enrollmentCodeHash"`
	CreatedAt                string            `json:"createdAt"`
	Platform                 string            `json:"platform"`
	Architecture             string            `json:"architecture"`
	BootstrapEndpoints       []string          `json:"bootstrapEndpoints"`
	Keys                     map[string]KeyRef `json:"keys"`
}

type PublicEnrollmentBundle struct {
	BootstrapVersion         string            `json:"bootstrapVersion"`
	ValidatorID              string            `json:"validatorId"`
	FriendlyLabel            string            `json:"friendlyLabel"`
	ChainID                  string            `json:"chainId"`
	NetworkName              string            `json:"networkName"`
	GenesisDIRHash           string            `json:"GenesisDIRHash"`
	ProtocolVersion          string            `json:"protocolVersion"`
	RequestedState           string            `json:"requestedState"`
	VoteAuthority            bool              `json:"voteAuthority"`
	ActivationBlockedReasons []string          `json:"activationBlockedReasons"`
	EnrollmentCodeHash       string            `json:"enrollmentCodeHash"`
	PublicKeys               map[string]KeyRef `json:"publicKeys"`
	PackageAttestation       map[string]string `json:"packageBuildAttestation"`
	CreatedAt                string            `json:"createdAt"`
}

type PackageManifest struct {
	PackageID          string            `json:"packageId"`
	ValidatorVersion   string            `json:"validatorVersion"`
	ProtocolVersion    string            `json:"protocolVersion"`
	Platform           string            `json:"platform"`
	Architecture       string            `json:"architecture"`
	BinaryHash         string            `json:"binaryHash"`
	SBOMHash           string            `json:"SBOMHash"`
	PublisherKeyID     string            `json:"publisherKeyId"`
	PublisherSignature string            `json:"publisherSignature"`
	MinimumResources   map[string]string `json:"minimumResources"`
	SupportedFeatures  []string          `json:"supportedFeatures"`
	ReleaseChannel     string            `json:"releaseChannel"`
}

type unsignedManifest struct {
	PackageID         string            `json:"packageId"`
	ValidatorVersion  string            `json:"validatorVersion"`
	ProtocolVersion   string            `json:"protocolVersion"`
	Platform          string            `json:"platform"`
	Architecture      string            `json:"architecture"`
	BinaryHash        string            `json:"binaryHash"`
	SBOMHash          string            `json:"SBOMHash"`
	PublisherKeyID    string            `json:"publisherKeyId"`
	MinimumResources  map[string]string `json:"minimumResources"`
	SupportedFeatures []string          `json:"supportedFeatures"`
	ReleaseChannel    string            `json:"releaseChannel"`
}

func defaultHome() string {
	h, err := os.UserHomeDir()
	if err != nil || h == "" { return ".stratum-validator" }
	return filepath.Join(h, ".stratum", "validator")
}

func initCommand(args []string) error {
	fs := flag.NewFlagSet("init", flag.ContinueOnError)
	dir := fs.String("dir", defaultHome(), "validator data directory")
	validatorID := fs.String("validator-id", "", "permanent validator ID; generated if omitted")
	friendlyLabel := fs.String("friendly-label", "", "non-reused friendly label")
	chainID := fs.String("chain-id", "", "STRATUM Chain ID")
	networkName := fs.String("network-name", "", "network name")
	genesisHash := fs.String("genesis-hash", "", "pinned Genesis DIR SHA-256")
	protocolVersion := fs.String("protocol-version", "POVI/1", "protocol version")
	enrollmentCodeFile := fs.String("enrollment-code-file", "", "0600 file containing the single-use enrollment code; alternatively set STRATUM_ENROLLMENT_CODE")
	bootstrapEndpoints := fs.String("bootstrap", "", "comma-separated bootstrap endpoints")
	packageID := fs.String("package-id", "portable-validator-dev", "package ID for public build attestation")
	validatorVersion := fs.String("validator-version", "0.1.0-dev", "validator version for public build attestation")
	if err := fs.Parse(args); err != nil { return err }
	if *chainID == "" || *networkName == "" || *friendlyLabel == "" { return errors.New("--chain-id, --network-name and --friendly-label are required") }
	if !isSHA256(*genesisHash) { return errors.New("--genesis-hash must be a 64-character SHA-256 hex digest") }
	enrollmentCode, err := loadEnrollmentCode(*enrollmentCodeFile)
	if err != nil { return err }
	if *validatorID == "" { id, err := randomUUID(); if err != nil { return err }; *validatorID = id }
	if err := ensureNewInstall(*dir); err != nil { return err }
	for _, sub := range []string{"keys/private", "state", "logs", "snapshots"} { if err := os.MkdirAll(filepath.Join(*dir, sub), 0o700); err != nil { return err } }
	keys := map[string]KeyRef{}
	for _, purpose := range []string{"CONSENSUS", "VRF", "TRANSPORT"} {
		ref, err := generateLocalKey(*dir, purpose); if err != nil { return fmt.Errorf("generate %s key: %w", purpose, err) }; keys[purpose] = ref
	}
	codeDigest := sha256.Sum256([]byte(enrollmentCode)); enrollmentCode = ""
	now := time.Now().UTC().Format(time.RFC3339Nano)
	blocked := []string{"GOVERNANCE_ACTIVATION_REQUIRED", "VRF_CONFORMANCE_NOT_YET_IMPLEMENTED", "LIVE_POVI_NETWORK_EXECUTION_NOT_YET_IMPLEMENTED"}
	cfg := BootstrapConfig{bootstrapVersion, *validatorID, *friendlyLabel, *chainID, *networkName, strings.ToLower(*genesisHash), *protocolVersion, candidateState, false, blocked, hex.EncodeToString(codeDigest[:]), now, runtime.GOOS, runtime.GOARCH, splitNonEmpty(*bootstrapEndpoints), keys}
	if err := writeJSON(filepath.Join(*dir, "config.json"), cfg, 0o600); err != nil { return err }
	bundle := PublicEnrollmentBundle{bootstrapVersion, *validatorID, *friendlyLabel, *chainID, *networkName, strings.ToLower(*genesisHash), *protocolVersion, candidateState, false, blocked, hex.EncodeToString(codeDigest[:]), keys, map[string]string{"packageId": *packageID, "validatorVersion": *validatorVersion, "platform": runtime.GOOS, "architecture": runtime.GOARCH}, now}
	if err := writeJSON(filepath.Join(*dir, "public-enrollment.json"), bundle, 0o600); err != nil { return err }
	if err := initializeConsensusSafety(*dir); err != nil { return fmt.Errorf("initialize signed consensus safety journal: %w", err) }
	fmt.Printf("Initialized STRATUM validator candidate %s (%s) in %s\n", *friendlyLabel, *validatorID, *dir)
	fmt.Println("Vote authority: false. Governance activation at a future height is required before voting.")
	fmt.Println("Signed PoVI consensus-safety journal initialized and bound to the pinned Genesis DIR.")
	fmt.Println("Share public-enrollment.json with the authorized enrollment service; never share files under keys/private.")
	return nil
}

func loadEnrollmentCode(path string) (string, error) {
	if env := strings.TrimSpace(os.Getenv("STRATUM_ENROLLMENT_CODE")); env != "" { return env, nil }
	if path == "" { return "", errors.New("supply enrollment secret via STRATUM_ENROLLMENT_CODE or --enrollment-code-file; command-line secret values are intentionally unsupported") }
	info, err := os.Stat(path); if err != nil { return "", err }
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 { return "", errors.New("enrollment-code file permissions must not grant group/other access") }
	b, err := os.ReadFile(path); if err != nil { return "", err }
	code := strings.TrimSpace(string(b)); if code == "" { return "", errors.New("enrollment code is empty") }
	return code, nil
}

func ensureNewInstall(dir string) error {
	if _, err := os.Stat(filepath.Join(dir, "config.json")); err == nil { return errors.New("validator config already exists; refusing to overwrite identity or keys") } else if !os.IsNotExist(err) { return err }
	return os.MkdirAll(filepath.Join(dir, "keys", "private"), 0o700)
}

func generateLocalKey(dir, purpose string) (KeyRef, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader); if err != nil { return KeyRef{}, err }
	privDER, err := x509.MarshalPKCS8PrivateKey(priv); if err != nil { return KeyRef{}, err }
	pubDER, err := x509.MarshalPKIXPublicKey(pub); if err != nil { return KeyRef{}, err }
	name := strings.ToLower(purpose); privPath := filepath.Join(dir, "keys", "private", name+".pk8")
	if err := os.WriteFile(privPath, privDER, 0o600); err != nil { return KeyRef{}, err }
	if err := os.Chmod(privPath, 0o600); err != nil { return KeyRef{}, err }
	pubHash := sha256.Sum256(pubDER)
	algorithm := "ED25519"
	if purpose == "VRF" { algorithm = "ED25519_CANDIDATE_KEY_MATERIAL" }
	if purpose == "TRANSPORT" { algorithm = "ED25519_TRANSPORT_IDENTITY" }
	return KeyRef{purpose, algorithm, base64.StdEncoding.EncodeToString(pubDER), hex.EncodeToString(pubHash[:]), 1}, nil
}

func doctorCommand(args []string) error {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError); dir := fs.String("dir", defaultHome(), "validator data directory"); if err := fs.Parse(args); err != nil { return err }
	var cfg BootstrapConfig; if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil { return err }
	problems := []string{}
	if cfg.State != candidateState { problems = append(problems, "bootstrap state is not CANDIDATE") }
	if cfg.VoteAuthority { problems = append(problems, "voteAuthority must remain false before governed activation") }
	if !isSHA256(cfg.GenesisDIRHash) { problems = append(problems, "invalid GenesisDIRHash") }
	if !contains(cfg.ActivationBlockedReasons, "GOVERNANCE_ACTIVATION_REQUIRED") { problems = append(problems, "missing governance activation block") }
	for _, purpose := range []string{"CONSENSUS", "VRF", "TRANSPORT"} {
		ref, ok := cfg.Keys[purpose]; if !ok || ref.PublicKeyB64 == "" { problems = append(problems, "missing "+purpose+" public key") }
		path := filepath.Join(*dir, "keys", "private", strings.ToLower(purpose)+".pk8"); info, err := os.Stat(path)
		if err != nil { problems = append(problems, "missing private key for "+purpose); continue }
		if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 { problems = append(problems, "private key permissions are too broad for "+purpose) }
	}
	_, safetyLatest, safetyRecords, safetyErr := latestConsensusSafetyRecord(*dir)
	if safetyErr != nil { problems = append(problems, "signed consensus safety journal verification failed: "+safetyErr.Error()) }
	if len(problems) > 0 { sort.Strings(problems); for _, p := range problems { fmt.Println("FAIL:", p) }; return fmt.Errorf("doctor found %d problem(s)", len(problems)) }
	fmt.Printf("OK: %s is a healthy local CANDIDATE bootstrap\n", cfg.FriendlyLabel)
	fmt.Println("OK: purpose-separated local key material present")
	fmt.Println("OK: vote authority is false and governance activation is blocked")
	fmt.Printf("OK: Genesis DIR pinned to %s\n", cfg.GenesisDIRHash)
	fmt.Printf("OK: signed consensus safety journal verified through sequence %d (%d record(s)); recovered round %d\n", safetyLatest.Sequence, len(safetyRecords), recoveredConsensusRound(safetyLatest))
	return nil
}

func verifyGenesisCommand(args []string) error {
	fs := flag.NewFlagSet("verify-genesis", flag.ContinueOnError); dir := fs.String("dir", defaultHome(), "validator data directory"); file := fs.String("file", "", "Genesis DIR JSON file"); if err := fs.Parse(args); err != nil { return err }; if *file == "" { return errors.New("--file is required") }
	var cfg BootstrapConfig; if err := readJSON(filepath.Join(*dir, "config.json"), &cfg); err != nil { return err }
	var genesis struct { ChainID string `json:"chainId"`; GenesisDIRHash string `json:"GenesisDIRHash"`; ObjectType string `json:"objectType"` }
	if err := readJSON(*file, &genesis); err != nil { return err }
	if genesis.ObjectType != "GenesisDIR" { return fmt.Errorf("expected objectType GenesisDIR, got %q", genesis.ObjectType) }
	if genesis.ChainID != cfg.ChainID { return fmt.Errorf("Genesis chainId mismatch: expected %s got %s", cfg.ChainID, genesis.ChainID) }
	if !strings.EqualFold(genesis.GenesisDIRHash, cfg.GenesisDIRHash) { return errors.New("Genesis DIR hash does not match locally pinned trust root") }
	fmt.Println("OK: Genesis DIR identity matches the locally pinned chain trust root")
	fmt.Println("NOTE: this legacy identity-only helper does not establish governance authority; use verify-genesis-trust for the threshold certificate.")
	return nil
}

func verifyPackageCommand(args []string) error {
	fs := flag.NewFlagSet("verify-package", flag.ContinueOnError); manifestPath := fs.String("manifest", "", "package manifest JSON"); publisherPublicKey := fs.String("publisher-public-key", "", "publisher Ed25519 public key DER, base64 or file path"); binaryPath := fs.String("binary", "", "optional validator binary"); sbomPath := fs.String("sbom", "", "optional SBOM"); if err := fs.Parse(args); err != nil { return err }
	if *manifestPath == "" || *publisherPublicKey == "" { return errors.New("--manifest and --publisher-public-key are required") }
	var m PackageManifest; if err := readJSON(*manifestPath, &m); err != nil { return err }; if err := validateManifest(m); err != nil { return err }
	pub, err := loadEd25519PublicKey(*publisherPublicKey); if err != nil { return err }; sig, err := base64.StdEncoding.DecodeString(m.PublisherSignature); if err != nil { return fmt.Errorf("decode publisher signature: %w", err) }
	u := unsignedManifest{m.PackageID, m.ValidatorVersion, m.ProtocolVersion, m.Platform, m.Architecture, strings.ToLower(m.BinaryHash), strings.ToLower(m.SBOMHash), m.PublisherKeyID, m.MinimumResources, m.SupportedFeatures, m.ReleaseChannel}; message, err := json.Marshal(u); if err != nil { return err }
	if !ed25519.Verify(pub, message, sig) { return errors.New("publisher signature verification failed") }
	for _, item := range []struct{path, expected, label string}{{*binaryPath,m.BinaryHash,"binary"},{*sbomPath,m.SBOMHash,"SBOM"}} { if item.path != "" { got, err := hashFile(item.path); if err != nil { return err }; if got != strings.ToLower(item.expected) { return fmt.Errorf("%s hash does not match package manifest", item.label) } } }
	fmt.Println("OK: publisher signature verified"); if *binaryPath != "" { fmt.Println("OK: binary hash verified") }; if *sbomPath != "" { fmt.Println("OK: SBOM hash verified") }; return nil
}

func validateManifest(m PackageManifest) error {
	if m.PackageID==""||m.ValidatorVersion==""||m.ProtocolVersion==""||m.Platform==""||m.Architecture==""||m.PublisherKeyID==""||m.PublisherSignature==""||m.ReleaseChannel=="" { return errors.New("package manifest is missing required fields") }
	if !isSHA256(m.BinaryHash)||!isSHA256(m.SBOMHash) { return errors.New("binaryHash and SBOMHash must be SHA-256 digests") }
	if len(m.MinimumResources)==0||len(m.SupportedFeatures)==0 { return errors.New("minimumResources and supportedFeatures must be non-empty") }; return nil
}
func loadEd25519PublicKey(value string) (ed25519.PublicKey,error) { var raw []byte; if b,err:=os.ReadFile(value); err==nil { raw=b } else { decoded,derr:=base64.StdEncoding.DecodeString(value); if derr!=nil { return nil,errors.New("publisher public key must be a DER file or base64 DER") }; raw=decoded }; parsed,err:=x509.ParsePKIXPublicKey(raw); if err!=nil{return nil,fmt.Errorf("parse publisher public key: %w",err)}; pub,ok:=parsed.(ed25519.PublicKey); if !ok{return nil,errors.New("publisher public key is not Ed25519")}; return pub,nil }
func isSHA256(v string) bool { if len(v)!=64{return false}; _,err:=hex.DecodeString(v); return err==nil }
func hashFile(path string)(string,error){f,err:=os.Open(path);if err!=nil{return "",err};defer f.Close();h:=sha256.New();if _,err:=io.Copy(h,f);err!=nil{return "",err};return hex.EncodeToString(h.Sum(nil)),nil}
func randomUUID()(string,error){b:=make([]byte,16);if _,err:=rand.Read(b);err!=nil{return "",err};b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;h:=hex.EncodeToString(b);return h[0:8]+"-"+h[8:12]+"-"+h[12:16]+"-"+h[16:20]+"-"+h[20:32],nil}
func splitNonEmpty(value string)[]string{if strings.TrimSpace(value)==""{return []string{}};parts:=strings.Split(value,",");out:=make([]string,0,len(parts));seen:=map[string]bool{};for _,p:=range parts{p=strings.TrimSpace(p);if p!=""&&!seen[p]{seen[p]=true;out=append(out,p)}};return out}
func contains(values []string,target string)bool{for _,v:=range values{if v==target{return true}};return false}
func writeJSON(path string,value any,mode os.FileMode)error{b,err:=json.MarshalIndent(value,"","  ");if err!=nil{return err};b=append(b,'\n');if err:=os.WriteFile(path,b,mode);err!=nil{return err};return os.Chmod(path,mode)}
func readJSON(path string,out any)error{b,err:=os.ReadFile(path);if err!=nil{return err};if err:=json.Unmarshal(b,out);err!=nil{return fmt.Errorf("parse %s: %w",path,err)};return nil}