package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

func postPeerEnvelopeContext(ctx context.Context, endpoint string, envelope PeerEnvelope) (PeerEnvelope, error) {
	if ctx == nil {
		return PeerEnvelope{}, errors.New("peer sync request requires a non-nil context")
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return PeerEnvelope{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return PeerEnvelope{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return PeerEnvelope{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return PeerEnvelope{}, fmt.Errorf("peer returned HTTP %d", resp.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxPeerEnvelopeBytes+1))
	if err != nil {
		return PeerEnvelope{}, err
	}
	if int64(len(responseBody)) > maxPeerEnvelopeBytes {
		return PeerEnvelope{}, errors.New("peer sync response too large")
	}
	var response PeerEnvelope
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return PeerEnvelope{}, err
	}
	return response, nil
}

func postGovernedPeerEnvelopeContext(ctx context.Context, endpoint string, envelope PeerEnvelope) (PeerEnvelope, error) {
	return postPeerEnvelopeContext(ctx, endpoint, envelope)
}
