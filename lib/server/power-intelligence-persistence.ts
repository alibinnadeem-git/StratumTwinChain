import type {PoolClient} from 'pg';
import {z} from 'zod';
import {canonicalHash} from './hash';

const Requirement=z.object({
 id:z.string().min(1).max(300),sourceEntityId:z.string().min(1).max(300),source:z.string().min(1).max(300),
 sourceDiscipline:z.string().min(1).max(120),equipmentClass:z.string().min(1).max(120),tag:z.string().max(200).nullable(),
 voltage:z.number().finite().nullable(),phase:z.number().finite().nullable(),frequencyHz:z.number().finite().nullable(),
 inputKw:z.number().finite().nullable(),inputKva:z.number().finite().nullable(),fla:z.number().finite().nullable(),
 rla:z.number().finite().nullable(),lra:z.number().finite().nullable(),mca:z.number().finite().nullable(),
 mocp:z.number().finite().nullable(),motorHp:z.number().finite().nullable(),electricHeatKw:z.number().finite().nullable(),
 connectedLoadEstimateKva:z.number().finite().nullable(),calculationBasis:z.string().max(300).nullable(),
 authorityClass:z.enum(['SOURCE_EXPLICIT','OEM_OR_PROJECT_METADATA','CLASS_EXPECTATION']),
 confidence:z.number().finite().min(0).max(1),status:z.enum(['EXPECTED','MATCHED','MISSING','CONFLICTED','REVIEWED','DISMISSED']),
 matchedElectricalEntityIds:z.array(z.string().min(1).max(300)).max(500),assumptions:z.array(z.string().max(1000)).max(100)
}).passthrough();

const Finding=z.object({
 id:z.string().min(1).max(300),findingType:z.enum(['MISSING_FEED','RATING_MISMATCH','VOLTAGE_PHASE_MISMATCH','EMERGENCY_POWER_REVIEW','CONTROL_POWER_MISSING','DISCONNECT_REVIEW']),
 expectedPowerRequirementId:z.string().min(1).max(300),sourceEntityId:z.string().min(1).max(300),
 electricalEntityRefs:z.array(z.string().min(1).max(300)).max(500),title:z.string().min(1).max(500),detail:z.string().min(1).max(5000),
 confidence:z.number().finite().min(0).max(1),humanControlLevel:z.enum(['H2','H3'])
}).passthrough();

export const PowerIntelligencePayload=z.object({
 version:z.string().min(1).max(40),requirements:z.array(Requirement).max(10000),findings:z.array(Finding).max(20000),
 summary:z.object({expected:z.number().int().nonnegative(),matched:z.number().int().nonnegative(),missing:z.number().int().nonnegative(),conflicted:z.number().int().nonnegative(),findings:z.number().int().nonnegative()}).passthrough()
}).passthrough();

export type ParsedPowerIntelligence=z.infer<typeof PowerIntelligencePayload>;

export function parsePowerIntelligence(value:unknown,entityIds:Set<string>){
 if(value===undefined||value===null)return null;
 const parsed=PowerIntelligencePayload.parse(value);
 const requirementIds=new Set(parsed.requirements.map(item=>item.id));
 for(const requirement of parsed.requirements){
  if(!entityIds.has(requirement.sourceEntityId))throw new Error('Expected Power source entity is not present in the submitted Spatial graph');
  for(const id of requirement.matchedElectricalEntityIds)if(!entityIds.has(id))throw new Error('Expected Power matched electrical entity is not present in the submitted Spatial graph');
 }
 for(const finding of parsed.findings){
  if(!requirementIds.has(finding.expectedPowerRequirementId))throw new Error('Power finding references an unknown expected-power requirement');
  if(!entityIds.has(finding.sourceEntityId))throw new Error('Power finding source entity is not present in the submitted Spatial graph');
  for(const id of finding.electricalEntityRefs)if(!entityIds.has(id))throw new Error('Power finding electrical reference is not present in the submitted Spatial graph');
 }
 if(parsed.summary.expected!==parsed.requirements.length||parsed.summary.findings!==parsed.findings.length)throw new Error('Expected Power summary counts do not match the submitted payload');
 return parsed;
}

