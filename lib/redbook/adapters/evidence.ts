import {evidenceSchema,type CanonicalEvidence} from '../schema/domain';
import {STRATUM_SCHEMA_VERSION} from '../schema/common';

export function createCanonicalEvidence(args:{
 evidenceId:string;
 tenantId:string;
 organizationId:string;
 projectId:string;
 assetId:string;
 lifecycleEventId:string;
 evidenceType:string;
 contentHash:string;
 fileName?:string|null;
 mimeType?:string|null;
 storageRef?:string|null;
 capturedBy:string;
 capturedAt:string;
 sourceType?:string;
 retentionClass?:'R0'|'R1'|'R2'|'R3'|'R4';
}):CanonicalEvidence{
 return evidenceSchema.parse({
  objectId:args.evidenceId,
  objectType:'Evidence',
  schemaVersion:STRATUM_SCHEMA_VERSION,
  tenantId:args.tenantId,
  organizationId:args.organizationId,
  projectId:args.projectId,
  createdAt:args.capturedAt,
  createdBy:args.capturedBy,
  updatedAt:args.capturedAt,
  status:'RECEIVED',
  trustClass:'UNVERIFIED',
  sourceRefs:[args.assetId,args.lifecycleEventId],
  DIRRefs:[],
  evidenceId:args.evidenceId,
  evidenceType:args.evidenceType,
  contentHash:args.contentHash.toLowerCase(),
  artifact:{
   artifactRef:args.evidenceId,
   fileName:args.fileName||null,
   mimeType:args.mimeType||null,
   storageRef:args.storageRef||null,
  },
  source:{sourceRef:args.capturedBy,sourceType:args.sourceType||'HUMAN_FIELD_UPLOAD'},
  capture:{capturedAt:args.capturedAt,capturedBy:args.capturedBy,originalTimezoneOffset:null},
  retention:{retentionClass:args.retentionClass||'R3',policyRef:null},
  relationships:[],
  signatures:[],
 });
}
