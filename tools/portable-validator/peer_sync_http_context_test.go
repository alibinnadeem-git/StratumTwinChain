package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPostPeerEnvelopeContextRejectsNilContext(t *testing.T) {
	if _, err := postPeerEnvelopeContext(nil, "http://127.0.0.1", PeerEnvelope{}); err == nil {
		t.Fatal("nil request context must be rejected")
	}
}

func TestPostPeerEnvelopeContextHonorsPreCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	started := time.Now()
	_, err := postPeerEnvelopeContext(ctx, "http://127.0.0.1:1", PeerEnvelope{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if time.Since(started) > time.Second {
		t.Fatal("pre-canceled peer request did not return promptly")
	}
}

func TestPostPeerEnvelopeContextCancelsBlockedHTTPRequest(t *testing.T) {
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(requestStarted)
		<-r.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() {
		_, err := postPeerEnvelopeContext(ctx, server.URL, PeerEnvelope{})
		result <- err
	}()

	select {
	case <-requestStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("test server did not receive peer request")
	}
	cancel()

	select {
	case err := <-result:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context cancellation from blocked request, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("blocked peer HTTP request was not canceled promptly")
	}
}

func TestGovernedPeerEnvelopeContextUsesSameCancellationBoundary(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := postGovernedPeerEnvelopeContext(ctx, "http://127.0.0.1:1", PeerEnvelope{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("governed peer transport must propagate context cancellation, got %v", err)
	}
}
