package main

import (
	"errors"
	"fmt"
	"sort"
)

const (
	proposerSelectionProfile = "STRATUM-PROPOSER-SELECTION/1"
	proposerSelectionDomain  = "STRATUM/POVI/PROPOSER_SELECTION/1"
)

type ProposerCandidate struct {
	ValidatorID               string `json:"validatorId"`
	VRFOutput                 string `json:"vrfOutput"`
	VRFProofRef               string `json:"vrfProofRef"`
	VRFProofVerifiedExternally bool   `json:"vrfProofVerifiedExternally"`
}

type ProposerSelectionInput struct {
	SelectionProfile                    string              `json:"selectionProfile"`
	ChainID                             string              `json:"chainId"`
	Height                              int64               `json:"height"`
	Round                               int64               `json:"round"`
	ValidatorSetRoot                    string              `json:"validatorSetRoot"`
	ProtocolVersion                     string              `json:"protocolVersion"`
	CollectiveEntropy                   string              `json:"collectiveEntropy"`
	CollectiveEntropyProofRefs          []string            `json:"collectiveEntropyProofRefs"`
	CollectiveEntropyVerifiedExternally bool                `json:"collectiveEntropyVerifiedExternally"`
	Candidates                          []ProposerCandidate `json:"candidates"`
}

type ProposerScore struct { ValidatorID string `json:"validatorId"`; Score string `json:"score"` }

type ProposerSelectionResult struct {
	SelectionProfile          string          `json:"selectionProfile"`
	SelectionDomain           string          `json:"selectionDomain"`
	ChainID                   string          `json:"chainId"`
	Height                    int64           `json:"height"`
	Round                     int64           `json:"round"`
	ValidatorSetRoot          string          `json:"validatorSetRoot"`
	ProtocolVersion           string          `json:"protocolVersion"`
	CollectiveEntropy         string          `json:"collectiveEntropy"`
	SelectedProposerID        string          `json:"selectedProposerId"`
	SelectedScore             string          `json:"selectedScore"`
	EligibleValidatorCount    int             `json:"eligibleValidatorCount"`
	CandidateScores           []ProposerScore `json:"candidateScores"`
	VRFProofVerification      string          `json:"vrfProofVerification"`
	CryptographicVRFConformant bool           `json:"cryptographicVRFConformant"`
}

func proposerScore(selection ProposerSelectionInput,candidate ProposerCandidate)(string,error){
	return canonicalHashValue(map[string]any{
		"domain":proposerSelectionDomain,"profile":proposerSelectionProfile,
		"chainId":selection.ChainID,"height":selection.Height,"round":selection.Round,
		"validatorSetRoot":selection.ValidatorSetRoot,"protocolVersion":selection.ProtocolVersion,
		"collectiveEntropy":selection.CollectiveEntropy,"validatorId":candidate.ValidatorID,"vrfOutput":candidate.VRFOutput,
	})
}

func selectPortableProposer(set SnapshotValidatorSet,selection ProposerSelectionInput,expectedRoot string)(ProposerSelectionResult,error){
	if selection.SelectionProfile!=proposerSelectionProfile{return ProposerSelectionResult{},errors.New("unsupported proposer-selection profile")}
	if set.ChainID!=selection.ChainID{return ProposerSelectionResult{},errors.New("proposer-selection chainId mismatch")}
	if selection.Height<1||selection.Round<0{return ProposerSelectionResult{},errors.New("proposer-selection height/round invalid")}
	if !isSHA256(selection.CollectiveEntropy){return ProposerSelectionResult{},errors.New("collectiveEntropy must be a SHA-256 digest")}
	if !selection.CollectiveEntropyVerifiedExternally||len(selection.CollectiveEntropyProofRefs)<1{return ProposerSelectionResult{},errors.New("collective entropy must be externally verified with proof references")}
	root,err:=snapshotValidatorSetRoot(set,selection.Height);if err!=nil{return ProposerSelectionResult{},err}
	if root!=expectedRoot||selection.ValidatorSetRoot!=root{return ProposerSelectionResult{},fmt.Errorf("proposer-selection trusted validator-set root mismatch: computed %s",root)}
	active:=activeSnapshotMembers(set,selection.Height)
	activeIDs:=make([]string,0,len(active));for _,m:=range active{activeIDs=append(activeIDs,m.ValidatorID)};sort.Strings(activeIDs)
	seen:=map[string]bool{};candidateIDs:=make([]string,0,len(selection.Candidates));scores:=make([]ProposerScore,0,len(selection.Candidates))
	for _,candidate:=range selection.Candidates{
		if candidate.ValidatorID==""||!isSHA256(candidate.VRFOutput)||candidate.VRFProofRef==""||!candidate.VRFProofVerifiedExternally{return ProposerSelectionResult{},fmt.Errorf("candidate %s lacks an externally verified VRF output/proof reference",candidate.ValidatorID)}
		if seen[candidate.ValidatorID]{return ProposerSelectionResult{},fmt.Errorf("duplicate proposer candidate %s",candidate.ValidatorID)};seen[candidate.ValidatorID]=true;candidateIDs=append(candidateIDs,candidate.ValidatorID)
		score,err:=proposerScore(selection,candidate);if err!=nil{return ProposerSelectionResult{},err};scores=append(scores,ProposerScore{candidate.ValidatorID,score})
	}
	sort.Strings(candidateIDs);if len(activeIDs)!=len(candidateIDs){return ProposerSelectionResult{},errors.New("equal eligible opportunity requires exactly one candidate for every ACTIVE validator")}
	for i:=range activeIDs{if activeIDs[i]!=candidateIDs[i]{return ProposerSelectionResult{},errors.New("equal eligible opportunity requires exactly one candidate for every ACTIVE validator and no non-ACTIVE candidates")}}
	sort.Slice(scores,func(i,j int)bool{if scores[i].Score==scores[j].Score{return scores[i].ValidatorID<scores[j].ValidatorID};return scores[i].Score<scores[j].Score})
	if len(scores)==0{return ProposerSelectionResult{},errors.New("no eligible proposer candidates")}
	selected:=scores[0]
	return ProposerSelectionResult{proposerSelectionProfile,proposerSelectionDomain,selection.ChainID,selection.Height,selection.Round,root,selection.ProtocolVersion,selection.CollectiveEntropy,selected.ValidatorID,selected.Score,len(activeIDs),scores,"EXTERNAL_VERIFIED_INPUT",false},nil
}
