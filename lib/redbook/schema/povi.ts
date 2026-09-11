import {z} from 'zod';
import {canonicalEnvelopeShape} from './envelope';
import {
 POVI_PROTOCOL_VERSION,
 canonicalHashSchema,
 canonicalIdSchema,
 canonicalRefSchema,
 schemaVersionSchema,
 signatureSchema,
 signerProofSchema,
 utcIsoTimestampSchema,
} from './common';

export const dirCandidateHeaderSchema=z.object({
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 previousDIRHash:canonicalHashSchema,
 orderedMicroDIRRoot:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema.default(POVI_PROTOCOL_VERSION),
 proposerId:canonicalIdSchema,
 entropyVRFEvidence:z.record(z.string(),z.unknown()),
}).strict();

export const proposalSchema=z.object({
 domain:z.string().min(1),
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 proposalHash:canonicalHashSchema,
 DIRCandidateHeader:dirCandidateHeaderSchema,
 proposerId:canonicalIdSchema,
 VRFProof:z.string().min(1),
 signature:signatureSchema,
}).strict();

export const verifySchema=z.object({
 domain:z.string().min(1),
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 step:z.literal('VERIFY'),
 proposalHash:z.union([canonicalHashSchema,z.literal('NIL')]),
 validatorId:canonicalIdSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 signature:signatureSchema,
}).strict();

export const poviLockCertificateSchema=z.object({
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 proposalHash:canonicalHashSchema,
 signerProof:signerProofSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
}).strict();

export const commitSchema=z.object({
 domain:z.string().min(1),
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 step:z.literal('COMMIT'),
 proposalHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorId:canonicalIdSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 signature:signatureSchema,
}).strict();

export const poviFinalityCertificateSchema=z.object({
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 DIRHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 signerProof:signerProofSchema,
}).strict();

export const digitalImmutableRecordSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('DIR'),
 chainId:canonicalIdSchema,
 height:z.number().int().positive(),
 round:z.number().int().nonnegative(),
 previousDIRHash:canonicalHashSchema,
 orderedMicroDIRRoot:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 proposerId:canonicalIdSchema,
 entropyVRFEvidence:z.record(z.string(),z.unknown()),
 finalizedAt:utcIsoTimestampSchema,
 PFC:poviFinalityCertificateSchema,
 DIRHash:canonicalHashSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.DIRHash){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal DIRHash'});
 }
 if(value.PFC.DIRHash!==value.DIRHash){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['PFC','DIRHash'],message:'PFC must bind this DIRHash'});
 }
 if(value.PFC.stateRoot!==value.stateRoot||value.PFC.validatorSetRoot!==value.validatorSetRoot){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['PFC'],message:'PFC roots must bind the finalized DIR roots'});
 }
 if(value.status!=='FINALIZED'){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['status'],message:'A DIR object is only canonical after PoVI finality'});
 }
});

export const roundChangeSchema=z.object({
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 newRound:z.number().int().positive(),
 validatorId:canonicalIdSchema,
 lockedDIR:canonicalHashSchema.nullable(),
 lockedRound:z.number().int().nonnegative().nullable(),
 validDIR:canonicalHashSchema.nullable(),
 validRound:z.number().int().nonnegative().nullable(),
 evidenceRefs:z.array(canonicalRefSchema).default([]),
 signature:signatureSchema,
}).strict();

export const equivocationEvidenceSchema=z.object({
 validatorId:canonicalIdSchema,
 chainId:canonicalIdSchema,
 height:z.number().int().nonnegative(),
 round:z.number().int().nonnegative(),
 step:z.enum(['PROPOSAL','VERIFY','COMMIT','ROUND_CHANGE']),
 messageA:z.record(z.string(),z.unknown()),
 signatureA:signatureSchema,
 messageB:z.record(z.string(),z.unknown()),
 signatureB:signatureSchema,
 detectedAt:utcIsoTimestampSchema,
}).strict();

