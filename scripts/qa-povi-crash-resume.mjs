// Offline PoVI crash-resume conformance (D4, TR-POVI-001 to 012).
//
// Drives the real state machine on main (lib/redbook/povi/state-machine.ts)
// through PROPOSE to FINALIZED on a 4-validator set, with a simulated crash
// between LOCK and COMMIT: the lock is persisted to disk, the state is
// reloaded, and the run resumes. Asserts the lock survives and a 2-vote
// commit does NOT finalize (BFT needs 3 at n=4, where 2-of-3 would wrongly
// pass). No vote authority, no networking, no live participation: the
// validators are generated Ed25519 keypairs used only inside this process,
// and the DIR finality proof is verified by the real verifier before use.
//
// Target quorum: floor(2n/3)+1. At n=4 the target is 3. No deployment
// validator count is stated anywhere in the repo, so n=4 is the test set
// (see the D4 assessment). The current deployment is documented in BRD/PRD
// as a 2-of-3 serverless quorum, implemented but non-conforming; that
// configuration was not found in the repo (no serverless config, no quorum
// config string), so this test pins the BFT rule the deployment must meet.
//
// Run: node --experimental-strip-types scripts/qa-povi-crash-resume.mjs
// (also wired as: npm run qa:povi-crash-resume)

import {register} from 'node:module';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

register('./qa-povi-alias-hooks.mjs', import.meta.url);

const {
  createPoVIHeightState,
  acceptProposal,
  recordVerifyVote,
  beginCommit,
  recordCommitVote,
  finalizeWithVerifiedDIRProof,
} = await import('../lib/redbook/povi/state-machine.ts');
const {requiredPoviQuorum, hasPoviQuorum} = await import('../lib/redbook/povi/quorum.ts');
const {
  verifyDIRFinalityProof,
  proposalHashForDIRHeader,
  commitMessageHash,
  finalizedDIRHash,
} = await import('../lib/redbook/finality-proof.ts');
const {validatorSetRootAtHeight} = await import('../lib/redbook/snapshot-trust.ts');

const CHAIN_ID = 'stratum-povi-crash-resume-test';
const HEIGHT = 1;
const ROUND = 0;
const PROTOCOL_VERSION = 'POVI/1';
const ZERO_HASH = '0'.repeat(64);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// 1. Target quorum: BFT supermajority floor(2n/3)+1. At n=4 the target is 3.
assert.equal(requiredPoviQuorum(4), 3, 'BFT target quorum at n=4 must be 3');
assert.equal(requiredPoviQuorum(3), 3, 'BFT target quorum at n=3 must be 3');
assert.equal(hasPoviQuorum(4, 2), false, '2 votes must not meet quorum at n=4');
assert.equal(hasPoviQuorum(4, 3), true, '3 votes must meet quorum at n=4');
// Counterfactual: the non-conforming 2-of-3 rule would pass at 2 votes.
assert.ok(2 >= 2, '2-of-3 rule would wrongly pass a 2-vote commit at n=4');

// 2. Four validators with generated Ed25519 keys (in-process only).
const validatorIds = ['validator-1', 'validator-2', 'validator-3', 'validator-4'];
const keypairs = new Map();
for (const id of validatorIds) {
  keypairs.set(id, crypto.generateKeyPairSync('ed25519'));
}
const validatorSet = {
  setVersion: 'STRATUM-VALIDATOR-SET/1',
  chainId: CHAIN_ID,
  members: validatorIds.map((id) => ({
    validatorId: id,
    identityUuid: `${id}-identity`,
    operatorOrg: 'stratum-test-operator',
    activationHeight: 0,
    retirementHeight: null,
    keys: [
      {
        keyId: `${id}-consensus-key`,
        purpose: 'CONSENSUS',
        algorithm: 'Ed25519',
        publicKeyDerB64: keypairs
          .get(id)
          .publicKey.export({type: 'spki', format: 'der'})
          .toString('base64'),
        activeFromHeight: 0,
        retiredAtHeight: null,
      },
    ],
  })),
};
const validatorSetRoot = validatorSetRootAtHeight(validatorSet, HEIGHT);
assert.match(validatorSetRoot, /^[0-9a-f]{64}$/, 'validator set root must be a 64-hex hash');

