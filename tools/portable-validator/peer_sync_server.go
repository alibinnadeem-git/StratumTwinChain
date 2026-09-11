package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"sort"
	"time"
)

func (r *PeerSyncRuntime) verifyConfiguredServingData(source string, now time.Time) error {
	if r.validatorSet == nil {
		return errors.New("sync serving validator set is not configured")
	}
	if len(r.proofs) == 0 {
		return errors.New("sync serving finality proofs are not configured")
	}
	heights := make([]int64, 0, len(r.proofs))
	for height := range r.proofs {
		heights = append(heights, height)
	}
	sort.Slice(heights, func(i, j int) bool { return heights[i] < heights[j] })

	for r.trustedHead.Height < heights[len(heights)-1] {
		from := r.trustedHead.Height
		to := from + defaultSyncProofBatch
		if to > heights[len(heights)-1] {
			to = heights[len(heights)-1]
		}
		proofs := make([]DIRFinalityProof, 0, to-from)
		for height := from + 1; height <= to; height++ {
			proof, ok := r.proofs[height]
			if !ok {
				// A certified snapshot may legitimately move the starting point forward.
				if r.snapshotCertificate != nil && r.snapshotCertificate.SnapshotHeight >= height {
					continue
				}
				return fmt.Errorf("locally configured proof history is not contiguous at height %d", height)
			}
			proofs = append(proofs, proof)
		}
		if len(proofs) == 0 {
			if r.snapshotCertificate == nil || r.snapshotCertificate.SnapshotHeight <= r.trustedHead.Height {
				return errors.New("configured sync data cannot advance the trusted head")
			}
			firstAfterSnapshot := r.snapshotCertificate.SnapshotHeight + 1
			proof, ok := r.proofs[firstAfterSnapshot]
			if !ok {
				return fmt.Errorf("missing first proof after snapshot height %d", r.snapshotCertificate.SnapshotHeight)
			}
			proofs = append(proofs, proof)
		}
		bundle := PeerSyncProofBundle{
			ProfileVersion:      peerSyncProfile,
			ResponseType:        "SYNC_PROOF",
			ChainID:             r.cfg.ChainID,
			GenesisDIRHash:      r.cfg.GenesisDIRHash,
			ProtocolVersion:     r.cfg.ProtocolVersion,
			ValidatorSet:        *r.validatorSet,
			SnapshotCertificate: r.snapshotCertificate,
			FinalityProofs:      proofs,
			GeneratedAt:         now.UTC().Format(time.RFC3339Nano),
		}
		before := r.trustedHead.Height
		if _, err := r.applyProofBundle(bundle, source, now); err != nil {
			return err
		}
		if r.trustedHead.Height <= before {
			return errors.New("configured sync data did not advance durable trusted head")
		}
	}
	return nil
}

func peerSyncHandler(session *PeerSessionRuntime, syncRuntime *PeerSyncRuntime) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":                     true,
			"peerSessionProfile":     peerSessionProfile,
			"peerSyncProfile":        peerSyncProfile,
			"state":                  session.cfg.State,
			"voteAuthority":          false,
			"consensusParticipation": false,
			"trustedHeight":          syncRuntime.trustedHead.Height,
			"trustedDIRHash":         syncRuntime.trustedHead.DIRHash,
		})
	})
	mux.HandleFunc("/v1/peer/message", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		defer req.Body.Close()
		body, err := io.ReadAll(io.LimitReader(req.Body, maxPeerEnvelopeBytes+1))
		if err != nil || int64(len(body)) > maxPeerEnvelopeBytes {
			http.Error(w, "invalid peer envelope", http.StatusBadRequest)
			return
		}
		var envelope PeerEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			http.Error(w, "invalid peer envelope", http.StatusBadRequest)
			return
		}
		if envelope.MessageType != "SYNC_HEAD" && envelope.MessageType != "SYNC_PROOF" {
			http.Error(w, "read-only sync endpoint accepts SYNC_HEAD and SYNC_PROOF only", http.StatusForbidden)
			return
		}

		now := time.Now().UTC()
		session.mu.Lock()
		verification, err := session.acceptInboundEnvelope(envelope, now)
		var response PeerEnvelope
		if err == nil {
			switch envelope.MessageType {
			case "SYNC_HEAD":
				_, err = decodePeerSyncHeadRequest(envelope.Payload)
				if err == nil {
					response, err = session.nextSignedEnvelope("SYNC_HEAD", syncRuntime.headResponse(), now)
				}
			case "SYNC_PROOF":
				var proofReq PeerSyncProofRequest
				proofReq, err = decodePeerSyncProofRequest(envelope.Payload)
				if err == nil {
					var bundle PeerSyncProofBundle
					bundle, err = syncRuntime.proofBundle(proofReq, now)
					if err == nil {
						response, err = session.nextSignedEnvelope("SYNC_PROOF", bundle, now)
					}
				}
			}
		}
		session.mu.Unlock()
		if err != nil {
			_ = verification
			http.Error(w, "peer sync envelope rejected", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(response)
	})
	return mux
}