export const validatorIdentitySchema=z.object({
 validatorId:canonicalIdSchema,
 friendlyLabel:z.string().trim().min(1).max(128),
 consensusPublicKey:z.string().min(1),
 consensusKeyVersion:schemaVersionSchema,
 vrfPublicKey:z.string().min(1),
 vrfKeyVersion:schemaVersionSchema,
 transportPublicKey:z.string().min(1),
 transportKeyVersion:schemaVersionSchema,
 operatorOrg:canonicalIdSchema,
 state:z.enum(['CANDIDATE','ACTIVE','DEGRADED','QUARANTINED','RETIRED','REVOKED']),
 activationHeight:z.number().int().nonnegative().nullable(),
 retirementHeight:z.number().int().nonnegative().nullable(),
 assurance:z.string().min(1),
}).strict();

export const enrollmentSchema=z.object({
 enrollmentId:canonicalIdSchema,
 enrollmentCodeHash:canonicalHashSchema,
 candidateValidatorId:canonicalIdSchema,
 publicKeys:z.record(z.string(),z.string()),
 packageBuildAttestation:z.record(z.string(),z.unknown()),
 network:canonicalIdSchema,
 issuedBy:canonicalIdSchema,
 issuedAt:utcIsoTimestampSchema,
 expiresAt:utcIsoTimestampSchema,
 consumedAt:utcIsoTimestampSchema.nullable(),
}).strict();

export const genesisDIRSchema=z.object({
 ...canonicalEnvelopeShape,
 objectType:z.literal('GenesisDIR'),
 chainId:canonicalIdSchema,
 networkName:z.string().min(1),
 environment:z.string().min(1),
 genesisTime:utcIsoTimestampSchema,
 protocolVersion:schemaVersionSchema,
 initialValidatorSet:z.array(validatorIdentitySchema).min(1),
 trustRoots:z.array(canonicalRefSchema).min(1),
 governanceAuthorities:z.array(canonicalRefSchema).min(1),
 moduleRegistry:z.record(z.string(),z.unknown()),
 resourcePolicy:z.record(z.string(),z.unknown()),
 schemaRegistry:z.array(schemaVersionSchema).min(1),
 genesisStateRoot:canonicalHashSchema,
 GenesisDIRHash:canonicalHashSchema,
}).strict().superRefine((value,ctx)=>{
 if(value.objectId!==value.GenesisDIRHash){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['objectId'],message:'objectId must equal GenesisDIRHash'});
 }
 if(value.status!=='FINALIZED'){
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['status'],message:'Genesis DIR must be finalized'});
 }
});

export const snapshotCertificateSchema=z.object({
 snapshotHeight:z.number().int().nonnegative(),
 DIRHash:canonicalHashSchema,
 stateRoot:canonicalHashSchema,
 validatorSetRoot:canonicalHashSchema,
 protocolVersion:schemaVersionSchema,
 stateManifestRoot:canonicalHashSchema,
 SpatialManifestRoot:canonicalHashSchema,
 evidenceManifestRoot:canonicalHashSchema,
 signerProof:signerProofSchema,
}).strict();

export const dirProofPackageSchema=z.object({
 manifestVersion:schemaVersionSchema,
 chainId:canonicalIdSchema,
 targetRefs:z.array(canonicalRefSchema).min(1),
 canonicalObjectHash:canonicalHashSchema,
 merklePath:z.array(canonicalHashSchema),
 containingDIR:digitalImmutableRecordSchema,
 PFC:poviFinalityCertificateSchema,
 validatorKeyHistoryRefs:z.array(canonicalRefSchema).default([]),
 schemaVersions:z.array(schemaVersionSchema).min(1),
 protocolVersions:z.array(schemaVersionSchema).min(1),
 artifactHashes:z.array(canonicalHashSchema).default([]),
 verifierHints:z.record(z.string(),z.unknown()).default({}),
}).strict();

export type DigitalImmutableRecord=z.infer<typeof digitalImmutableRecordSchema>;
export type Proposal=z.infer<typeof proposalSchema>;
export type VerifyVote=z.infer<typeof verifySchema>;
export type PoVILockCertificate=z.infer<typeof poviLockCertificateSchema>;
export type CommitVote=z.infer<typeof commitSchema>;
export type PoVIFinalityCertificate=z.infer<typeof poviFinalityCertificateSchema>;
export type ValidatorIdentity=z.infer<typeof validatorIdentitySchema>;
export type GenesisDIR=z.infer<typeof genesisDIRSchema>;
