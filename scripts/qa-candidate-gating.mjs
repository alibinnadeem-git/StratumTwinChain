import {gateEquipmentCandidates} from '../lib/candidate-gating.ts';

// Phase 2c candidate-gating contract. Tags/placed symbols/resolved anchors are INSTANCEs; bare
// repeated class words are LABELs; derived L4 copies are REGISTRATION_SHADOWs. Synthetic only.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}
const roleOf=e=>e.meta?.candidateRole;

const entities=[
  // INSTANCE: numeric tag.
  {id:'i1',layer:'L2',kind:'text-asset-candidate',name:'MS1',meta:{}},
  {id:'i2',layer:'L2',kind:'text-asset-candidate',name:'LP-3',meta:{}},
  // INSTANCE: numeric designator; and a bare word rescued by a resolved vector-symbol anchor.
  {id:'i3',layer:'L2',kind:'text-asset-candidate',name:'XFMR-2',meta:{}},
  {id:'i4',layer:'L2',kind:'text-asset-candidate',name:'Panel',meta:{symbolAnchorStatus:'RESOLVED_REVIEW_CANDIDATE'}},
  // INSTANCE: placed symbol kind.
  {id:'i5',layer:'L2',kind:'legend-symbol-match-candidate',name:'MOTOR · project legend open-vector match',meta:{}},
  // LABEL: bare class words, no tag/anchor/cluster.
  {id:'l1',layer:'L2',kind:'text-asset-candidate',name:'PANEL',meta:{}},
  {id:'l2',layer:'L2',kind:'text-asset-candidate',name:'CO',meta:{}},
  {id:'l3',layer:'L2',kind:'text-asset-candidate',name:'Solar',meta:{}},
  {id:'l4',layer:'L2',kind:'text-asset-candidate',name:'ELEC SERVICE & ONE-LINE DIAGRAM',meta:{}},
  // REGISTRATION_SHADOW: derived L4 copy.
  {id:'s1',layer:'L4',kind:'asset-candidate',name:'MS1',meta:{derivedFrom:'i1'}},
  // Non-equipment geometry is untouched.
  {id:'g1',layer:'L1',kind:'line',name:'Drawing line',meta:{}},
];

const gated=gateEquipmentCandidates(entities);
const byId=Object.fromEntries(gated.map(e=>[e.id,e]));

ok('MS1 -> INSTANCE (numeric tag)',roleOf(byId.i1)==='INSTANCE');
ok('LP-3 -> INSTANCE (numeric tag)',roleOf(byId.i2)==='INSTANCE');
ok('XFMR-2 -> INSTANCE (numeric tag)',roleOf(byId.i3)==='INSTANCE');
ok('Panel w/ resolved anchor -> INSTANCE',roleOf(byId.i4)==='INSTANCE');
ok('legend symbol match -> INSTANCE',roleOf(byId.i5)==='INSTANCE');
ok('bare PANEL -> LABEL',roleOf(byId.l1)==='LABEL');
ok('bare CO -> LABEL',roleOf(byId.l2)==='LABEL');
ok('bare Solar -> LABEL',roleOf(byId.l3)==='LABEL');
ok('title phrase -> LABEL',roleOf(byId.l4)==='LABEL');
ok('derived L4 copy -> REGISTRATION_SHADOW',roleOf(byId.s1)==='REGISTRATION_SHADOW');
ok('geometry line is not gated',roleOf(byId.g1)===undefined);

console.log('\nCandidate-gating contract passed.');