export async function persistPowerIntelligence(client:PoolClient,args:{
 organizationId:string;projectId:string;compilationId:string;userId:string;payload:ParsedPowerIntelligence|null
}){
 if(!args.payload)return{persisted:false,requirements:0,findings:0,snapshotId:null as string|null};
 const existing=await client.query<{id:string}>(
  'SELECT id::text FROM power_intelligence_snapshots WHERE organization_id=$1 AND compilation_id=$2 LIMIT 1',
  [args.organizationId,args.compilationId]
 );
 if(existing.rows[0])return{persisted:false,idempotent:true,requirements:args.payload.requirements.length,findings:args.payload.findings.length,snapshotId:existing.rows[0].id};
 const payloadSha256=canonicalHash({domain:'STRATUM/POWER-INTELLIGENCE/1',projectId:args.projectId,compilationId:args.compilationId,payload:args.payload});
 const snapshot=await client.query<{id:string}>(
  'INSERT INTO power_intelligence_snapshots (organization_id,project_id,compilation_id,version,payload_sha256,requirement_count,finding_count,truth_boundary,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text',
  [args.organizationId,args.projectId,args.compilationId,args.payload.version,payloadSha256,args.payload.requirements.length,args.payload.findings.length,'EXPECTED_POWER_IS_ADVISORY_UNTIL_QUALIFIED_ENGINEERING_REVIEW',args.userId]
 );
 const snapshotId=snapshot.rows[0].id;
 const requirementMap=new Map<string,string>();
 for(const item of args.payload.requirements){
  const electricalData={voltage:item.voltage,phase:item.phase,frequencyHz:item.frequencyHz,inputKw:item.inputKw,inputKva:item.inputKva,fla:item.fla,rla:item.rla,lra:item.lra,mca:item.mca,mocp:item.mocp,motorHp:item.motorHp,electricHeatKw:item.electricHeatKw,connectedLoadEstimateKva:item.connectedLoadEstimateKva,calculationBasis:item.calculationBasis};
  const inserted=await client.query<{id:string}>(
   'INSERT INTO expected_power_requirements (organization_id,snapshot_id,source_entity_id,source_name,source_discipline,equipment_class,asset_tag,status,authority_class,confidence,electrical_data,assumptions,matched_electrical_entity_ids,truth_boundary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14) RETURNING id::text',
   [args.organizationId,snapshotId,item.sourceEntityId,item.source,item.sourceDiscipline,item.equipmentClass,item.tag,item.status,item.authorityClass,item.confidence,JSON.stringify(electricalData),JSON.stringify(item.assumptions),JSON.stringify(item.matchedElectricalEntityIds),'ADVISORY_ENGINEERING_REVIEW_REQUIRED']
  );
  requirementMap.set(item.id,inserted.rows[0].id);
 }
 for(const item of args.payload.findings){
  const requirementId=requirementMap.get(item.expectedPowerRequirementId);if(!requirementId)throw new Error('Power finding requirement could not be persisted');
  await client.query(
   'INSERT INTO power_gap_findings (organization_id,snapshot_id,expected_power_requirement_id,source_finding_id,finding_type,title,detail,electrical_entity_refs,confidence,human_control_level,truth_boundary) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)',
   [args.organizationId,snapshotId,requirementId,item.id,item.findingType,item.title,item.detail,JSON.stringify(item.electricalEntityRefs),item.confidence,item.humanControlLevel,'NOT_CODE_COMPLIANCE_OR_ENGINEERING_APPROVAL']
  );
 }
 return{persisted:true,idempotent:false,requirements:args.payload.requirements.length,findings:args.payload.findings.length,snapshotId};
}
