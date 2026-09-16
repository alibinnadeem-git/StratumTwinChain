import {NextResponse} from 'next/server';
import {z} from 'zod';
import {assets} from '@/lib/data';
import {calculateAssetReadiness,getCommissioningBlockers,projectReadiness,traceAffectedAssets} from '@/lib/twin-intelligence';
import {compareObservedToDesigned,normalizeOEM,realityDiscrepancies,realitySummary,REALITY_TRUTH_BOUNDARY,REALITY_VALIDATION_AUTHORITY} from '@/lib/reality-validation';

const RequestBody=z.object({
 action:z.enum([
  'calculateAssetCompleteness','evaluateCommissioningReadiness','findMissingEvidence','traceAffectedSystems','projectTurnoverReadiness',
  'compareObservedToDesigned','listRealityDiscrepancies','traceRealityImpact','normalizeOEMAsset'
 ]),
 assetId:z.string().max(80).optional(),
 manufacturer:z.string().trim().max(120).optional()
});

export async function POST(request:Request){
 try{
  const body=RequestBody.parse(await request.json());
  const asset=body.assetId?assets.find(item=>item.id===body.assetId):undefined;
  if(body.assetId&&!asset)return NextResponse.json({error:'Asset not found'},{status:404});
  switch(body.action){
   case 'calculateAssetCompleteness':
    return NextResponse.json({action:body.action,result:asset?calculateAssetReadiness(asset):assets.map(calculateAssetReadiness),source:'deterministic-rules-v1'});
   case 'evaluateCommissioningReadiness':
    return NextResponse.json({action:body.action,result:getCommissioningBlockers(body.assetId),source:'deterministic-rules-v1'});
   case 'findMissingEvidence':{
    const result=(asset?[calculateAssetReadiness(asset)]:assets.map(calculateAssetReadiness)).map(readiness=>({assetId:readiness.assetId,missing:readiness.items.filter(item=>!item.complete&&['installationEvidence','testEvidence'].includes(item.key)).map(item=>item.label)}));
    return NextResponse.json({action:body.action,result,source:'deterministic-rules-v1'});
   }
   case 'traceAffectedSystems':
    return NextResponse.json({action:body.action,result:asset?traceAffectedAssets(asset.id):[],source:'electrical-graph-v1'});
   case 'projectTurnoverReadiness':
    return NextResponse.json({action:body.action,result:projectReadiness(),source:'deterministic-rules-v1'});
   case 'compareObservedToDesigned':
    if(!asset)return NextResponse.json({error:'assetId is required'},{status:400});
    return NextResponse.json({action:body.action,result:compareObservedToDesigned(asset.id),truthBoundary:REALITY_TRUTH_BOUNDARY,authority:REALITY_VALIDATION_AUTHORITY,source:'reality-reference-rules-v1'});
   case 'listRealityDiscrepancies':
    return NextResponse.json({action:body.action,result:realityDiscrepancies,summary:realitySummary(),truthBoundary:REALITY_TRUTH_BOUNDARY,authority:REALITY_VALIDATION_AUTHORITY,source:'reality-reference-rules-v1'});
   case 'traceRealityImpact':
    if(!asset)return NextResponse.json({error:'assetId is required'},{status:400});
    return NextResponse.json({action:body.action,result:{discrepancies:compareObservedToDesigned(asset.id),affectedAssets:traceAffectedAssets(asset.id)},truthBoundary:REALITY_TRUTH_BOUNDARY,authority:REALITY_VALIDATION_AUTHORITY,source:'reality-electrical-graph-v1'});
   case 'normalizeOEMAsset':
    if(!body.manufacturer)return NextResponse.json({error:'manufacturer is required'},{status:400});
    return NextResponse.json({action:body.action,result:normalizeOEM(body.manufacturer),authority:REALITY_VALIDATION_AUTHORITY,source:'oem-normalization-v1'});
  }
 }catch(error){
  if(error instanceof z.ZodError)return NextResponse.json({error:'Invalid controlled agent request',issues:error.issues},{status:400});
  return NextResponse.json({error:'Infrastructure Agent evaluation failed'},{status:500});
 }
}
