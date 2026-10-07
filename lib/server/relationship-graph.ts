import {createHash} from 'node:crypto';
import {z} from 'zod';
import {query,tx} from '@/lib/server/db';

const relationshipCode=z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,63}$/);
const sha256=z.string().trim().regex(/^[a-f0-9]{64}$/);

export const RelationshipEvidenceInput=z.object({
 sourceId:z.string().uuid().optional(),
 compilationId:z.string().uuid().optional(),
 evidenceId:z.string().uuid().optional(),
 sourceSha256:sha256.optional(),
 sourceFileName:z.string().trim().min(1).max(500).optional(),
 sheetReference:z.string().trim().min(1).max(120).optional(),
 pageNumber:z.number().int().positive().optional(),
 regionGeometry:z.record(z.unknown()).optional(),
 extractionMethod:z.string().trim().min(2).max(120),
 confidence:z.number().min(0).max(1),
}).refine(value=>Boolean(value.sourceId||value.compilationId||value.evidenceId||value.sourceSha256),{
 message:'Relationship evidence requires durable provenance (source, compilation, evidence record, or source SHA-256).',
});

export const CreateRelationshipInput=z.object({
 projectId:z.string().uuid(),
 sourceAssetId:z.string().uuid(),
 targetAssetId:z.string().uuid(),
 relationshipType:relationshipCode,
 confidence:z.number().min(0).max(1),
 discoveryAuthority:z.enum(['SOURCE_DOCUMENT','SCHEDULE','DERIVED_CONNECTIVITY','HUMAN_REVIEW','IMPORT']),
 evidence:RelationshipEvidenceInput.optional(),
});

export const ReviewRelationshipInput=z.object({
 action:z.enum(['VERIFY','REJECT','DEPRECATE','MAINTAIN','REOPEN_REVIEW']),
 reason:z.string().trim().min(5).max(1000),
});

export type RelationshipTrustState='REVIEW_REQUIRED'|'VERIFIED'|'MAINTAINED'|'REJECTED'|'DEPRECATED';

function canonical(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 const record=value as Record<string,unknown>;
 return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonical(record[key])).join(',')+'}';
}

function digest(value:unknown){
 return createHash('sha256').update(canonical(value)).digest('hex');
}

function stateFromAction(action:string|null|undefined):RelationshipTrustState{
 switch(action){
  case 'VERIFY': return 'VERIFIED';
  case 'MAINTAIN': return 'MAINTAINED';
  case 'REJECT': return 'REJECTED';
  case 'DEPRECATE': return 'DEPRECATED';
  default: return 'REVIEW_REQUIRED';
 }
}

function httpError(message:string,status:number){
 return Object.assign(new Error(message),{status});
}

async function insertEvidence(
 client:import('pg').PoolClient,
 organizationId:string,
 projectId:string,
 relationshipId:string,
 actorUserId:string,
 input:z.infer<typeof RelationshipEvidenceInput>,
){
 const evidenceSha256=digest({
  organizationId,projectId,relationshipId,
  sourceId:input.sourceId||null,
  compilationId:input.compilationId||null,
  evidenceId:input.evidenceId||null,
  sourceSha256:input.sourceSha256||null,
  sourceFileName:input.sourceFileName||null,
  sheetReference:input.sheetReference||null,
  pageNumber:input.pageNumber||null,
  regionGeometry:input.regionGeometry||null,
  extractionMethod:input.extractionMethod,
  confidence:input.confidence,
 });
 const inserted=await client.query<any>(`
  INSERT INTO relationship_evidence(
   organization_id,project_id,relationship_id,source_id,compilation_id,evidence_id,
   source_sha256,source_file_name,sheet_reference,page_number,region_geometry,
   extraction_method,confidence,evidence_sha256,captured_by
  )
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
  ON CONFLICT(organization_id,evidence_sha256) DO NOTHING
  RETURNING *
 `,[
  organizationId,projectId,relationshipId,input.sourceId||null,input.compilationId||null,input.evidenceId||null,
  input.sourceSha256||null,input.sourceFileName||null,input.sheetReference||null,input.pageNumber||null,
  input.regionGeometry?JSON.stringify(input.regionGeometry):null,input.extractionMethod,input.confidence,evidenceSha256,actorUserId,
 ]);
 if(inserted.rows[0])return {...inserted.rows[0],idempotent:false};
 const existing=await client.query<any>(`
  SELECT * FROM relationship_evidence
  WHERE organization_id=$1 AND evidence_sha256=$2 LIMIT 1
 `,[organizationId,evidenceSha256]);
 return {...existing.rows[0],idempotent:true};
}

