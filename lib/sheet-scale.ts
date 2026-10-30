import type {IndependentScaleValidation} from './scale-validation.ts';

// Phase 3/3b consolidation: pick ONE reviewable per-sheet metric-scale SIZING candidate from the
// independent scale-validation evidence. Only independent-witness corroboration qualifies. A declared
// (title-block) scale alone does NOT: it is read from text and must be checked against the drawing, so
// declared-only is kept as context in the audit but is never offered as a sizing candidate. (Phase 3b's
// "declared is 6.2x off" was itself a witness bug, fixed in scale-validation.ts; the policy stands.) A
// MISMATCH also yields no candidate. Never auto-applied; metric placement needs a human-confirmed frame.

export type SheetScaleCandidate={
  metersPerNormalizedSheetUnit:number;
  status:'CORROBORATED'|'REVIEW';
  authority:'INDEPENDENT_WITNESS_CORROBORATED';
  confidence:number;
  reviewRequired:true;
  autoApply:false;
  geometryScaleAuthority:false;
};

type ScaleEvidence=Pick<IndependentScaleValidation,'status'|'declaredMetersPerNormalizedSheetUnit'|'corroboratedMetersPerNormalizedSheetUnit'|'confidence'>;

const num=(value:unknown):number|null=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:null};
const clamp=(value:unknown)=>Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):0));

export function resolveSheetScaleCandidate(evidence:ScaleEvidence|null|undefined):SheetScaleCandidate|null{
  if(!evidence||typeof evidence!=='object')return null;
  // A conflict between declared scale and independent witnesses must be reviewed, not guessed.
  if(evidence.status==='MISMATCH')return null;
  const corroborated=num(evidence.corroboratedMetersPerNormalizedSheetUnit);
  if(corroborated!==null)return{
    metersPerNormalizedSheetUnit:corroborated,
    status:evidence.status==='CORROBORATED'?'CORROBORATED':'REVIEW',
    authority:'INDEPENDENT_WITNESS_CORROBORATED',
    confidence:clamp(evidence.confidence),
    reviewRequired:true,autoApply:false,geometryScaleAuthority:false,
  };
  // Declared-only (title-block) scale is NOT a sizing candidate: nothing on the sheet has checked it. The
  // declared value is still surfaced in the audit as context; sizing needs witnesses or calibration.
  return null;
}
