export const STRATUM_PRODUCT = 'STRATUM Spatial Verified' as const;
export const STRATUM_CHAIN = 'STRATUM Chain' as const;
export const STRATUM_CONSENSUS = 'Proof of Verified Infrastructure (PoVI)' as const;
export const STRATUM_AI = 'JARVIS — STRATUM Chief AI Orchestrator' as const;

export const canonicalRecordNames = {
  nano: 'Nano DIR',
  micro: 'Micro DIR',
  dir: 'Digital Immutable Record',
  genesis: 'Genesis DIR',
} as const;

export const trustStates = [
  'POVI_VERIFIED',
  'FIELD_VERIFIED',
  'SURVEYED',
  'SCANNED',
  'OEM_VERIFIED',
  'SOURCE_VERIFIED',
  'LIVE',
  'STALE',
  'UNCERTAIN',
  'CONFLICTED',
  'INFERRED',
  'PREDICTED',
  'AI_GENERATED',
  'UNVERIFIED',
] as const;

export type TrustState = (typeof trustStates)[number];

export const finalityStates = [
  'ONLINE',
  'OFFLINE',
  'SYNCING',
  'CONFLICT',
  'PENDING_FINALITY',
  'FINALIZED',
] as const;

export type FinalityState = (typeof finalityStates)[number];

export const implementationStates = [
  'IMPLEMENTED',
  'PARTIAL',
  'PLANNED',
  'CONCEPTUALLY_LOCKED',
] as const;

export type ImplementationState = (typeof implementationStates)[number];

export const spatialNavigation = [
  'Site',
  'Building',
  'Floor',
  'Room / Zone',
  'System',
  'Asset',
  'Evidence',
  'Work',
  'History',
] as const;

export const userFacingRules = {
  product: 'STRATUM Spatial Verified',
  modelNoun: 'Spatial model',
  deprecatedProductTerms: ['STRATUM Twin', 'STRATUM Verified Twin', 'digital twin'],
  recordNoun: 'DIR',
  deprecatedRecordTerms: ['block', 'genesis block'],
} as const;