export async function createRelationshipCandidate(
 organizationId:string,
 actorUserId:string,
 raw:z.input<typeof CreateRelationshipInput>,
){
 const input=CreateRelationshipInput.parse(raw);
 if(input.sourceAssetId===input.targetAssetId)throw httpError('A relationship requires two distinct assets',400);

 return tx(async client=>{
  const type=await client.query<{code:string}>(`
   SELECT code FROM relationship_types WHERE code=$1 LIMIT 1
  `,[input.relationshipType]);
  if(!type.rows[0])throw httpError('Unsupported relationship type',400);

  const assets=await client.query<{id:string}>(`
   SELECT id::text FROM assets
   WHERE organization_id=$1 AND project_id=$2 AND id = ANY($3::uuid[])
  `,[organizationId,input.projectId,[input.sourceAssetId,input.targetAssetId]]);
  if(assets.rows.length!==2)throw httpError('Both assets must exist in the active organization and project',404);

  const candidateSha256=digest({
   organizationId,
   projectId:input.projectId,
   sourceAssetId:input.sourceAssetId,
   targetAssetId:input.targetAssetId,
   relationshipType:input.relationshipType,
  });

  const inserted=await client.query<any>(`
   INSERT INTO asset_relationships(
    organization_id,project_id,source_asset_id,target_asset_id,relationship_type,
    confidence,discovery_authority,candidate_sha256,created_by
   )
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
   ON CONFLICT(organization_id,candidate_sha256) DO NOTHING
   RETURNING *
  `,[
   organizationId,input.projectId,input.sourceAssetId,input.targetAssetId,input.relationshipType,
   input.confidence,input.discoveryAuthority,candidateSha256,actorUserId,
  ]);

  let relationship=inserted.rows[0];
  let idempotent=false;
  if(!relationship){
   const existing=await client.query<any>(`
    SELECT * FROM asset_relationships
    WHERE organization_id=$1 AND candidate_sha256=$2 LIMIT 1
   `,[organizationId,candidateSha256]);
   relationship=existing.rows[0];
   idempotent=true;
  }

  const evidence=input.evidence
   ?await insertEvidence(client,organizationId,input.projectId,relationship.id,actorUserId,input.evidence)
   :null;

  const latest=await client.query<{action:string}>(`
   SELECT action FROM relationship_review_events
   WHERE organization_id=$1 AND relationship_id=$2
   ORDER BY occurred_at DESC,id DESC LIMIT 1
  `,[organizationId,relationship.id]);

  return{
   relationship:{...relationship,current_state:stateFromAction(latest.rows[0]?.action)},
   evidence,
   idempotent,
   truthBoundary:'RELATIONSHIP_CANDIDATE_NOT_OPERATIONAL_TRUTH_UNTIL_EVIDENCE_BACKED_HUMAN_VERIFIED',
  };
 });
}

export async function appendRelationshipEvidence(
 organizationId:string,
 actorUserId:string,
 relationshipId:string,
 raw:z.input<typeof RelationshipEvidenceInput>,
){
 const input=RelationshipEvidenceInput.parse(raw);
 return tx(async client=>{
  const relationship=await client.query<{id:string;project_id:string}>(`
   SELECT id::text,project_id::text
   FROM asset_relationships
   WHERE organization_id=$1 AND id=$2
   LIMIT 1
   FOR SHARE
  `,[organizationId,relationshipId]);
  if(!relationship.rows[0])throw httpError('Relationship not found',404);
  const evidence=await insertEvidence(
   client,organizationId,relationship.rows[0].project_id,relationshipId,actorUserId,input
  );
  return{
   evidence,
   truthBoundary:'RELATIONSHIP_EVIDENCE_SUPPORTS_REVIEW_NOT_PHYSICAL_TRUTH_DIR_OR_POVI_FINALITY',
  };
 });
}

