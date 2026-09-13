package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func waitFollowerContext(ctx context.Context, delay time.Duration) bool {
	if delay <= 0 {
		return true
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func peerSyncFollowerManagedCommand(args []string) error {
	fs := newFlagSet("peer-sync-follow")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	targetsRaw := fs.String("targets", "", "comma-separated peer base URLs")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	headStatePath := fs.String("peer-head-state", "", "durable authenticated peer head observation state path")
	evidenceJournalPath := fs.String("evidence-journal", "", "durable peer safety evidence journal path")
	quarantineStatePath := fs.String("quarantine-state", "", "durable local peer quarantine state path")
	statusPath := fs.String("follower-status-state", "", "durable follower heartbeat/status state path")
	alertWebhookRaw := fs.String("alert-webhook", "", "optional HTTPS webhook for best-effort delivery of already-persisted follower safety alerts")
	alertBearerTokenFile := fs.String("alert-bearer-token-file", "", "optional owner-only bearer token file for --alert-webhook")
	alertDeliveryPath := fs.String("alert-delivery-state", "", "durable non-authoritative automatic alert delivery receipt journal path")
	alertDeliveryTimeout := fs.Duration("alert-delivery-timeout", 10*time.Second, "automatic alert webhook request timeout")
	policyHash := fs.String("governance-policy-hash", "", "independently pinned validator-governance policy SHA-256")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	batchSize := fs.Int64("batch-size", defaultSyncProofBatch, "DIR finality proofs requested per governed bundle")
	pollInterval := fs.Duration("poll-interval", 15*time.Second, "successful follower polling interval")
	maxBackoff := fs.Duration("max-backoff", 2*time.Minute, "maximum retry delay after transient follower failure")
	once := fs.Bool("once", false, "run exactly one survey/resolve/sync cycle")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" || strings.TrimSpace(*targetsRaw) == "" || !isSHA256(strings.ToLower(*policyHash)) {
		return errors.New("--peer-registry, --peer-registry-root, --targets and a valid --governance-policy-hash are required")
	}
	if *batchSize < 1 || *batchSize > maxSyncProofsPerBundle {
		return fmt.Errorf("--batch-size must be between 1 and %d", maxSyncProofsPerBundle)
	}
	if *pollInterval < time.Second || *pollInterval > time.Hour {
		return errors.New("--poll-interval must be between 1s and 1h")
	}
	if *maxBackoff < *pollInterval || *maxBackoff > 6*time.Hour {
		return errors.New("--max-backoff must be at least --poll-interval and no more than 6h")
	}
	if *alertDeliveryTimeout < time.Second || *alertDeliveryTimeout > time.Minute {
		return errors.New("--alert-delivery-timeout must be between 1s and 1m")
	}
	if strings.TrimSpace(*alertBearerTokenFile) != "" && strings.TrimSpace(*alertWebhookRaw) == "" {
		return errors.New("--alert-bearer-token-file requires --alert-webhook")
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *syncHeadPath == "" {
		*syncHeadPath = filepath.Join(*dir, "state", "peer-sync-head.json")
	}
	if *headStatePath == "" {
		*headStatePath = filepath.Join(*dir, "state", "peer-heads.json")
	}
	if *evidenceJournalPath == "" {
		*evidenceJournalPath = filepath.Join(*dir, "state", "peer-evidence.json")
	}
	if *quarantineStatePath == "" {
		*quarantineStatePath = filepath.Join(*dir, "state", "peer-quarantine.json")
	}
	if *statusPath == "" {
		*statusPath = filepath.Join(*dir, "state", "peer-follower-status.json")
	}
	if *alertDeliveryPath == "" {
		*alertDeliveryPath = filepath.Join(filepath.Dir(*evidenceJournalPath), "peer-operator-alert-deliveries.json")
	}
	config := PeerFollowerConfig{
		Dir:                  *dir,
		RegistryPath:         *registryPath,
		RegistryHeight:       *height,
		RegistryRoot:         strings.ToLower(*expectedRoot),
		Targets:              splitNonEmpty(*targetsRaw),
		SessionStatePath:     *sessionStatePath,
		SyncHeadPath:         *syncHeadPath,
		PeerHeadStatePath:    *headStatePath,
		EvidenceJournalPath:  *evidenceJournalPath,
		QuarantineStatePath:  *quarantineStatePath,
		GovernancePolicyHash: strings.ToLower(*policyHash),
		MaxClockSkew:         *maxSkew,
		BatchSize:            *batchSize,
		PollInterval:         *pollInterval,
		MaxBackoff:           *maxBackoff,
		Once:                 *once,
	}
	if len(config.Targets) == 0 {
		return errors.New("at least one peer target is required")
	}
	var bootstrap BootstrapConfig
	if err := readJSON(filepath.Join(*dir, "config.json"), &bootstrap); err != nil {
		return err
	}
	if bootstrap.State != candidateState || bootstrap.VoteAuthority {
		return errors.New("managed peer follower requires CANDIDATE state with voteAuthority=false")
	}
	var alertWebhookEnabled bool
	var alertWebhookURL = (*url.URL)(nil)
	if strings.TrimSpace(*alertWebhookRaw) != "" {
		validated, err := validateOperatorAlertWebhookURL(*alertWebhookRaw)
		if err != nil {
			return fmt.Errorf("invalid --alert-webhook: %w", err)
		}
		alertWebhookURL = validated
		alertWebhookEnabled = true
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	started := newPeerFollowerStatus(bootstrap, "RUNNING", time.Now().UTC())
	if err := savePeerFollowerStatusAtomic(*statusPath, started, bootstrap); err != nil {
		return fmt.Errorf("persist follower start status: %w", err)
	}

	failures := 0
	var lastResult PeerFollowerCycleResult
	for {
		if ctx.Err() != nil {
			stopped := followerStatusFromCycle(bootstrap, lastResult, "STOPPED", failures, nil, time.Time{}, time.Now().UTC())
			if err := savePeerFollowerStatusAtomic(*statusPath, stopped, bootstrap); err != nil {
				return fmt.Errorf("persist follower stopped status: %w", err)
			}
			return nil
		}

		cycleStarted := newPeerFollowerStatus(bootstrap, "RUNNING", time.Now().UTC())
		cycleStarted.ConsecutiveFailures = failures
		if err := savePeerFollowerStatusAtomic(*statusPath, cycleStarted, bootstrap); err != nil {
			return fmt.Errorf("persist follower running status: %w", err)
		}

		result, err := runPeerFollowerCycleContext(ctx, config)
		lastResult = result
		if ctx.Err() != nil {
			stopped := followerStatusFromCycle(bootstrap, lastResult, "STOPPED", failures, nil, time.Time{}, time.Now().UTC())
			if saveErr := savePeerFollowerStatusAtomic(*statusPath, stopped, bootstrap); saveErr != nil {
				return fmt.Errorf("persist follower stopped status after request cancellation: %w", saveErr)
			}
			return nil
		}

		if alertWebhookEnabled {
			token, tokenErr := readBearerTokenFile(*alertBearerTokenFile)
			if tokenErr != nil {
				fmt.Fprintf(os.Stderr, "Operator alert auto-delivery skipped; follower safety state unchanged: %v\n", tokenErr)
			} else {
				alertPath := filepath.Join(filepath.Dir(config.EvidenceJournalPath), "peer-operator-alerts.json")
				client := newOperatorAlertWebhookHTTPClient(*alertDeliveryTimeout)
				if _, deliveryErr := autoDeliverPendingPeerOperatorAlertsContext(ctx, client, bootstrap, alertPath, *alertDeliveryPath, alertWebhookURL, token, time.Now().UTC()); deliveryErr != nil {
					fmt.Fprintf(os.Stderr, "Operator alert auto-delivery best-effort failure; follower safety state unchanged: %v\n", deliveryErr)
				}
			}
		}

		out, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(out))
		now := time.Now().UTC()

		if err == nil {
			failures = 0
			idle := followerStatusFromCycle(bootstrap, result, "IDLE", 0, nil, now.Add(config.PollInterval), now)
			if config.Once {
				idle.RuntimeState = "STOPPED"
				idle.NextRetryAt = ""
			}
			if err := savePeerFollowerStatusAtomic(*statusPath, idle, bootstrap); err != nil {
				return fmt.Errorf("persist follower success status: %w", err)
			}
			if config.Once {
				return nil
			}
			if !waitFollowerContext(ctx, config.PollInterval) {
				continue
			}
			continue
		}

		if followerSafetyHalt(result.Resolution.Classification) {
			halted := followerStatusFromCycle(bootstrap, result, "SAFETY_HALT", failures, err, time.Time{}, now)
			if saveErr := savePeerFollowerStatusAtomic(*statusPath, halted, bootstrap); saveErr != nil {
				return fmt.Errorf("peer follower safety halt %s; additionally failed to persist halt status: %v: %w", result.Resolution.Classification, saveErr, err)
			}
			return fmt.Errorf("peer follower safety halt: %s: %w", result.Resolution.Classification, err)
		}
		if config.Once {
			stopped := followerStatusFromCycle(bootstrap, result, "STOPPED", 1, err, time.Time{}, now)
			if saveErr := savePeerFollowerStatusAtomic(*statusPath, stopped, bootstrap); saveErr != nil {
				return fmt.Errorf("persist follower one-shot failure status: %v: %w", saveErr, err)
			}
			return err
		}

		failures++
		delay := followerBackoff(config.PollInterval, config.MaxBackoff, failures)
		nextRetry := now.Add(delay)
		backoff := followerStatusFromCycle(bootstrap, result, "BACKOFF", failures, err, nextRetry, now)
		if saveErr := savePeerFollowerStatusAtomic(*statusPath, backoff, bootstrap); saveErr != nil {
			return fmt.Errorf("persist follower backoff status: %v: %w", saveErr, err)
		}
		fmt.Printf("Follower cycle blocked/transient failure; retrying after %s; voteAuthority=false consensusParticipation=false; error=%v\n", delay, err)
		if !waitFollowerContext(ctx, delay) {
			continue
		}
	}
}