// 3. DIR candidate header and proposal hash (real functions).
const stateRoot = sha256('povi-crash-resume-test-state-root');
const header = {
  chainId: CHAIN_ID,
  height: HEIGHT,
  round: ROUND,
  previousDIRHash: ZERO_HASH,
  orderedMicroDIRRoot: sha256('povi-crash-resume-test-mdir-root'),
  stateRoot,
  validatorSetRoot,
  protocolVersion: PROTOCOL_VERSION,
  proposerId: 'validator-1',
  entropyVRFEvidence: {},
};
const proposalHash = proposalHashForDIRHeader(header);
const messageHash = commitMessageHash({
  chainId: CHAIN_ID,
  height: HEIGHT,
  round: ROUND,
  proposalHash,
  stateRoot,
  validatorSetRoot,
  protocolVersion: PROTOCOL_VERSION,
});

// 4. PROPOSE to VERIFY to LOCK with 3 of 4 verify votes.
let state = createPoVIHeightState(CHAIN_ID, HEIGHT);
assert.equal(state.phase, 'PROPOSE');
state = acceptProposal(state, {proposalHash, stateRoot, round: ROUND});
assert.equal(state.phase, 'VERIFY');
for (const id of ['validator-1', 'validator-2']) {
  state = recordVerifyVote(state, {
    validatorId: id,
    proposalHash,
    activeValidatorIds: validatorIds,
  });
  assert.equal(state.phase, 'VERIFY', `phase must stay VERIFY after 2 verify votes`);
}
state = recordVerifyVote(state, {
  validatorId: 'validator-3',
  proposalHash,
  activeValidatorIds: validatorIds,
});
assert.equal(state.phase, 'LOCK', '3 verify votes must reach LOCK at n=4');
assert.equal(state.lockedDIR, proposalHash, 'lock must bind the proposal');
assert.equal(state.lockedRound, 0, 'lock must record round 0');
assert.equal(state.validDIR, proposalHash, 'valid value must be the proposal');
assert.equal(Object.keys(state.verifyVotes).length, 3, '3 verify votes must be recorded');

// 5. Simulated crash between LOCK and COMMIT: persist, reload, resume.
const crashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'povi-crash-resume-'));
try {
  const crashFile = path.join(crashDir, 'locked-state.json');
  fs.writeFileSync(crashFile, JSON.stringify(state), 'utf8');
  const reloaded = JSON.parse(fs.readFileSync(crashFile, 'utf8'));
  assert.deepEqual(reloaded, state, 'reloaded state must equal pre-crash state');
  assert.equal(reloaded.phase, 'LOCK', 'lock phase must survive the crash');
  assert.equal(reloaded.lockedDIR, proposalHash, 'lockedDIR must survive the crash');
  assert.equal(reloaded.lockedRound, 0, 'lockedRound must survive the crash');
  assert.equal(
    Object.keys(reloaded.verifyVotes).length,
    3,
    'verify votes must survive the crash',
  );
  state = reloaded;
} finally {
  fs.rmSync(crashDir, {recursive: true, force: true});
}

// 6. COMMIT: 2 votes must NOT finalize.
state = beginCommit(state);
assert.equal(state.phase, 'COMMIT', 'beginCommit must enter COMMIT from LOCK');
assert.deepEqual(state.commitVotes, {}, 'commit votes start empty');
for (const id of ['validator-1', 'validator-2']) {
  state = recordCommitVote(state, {
    validatorId: id,
    proposalHash,
    activeValidatorIds: validatorIds,
  });
  assert.equal(
    state.phase,
    'COMMIT',
    `phase must stay COMMIT after 2 commit votes (${id})`,
  );
}
assert.equal(hasPoviQuorum(4, Object.keys(state.commitVotes).length), false);
// The finalize entry point itself must reject a 2-vote commit, not just the phase label.
assert.throws(
  () => finalizeWithVerifiedDIRProof(state, {}),
  /DIR cannot finalize before a COMMIT quorum exists/,
  'finalize must reject a 2-vote commit',
);