export async function reviewRelationship(
 organizationId:string,
 actorUserId:string,
 relationshipId:string,
 raw:z.input<typeof ReviewRelationshipInput>,
){
 const input=ReviewRelationshipInput.parse(raw);
 return tx(async client=>{
  const relationship=await client.query<any>(`
   SELECT * FROM asset_relationships
   WHERE organization_id=$1 AND id=$2
   LIMIT 1
   FOR SHARE
  `,[organizationId,relationshipId]);
  if(!relationship.rows[0])throw httpError('Relationship not found',404);
  const row=relationship.rows[0];

  const latest=await client.query<any>(`
   SELECT * FROM relationship_review_events
   WHERE organization_id=$1 AND relationship_id=$2
   ORDER BY occurred_at DESC,id DESC LIMIT 1
  `,[organizationId,relationshipId]);
  const previous=latest.rows[0]||null;
  if(previous&&previous.action===input.action&&previous.reason===input.reason&&previous.actor_user_id===actorUserId){
   return{review:previous,currentState:stateFromAction(previous.action),idempotent:true};
  }

  if(input.action==='VERIFY'||input.action==='MAINTAIN'){
   const evidence=await client.query<{count:string}>(`
    SELECT count(*)::text count FROM relationship_evidence
    WHERE organization_id=$1 AND project_id=$2 AND relationship_id=$3
   `,[organizationId,row.project_id,relationshipId]);
   if(Number(evidence.rows[0]?.count||0)<1)throw httpError('Evidence is required before a relationship may become trusted',409);
  }

  const reviewSha256=digest({
   organizationId,projectId:row.project_id,relationshipId,inputAction:input.action,
   reason:input.reason,actorUserId,previousReviewId:previous?.id||null,
  });
  const inserted=await client.query<any>(`
   INSERT INTO relationship_review_events(
    organization_id,project_id,relationship_id,action,reason,actor_user_id,previous_review_id,review_sha256
   )
   VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(organization_id,review_sha256) DO NOTHING
   RETURNING *
  `,[organizationId,row.project_id,relationshipId,input.action,input.reason,actorUserId,previous?.id||null,reviewSha256]);

  const review=inserted.rows[0]||(
   await client.query<any>(`
    SELECT * FROM relationship_review_events
    WHERE organization_id=$1 AND review_sha256=$2 LIMIT 1
   `,[organizationId,reviewSha256])
  ).rows[0];

  return{
   review,
   currentState:stateFromAction(review.action),
   idempotent:!inserted.rows[0],
   truthBoundary:'HUMAN_RELATIONSHIP_REVIEW_DOES_NOT_ESTABLISH_PHYSICAL_CONDITION_DIR_OR_POVI_FINALITY',
  };
 });
}

export async function listAssetRelationships(organizationId:string,assetId:string){
 const asset=await query<{id:string;project_id:string}>(`
  SELECT id::text,project_id::text FROM assets
  WHERE organization_id=$1 AND id=$2 LIMIT 1
 `,[organizationId,assetId]);
 if(!asset.rows[0])throw httpError('Asset not found',404);

 const result=await query<any>(`
  SELECT r.id::text,r.project_id::text,r.source_asset_id::text,r.target_asset_id::text,
         r.relationship_type,r.confidence,r.discovery_authority,r.created_at,
         rt.category,rt.impact_direction,rt.propagation_weight,
         sa.asset_code source_asset_code,sa.name source_asset_name,
         ta.asset_code target_asset_code,ta.name target_asset_name,
         latest.action latest_review_action,latest.reason latest_review_reason,latest.occurred_at latest_review_at,
         (SELECT count(*)::int FROM relationship_evidence re
          WHERE re.organization_id=r.organization_id AND re.relationship_id=r.id) evidence_count
  FROM asset_relationships r
  JOIN relationship_types rt ON rt.code=r.relationship_type
  JOIN assets sa ON sa.id=r.source_asset_id AND sa.organization_id=r.organization_id
  JOIN assets ta ON ta.id=r.target_asset_id AND ta.organization_id=r.organization_id
  LEFT JOIN LATERAL (
    SELECT action,reason,occurred_at
    FROM relationship_review_events rr
    WHERE rr.organization_id=r.organization_id AND rr.relationship_id=r.id
    ORDER BY occurred_at DESC,id DESC
    LIMIT 1
  ) latest ON true
  WHERE r.organization_id=$1
    AND (r.source_asset_id=$2 OR r.target_asset_id=$2)
  ORDER BY r.created_at DESC,r.id DESC
 `,[organizationId,assetId]);

 return result.rows.map(row=>({
  ...row,
  current_state:stateFromAction(row.latest_review_action),
  trusted:row.latest_review_action==='VERIFY'||row.latest_review_action==='MAINTAIN',
 }));
}

