import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';
import {createRelationshipCandidate} from '@/lib/server/relationship-graph';
import {discoverElectricalRelationshipCandidates} from '@/lib/electrical-relationship-resolver';
import type {RegisteredSpatialAsset} from '@/lib/spatial-asset-link';

const Body=z.object({
 projectId:z.string().uuid(),
 compilationId:z.string().uuid().optional(),
});

const Source=z.object({
 name:z.string().min(1),
 sha256:z.string().regex(/^[a-f0-9]{64}$/i).optional(),
 discipline:z.string().optional(),
}).passthrough();

const Entity=z.object({
 id:z.string().min(1),
 source:z.string().min(1),
 layer:z.string().min(1),
 kind:z.string().min(1),
 name:z.string().min(1),
 x:z.number().finite().optional(),
 y:z.number().finite().optional(),
 confidence:z.number().finite().min(0).max(1),
 meta:z.record(z.string(),z.unknown()).optional(),
}).passthrough();

const Link=z.object({
 id:z.string().min(1),
 from:z.string().min(1),
 to:z.string().min(1),
 type:z.string().min(1),
 confidence:z.number().finite().min(0).max(1),
 meta:z.record(z.string(),z.unknown()).optional(),
}).passthrough();

const Graph=z.object({
 sources:z.array(Source).optional(),
 entities:z.array(Entity),
 links:z.array(Link).optional(),
}).passthrough();

function status(error:unknown,fallback=500){
 return typeof error==='object'&&error&&'status' in error?Number((error as {status?:number}).status)||fallback:fallback;
}

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','INSPECTOR']);
  const body=Body.parse(await req.json());

  const compilation=await query<any>(`
   SELECT id::text,project_id::text,revision,graph_sha256,graph_json,created_at
   FROM spatial_compilations
   WHERE organization_id=$1
     AND project_id=$2
     AND ($3::uuid IS NULL OR id=$3::uuid)
   ORDER BY revision DESC
   LIMIT 1
  `,[session.organizationId,body.projectId,body.compilationId||null]);
  if(!compilation.rows[0])return NextResponse.json({error:'Spatial compilation not found in the active organization/project'},{status:404});

  const graph=Graph.parse(compilation.rows[0].graph_json);
  const assetsResult=await query<any>(`
   SELECT
    a.id::text,a.project_id::text,a.asset_code,a.asset_type,a.name,a.model,a.serial_number,a.location_label,a.status,
    s.name system_name,m.name manufacturer_name,
    NULL::text ledger_network,NULL::text ledger_tx_hash,NULL::text ledger_block_height
   FROM assets a
   LEFT JOIN systems s ON s.id=a.system_id AND s.organization_id=a.organization_id
   LEFT JOIN manufacturers m ON m.id=a.manufacturer_id AND m.organization_id=a.organization_id
   WHERE a.organization_id=$1 AND a.project_id=$2
   ORDER BY a.asset_code,a.id
  `,[session.organizationId,body.projectId]);
  const assets=assetsResult.rows as RegisteredSpatialAsset[];
  const discovery=discoverElectricalRelationshipCandidates(graph,assets);

  const persisted=[];
  for(const candidate of discovery.candidates){
   const evidence=candidate.evidence;
   const result=await createRelationshipCandidate(session.organizationId,session.userId,{
    projectId:body.projectId,
    sourceAssetId:candidate.sourceAssetId,
    targetAssetId:candidate.targetAssetId,
    relationshipType:'FEEDS',
    confidence:candidate.confidence,
    discoveryAuthority:'DERIVED_CONNECTIVITY',
    evidence:{
     compilationId:compilation.rows[0].id,
     ...(evidence.sourceSha256?{sourceSha256:evidence.sourceSha256}:{}),
     sourceFileName:evidence.sourceFileName,
     ...(evidence.sheetReference?{sheetReference:evidence.sheetReference}:{}),
     ...(evidence.pageNumber?{pageNumber:evidence.pageNumber}:{}),
     regionGeometry:{
      graphLinkId:evidence.graphLinkId,
      graphLinkInference:evidence.graphLinkInference,
      sourceEntityId:candidate.sourceEntityId,
      targetEntityId:candidate.targetEntityId,
      sourceBinding:candidate.sourceBinding,
      targetBinding:candidate.targetBinding,
     },
     extractionMethod:evidence.extractionMethod,
     confidence:evidence.confidence,
    },
   });
   persisted.push({
    relationshipId:result.relationship.id,
    currentState:result.relationship.current_state,
    sourceAssetId:candidate.sourceAssetId,
    targetAssetId:candidate.targetAssetId,
    confidence:candidate.confidence,
    extractionMethod:evidence.extractionMethod,
    candidateIdempotent:result.idempotent,
    evidenceId:result.evidence?.id||null,
    evidenceIdempotent:Boolean(result.evidence?.idempotent),
   });
  }

  return NextResponse.json({
   projectId:body.projectId,
   compilation:{
    id:compilation.rows[0].id,
    revision:compilation.rows[0].revision,
    graphSha256:compilation.rows[0].graph_sha256,
   },
   inspectedSldLinks:discovery.inspectedSldLinks,
   candidates:persisted,
   unresolved:discovery.unresolved,
   truthBoundary:'SLD_DISCOVERY_CREATES_REVIEW_REQUIRED_RELATIONSHIP_CANDIDATES_ONLY_NO_OPERATIONAL_TRUST_WITHOUT_EVIDENCE_BACKED_HUMAN_VERIFY',
  },{headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  if(error instanceof ZodError)return NextResponse.json({error:'Invalid electrical relationship discovery request or compilation graph',issues:error.issues},{status:400});
  return NextResponse.json({error:error?.message||'Electrical relationship discovery failed'},{status:status(error)});
 }
}