func peerSyncServerCommand(args []string) error {
	fs := newFlagSet("serve-readonly-peer-sync")
	dir := fs.String("dir", defaultHome(), "validator data directory")
	registryPath := fs.String("peer-registry", "", "trusted peer transport registry JSON")
	height := fs.Int64("height", 0, "trusted peer-registry evaluation height")
	expectedRoot := fs.String("peer-registry-root", "", "trusted peer registry root")
	listen := fs.String("listen", "127.0.0.1:9443", "listen address")
	sessionStatePath := fs.String("session-state", "", "durable peer session state path")
	syncHeadPath := fs.String("sync-head-state", "", "durable proof-verified sync head path")
	validatorSetPath := fs.String("sync-validator-set", "", "validator-set JSON used by served finality proofs")
	snapshotPath := fs.String("sync-snapshot-cert", "", "optional snapshot trust certificate JSON")
	proofDir := fs.String("sync-proof-dir", "", "directory containing DIR finality proof JSON files")
	allowPlaintextLAN := fs.Bool("allow-plaintext-lan", false, "explicitly allow non-loopback HTTP behind a trusted TLS/reverse-proxy boundary")
	maxSkew := fs.Duration("max-clock-skew", 30*time.Second, "maximum accepted clock skew")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *registryPath == "" || *expectedRoot == "" {
		return errors.New("--peer-registry and --peer-registry-root are required")
	}
	if !*allowPlaintextLAN && !isLoopbackListenAddress(*listen) {
		return errors.New("non-loopback plaintext listen refused; terminate TLS in front or pass --allow-plaintext-lan explicitly")
	}
	if *sessionStatePath == "" {
		*sessionStatePath = filepath.Join(*dir, "state", "peer-session.json")
	}
	if *syncHeadPath == "" {
		*syncHeadPath = filepath.Join(*dir, "state", "peer-sync-head.json")
	}

	var registry PeerTransportRegistry
	if err := readJSON(*registryPath, &registry); err != nil {
		return err
	}
	session, err := newPeerSessionRuntime(*dir, registry, *height, *expectedRoot, *sessionStatePath, *maxSkew)
	if err != nil {
		return err
	}
	syncRuntime, err := newPeerSyncRuntime(session.cfg, *syncHeadPath)
	if err != nil {
		return err
	}
	set, cert, proofs, err := loadPeerSyncServingData(*validatorSetPath, *snapshotPath, *proofDir)
	if err != nil {
		return err
	}
	if err := syncRuntime.configureServingData(set, cert, proofs); err != nil {
		return err
	}
	if err := syncRuntime.verifyConfiguredServingData(session.cfg.ValidatorID, time.Now().UTC()); err != nil {
		return fmt.Errorf("refusing to serve unverified sync data: %w", err)
	}

	server := &http.Server{
		Addr:              *listen,
		Handler:           peerSyncHandler(session, syncRuntime),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    32 * 1024,
	}
	fmt.Printf("STRATUM proof-verifying read-only peer sync listening on %s; validator=%s; trustedHeight=%d; voteAuthority=false\n", *listen, session.cfg.ValidatorID, syncRuntime.trustedHead.Height)
	fmt.Println("Allowed message types: SYNC_HEAD, SYNC_PROOF. PROPOSE, VERIFY, COMMIT, ROUND_CHANGE, PLC/PFC voting and ACTIVE transitions remain unavailable.")
	return server.ListenAndServe()
}