export async function traceTrustedRelationships(
 organizationId:string,
 assetId:string,
 depthLimit=8,
){
 const depth=Math.max(1,Math.min(20,Math.trunc(depthLimit)));
 const asset=await query<{project_id:string}>(`
  SELECT project_id::text FROM assets WHERE organization_id=$1 AND id=$2 LIMIT 1
 `,[organizationId,assetId]);
 if(!asset.rows[0])throw httpError('Asset not found',404);

 const result=await query<any>(`
  WITH RECURSIVE trusted_edges AS (
   SELECT r.id,r.source_asset_id,r.target_asset_id,r.relationship_type,
          rt.impact_direction,rt.propagation_weight
   FROM asset_relationships r
   JOIN relationship_types rt ON rt.code=r.relationship_type
   JOIN LATERAL (
    SELECT action
    FROM relationship_review_events rr
    WHERE rr.organization_id=r.organization_id AND rr.relationship_id=r.id
    ORDER BY occurred_at DESC,id DESC
    LIMIT 1
   ) latest ON true
   WHERE r.organization_id=$1
     AND r.project_id=$2
     AND latest.action IN ('VERIFY','MAINTAIN')
     AND rt.impact_direction <> 'NONE'
  ),
  walk(asset_id,depth,path,relationship_path) AS (
   SELECT $3::uuid,0,ARRAY[$3::uuid],ARRAY[]::uuid[]
   UNION ALL
   SELECT
    CASE WHEN e.impact_direction='FORWARD' THEN e.target_asset_id ELSE e.source_asset_id END,
    w.depth+1,
    w.path || CASE WHEN e.impact_direction='FORWARD' THEN e.target_asset_id ELSE e.source_asset_id END,
    w.relationship_path || e.id
   FROM walk w
   JOIN trusted_edges e ON
    (e.impact_direction='FORWARD' AND e.source_asset_id=w.asset_id)
    OR
    (e.impact_direction='REVERSE' AND e.target_asset_id=w.asset_id)
   WHERE w.depth<$4
     AND NOT (
      CASE WHEN e.impact_direction='FORWARD' THEN e.target_asset_id ELSE e.source_asset_id END
      = ANY(w.path)
     )
  )
  SELECT DISTINCT ON (w.asset_id)
   w.asset_id::text,w.depth,w.path::text[],w.relationship_path::text[],
   a.asset_code,a.name,a.asset_type
  FROM walk w
  JOIN assets a ON a.id=w.asset_id AND a.organization_id=$1
  WHERE w.depth>0
  ORDER BY w.asset_id,w.depth ASC
 `,[organizationId,asset.rows[0].project_id,assetId,depth]);

 return{
  rootAssetId:assetId,
  projectId:asset.rows[0].project_id,
  maxDepth:depth,
  affected:result.rows,
  trustedOnly:true,
  truthBoundary:'TRUSTED_RELATIONSHIP_TRAVERSAL_IS_DEPENDENCY_EVIDENCE_NOT_A_FAILURE_PREDICTION_OR_POVI_FINALITY',
 };
}
