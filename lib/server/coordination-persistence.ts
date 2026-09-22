import type {PoolClient} from 'pg';
import {z} from 'zod';
import {canonicalHash} from './hash';

const Finding=z.object({
 id:z.string().min(1).max(400),
 findingType:z.enum(['MISSING_SPATIAL_REPRESENTATION','MODEL_CONFLICT','RATING_CONFLICT','LOCATION_CONFLICT','SHEET_REVISION_CONFLICT','SOURCE_REVISION_AMBIGUITY']),
 title:z.string().min(1).max(500),detail:z.string().min(1).max(5000),
 entityRefs:z.array(z.string().min(1).max(400)).max(1000),
 sourceRefs:z.array(z.string().min(1).max(500)).max(1000),
 comparison:z.record(z.string(),z.unknown()),
 confidence:z.number().finite().min(0).max(1),humanControlLevel:z.enum(['H2','H3'])
}).passthrough();

export const CoordinationPayload=z.object({
 version:z.string().min(1).max(40),
 findings:z.array(Finding).max(20000),
 summary:z.object({findings:z.number().int().nonnegative(),high:z.number().int().nonnegative(),review:z.number().int().nonnegative()}).passthrough()
}).passthrough();

export type ParsedCoordination=z.infer<typeof CoordinationPayload>;

export function parseCoordination(value:unknown,entityIds:Set<string>,sourceNames:Set<string>){
 if(value===undefined||value===null)return null;
 const parsed=CoordinationPayload.parse(value);
 if(parsed.summary.findings!==parsed.findings.length)throw new Error('Coordination summary count does not match the submitted findings');
 for(const finding of parsed.findings){
  for(const id of finding.entityRefs)if(!entityIds.has(id))throw new Error('Coordination finding references an entity outside the submitted Spatial graph');
  for(const source of finding.sourceRefs)if(!sourceNames.has(source))throw new Error('Coordination finding references a source outside the submitted Spatial graph');
 }
 return parsed;
}

export async function persistCoordination(client:PoolClient,args:{
 organizationId:string;projectId:string;compilationId:string;userId:string;payload:ParsedCoordination|null
}){
 if(!args.payload)return{persisted:false,findings:0,snapshotId:null as string|null};
 const existing=await client.query<{id:string}>(
  'SELECT id::text FROM coordination_snapshots WHERE organization_id=$1 AND compilation_id=$2 LIMIT 1',
  [args.organizationId,args.compilationId]
 );
 if(existing.rows[0])return{persisted:false,idempotent:true,findings:args.payload.findings.length,snapshotId:existing.rows[0].id};
 const payloadSha256=canonicalHash({domain:'STRATUM/COORDINATION/1',projectId:args.projectId,compilationId:args.compilationId,payload:args.payload});
 const snapshot=await client.query<{id:string}>(
  'INSERT INTO coordination_snapshots (organization_id,project_id,compilation_id,version,payload_sha256,finding_count,truth_boundary,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text',
  [args.organizationId,args.projectId,args.compilationId,args.payload.version,payloadSha256,args.payload.findings.length,'COORDINATION_FINDINGS_DO_NOT_ESTABLISH_PHYSICAL_CLASH_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL',args.userId]
 );
 const snapshotId=snapshot.rows[0].id;
 for(const item of args.payload.findings){
  await client.query(
   'INSERT INTO coordination_findings (organization_id,snapshot_id,source_finding_id,finding_type,title,detail,entity_refs,source_refs,comparison,confidence,human_control_level,truth_boundary) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12)',
   [args.organizationId,snapshotId,item.id,item.findingType,item.title,item.detail,JSON.stringify(item.entityRefs),JSON.stringify(item.sourceRefs),JSON.stringify(item.comparison),item.confidence,item.humanControlLevel,'COORDINATION_FINDING_REQUIRES_HUMAN_REVIEW']
  );
 }
 return{persisted:true,idempotent:false,findings:args.payload.findings.length,snapshotId};
}
