import {resolveSheetScaleCandidate} from '../lib/sheet-scale.ts';

// Phase 3 sheet-scale consolidation contract. Corroborated > declared; declared-only is a capped
// REVIEW candidate; MISMATCH and UNRESOLVED yield no candidate. Never auto-applied.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

// Independent witnesses corroborate a scale -> CORROBORATED candidate at full confidence.
const corroborated=resolveSheetScaleCandidate({status:'CORROBORATED',declaredMetersPerNormalizedSheetUnit:2.9,corroboratedMetersPerNormalizedSheetUnit:2.95,confidence:.82});
ok('corroborated -> candidate',Boolean(corroborated));
ok('corroborated uses the corroborated value',corroborated.metersPerNormalizedSheetUnit===2.95);
ok('corroborated status CORROBORATED',corroborated.status==='CORROBORATED');
ok('corroborated authority INDEPENDENT_WITNESS_CORROBORATED',corroborated.authority==='INDEPENDENT_WITNESS_CORROBORATED');
ok('corroborated is review-gated, never auto-applied',corroborated.reviewRequired===true&&corroborated.autoApply===false&&corroborated.geometryScaleAuthority===false);

// Declared-only (title block, no witness) is NOT a sizing candidate (Phase 3b: ~6.2x unreliable).
ok('declared-only -> no sizing candidate',resolveSheetScaleCandidate({status:'REVIEW',declaredMetersPerNormalizedSheetUnit:2.9,corroboratedMetersPerNormalizedSheetUnit:null,confidence:.8})===null);
ok('declared-only (UNRESOLVED status) -> no candidate',resolveSheetScaleCandidate({status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:5.12,corroboratedMetersPerNormalizedSheetUnit:null,confidence:.5})===null);

// A conflict must be reviewed, not guessed; nothing to resolve without any value.
ok('MISMATCH -> no candidate',resolveSheetScaleCandidate({status:'MISMATCH',declaredMetersPerNormalizedSheetUnit:2.9,corroboratedMetersPerNormalizedSheetUnit:5.1,confidence:.4})===null);
ok('UNRESOLVED (no values) -> no candidate',resolveSheetScaleCandidate({status:'UNRESOLVED',declaredMetersPerNormalizedSheetUnit:null,corroboratedMetersPerNormalizedSheetUnit:null,confidence:0})===null);
ok('null evidence -> no candidate',resolveSheetScaleCandidate(null)===null);

console.log('\nSheet-scale consolidation contract passed.');