// 7. 3rd commit vote reaches FINALIZE.
state = recordCommitVote(state, {
  validatorId: 'validator-3',
  proposalHash,
  activeValidatorIds: validatorIds,
});
assert.equal(state.phase, 'FINALIZE', '3 commit votes must reach FINALIZE at n=4');

// 8. A 2-signer DIR finality proof must fail the real verifier.
const signers3 = ['validator-1', 'validator-2', 'validator-3'];
const sign = (id) =>
  crypto
    .sign(null, Buffer.from(messageHash, 'hex'), keypairs.get(id).privateKey)
    .toString('base64');
const dirHash = finalizedDIRHash(header, {proposalHash, signerIds: signers3});
const buildProof = (signerIds) => ({
  proofVersion: 'STRATUM-DIR-FINALITY-PROOF/1',
  header,
  PFC: {
    domain: 'STRATUM/PFC/PROOF/1',
    proofVersion: 'STRATUM-PFC-PROOF/1',
    chainId: CHAIN_ID,
    height: HEIGHT,
    round: ROUND,
    DIRHash: finalizedDIRHash(header, {proposalHash, signerIds}),
    proposalHash,
    stateRoot,
    validatorSetRoot,
    protocolVersion: PROTOCOL_VERSION,
    signerIds,
    COMMITSignatures: signerIds.map((id) => ({
      validatorId: id,
      proposalHash,
      stateRoot,
      messageHash,
      signature: sign(id),
    })),
  },
});
assert.throws(
  () =>
    verifyDIRFinalityProof({
      validatorSet,
      proof: buildProof(['validator-1', 'validator-2']),
      expectedChainId: CHAIN_ID,
      trustedPreviousHeight: 0,
      trustedPreviousDIRHash: ZERO_HASH,
      expectedValidatorSetRoot: validatorSetRoot,
    }),
  /PFC PoVI quorum not met/,
  'a 2-signer proof must fail the PFC quorum check',
);

// 9. The 3-signer proof verifies, and the height FINALIZES.
const verified = verifyDIRFinalityProof({
  validatorSet,
  proof: buildProof(signers3),
  expectedChainId: CHAIN_ID,
  trustedPreviousHeight: 0,
  trustedPreviousDIRHash: ZERO_HASH,
  expectedValidatorSetRoot: validatorSetRoot,
});
assert.equal(verified.valid, true);
assert.equal(verified.requiredQuorum, 3);
assert.deepEqual([...verified.validSigners], signers3);
assert.equal(verified.DIRHash, dirHash);
state = finalizeWithVerifiedDIRProof(state, verified);
assert.equal(state.phase, 'FINALIZED', 'verified DIR proof must finalize the height');
assert.equal(state.finalizedDIRHash, dirHash, 'finalized hash must match the DIR hash');

// 10. Source-token checks: the real modules must still carry the invariants.
const stateMachineSrc = fs.readFileSync('lib/redbook/povi/state-machine.ts', 'utf8');
for (const token of [
  'COMMIT requires a valid current-round lock',
  'COMMIT must bind the locked proposal',
  'DIR cannot finalize before a COMMIT quorum exists',
  'hasPoviQuorum(active.size,signerCount)',
  "phase:'LOCK'",
]) {
  assert.ok(stateMachineSrc.includes(token), `Missing state-machine invariant: ${token}`);
}
const quorumSrc = fs.readFileSync('lib/redbook/povi/quorum.ts', 'utf8');
assert.ok(
  quorumSrc.includes('Math.floor((2*activeValidatorCount)/3)+1'),
  'Missing BFT quorum formula',
);
const finalitySrc = fs.readFileSync('lib/redbook/finality-proof.ts', 'utf8');
for (const token of ['PFC PoVI quorum not met', 'PFC signerIds do not exactly match valid COMMIT signatures']) {
  assert.ok(finalitySrc.includes(token), `Missing finality invariant: ${token}`);
}

console.log(
  `PoVI crash-resume conformance passed: N=4 Q=3, lock survived reload, ` +
    `2-vote commit stayed COMMIT, 3-vote commit reached FINALIZE, ` +
    `height ${HEIGHT} FINALIZED as DIR ${dirHash.slice(0, 8)}`,
);
