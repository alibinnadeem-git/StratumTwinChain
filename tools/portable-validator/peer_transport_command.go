package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func verifyPeerEnvelopeCommand(args []string) error {
	fs:=flag.NewFlagSet("verify-peer-envelope",flag.ContinueOnError)
	registryPath:=fs.String("peer-registry","","trusted peer transport registry JSON")
	envelopePath:=fs.String("envelope","","signed peer envelope JSON")
	height:=fs.Int64("height",0,"trusted chain height for transport key history")
	expectedRoot:=fs.String("peer-registry-root","","trusted peer registry root")
	replayStatePath:=fs.String("replay-state","","optional durable replay-state file")
	maxSkew:=fs.Duration("max-clock-skew",30*time.Second,"maximum accepted clock skew")
	if err:=fs.Parse(args);err!=nil{return err}
	if *registryPath==""||*envelopePath==""||*expectedRoot==""{return errors.New("--peer-registry, --envelope and --peer-registry-root are required")}
	if *height<0{return errors.New("--height must be non-negative")}
	if !isSHA256(*expectedRoot){return errors.New("--peer-registry-root must be a SHA-256 digest")}
	var registry PeerTransportRegistry;if err:=readJSON(*registryPath,&registry);err!=nil{return err}
	var envelope PeerEnvelope;if err:=readJSON(*envelopePath,&envelope);err!=nil{return err}
	result,err:=verifyPeerEnvelope(registry,envelope,*height,*expectedRoot,time.Now().UTC(),*maxSkew);if err!=nil{return err}
	if *replayStatePath!=""{
		state,err:=loadPeerReplayState(*replayStatePath,registry.ChainID);if err!=nil{return err};prunePeerReplayState(&state,time.Now().UTC());if err:=applyPeerReplayProtection(&state,envelope);err!=nil{return err}
		if err:=os.MkdirAll(filepath.Dir(*replayStatePath),0o700);err!=nil{return err};if err:=writeJSON(*replayStatePath,state,0o600);err!=nil{return err}
	}
	b,err:=json.MarshalIndent(result,"","  ");if err!=nil{return err};fmt.Println(string(b))
	fmt.Println("READ-ONLY: authenticated peer transport does not grant PoVI vote authority or emit consensus signatures.")
	return nil
}
