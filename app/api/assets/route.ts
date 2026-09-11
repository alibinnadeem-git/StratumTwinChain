import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {query} from '@/lib/server/db';
import {projectCanonicalAsset,type LegacyAssetRow} from '@/lib/redbook/adapters/asset';
import {STRATUM_SCHEMA_VERSION} from '@/lib/redbook/schema/common';

const Asset=z.object({
 projectId:z.string().uuid(),siteId:z.string().uuid(),systemId:z.string().uuid().nullable().optional(),manufacturerId:z.string().uuid().nullable().optional(),
 assetCode:z.string().min(2).max(80),assetType:z.string().min(2).max(80),name:z.string().min(2).max(160),model:z.string().max(120).optional(),
 serialNumber:z.string().max(120).optional(),locationLabel:z.string().max(160).optional(),specifications:z.record(z.string(),z.unknown()).default({}),
});

export async function GET(){
 try{
  const s=await requireSession();
  const r=await query<any>(`SELECT a.*,p.name project_name,si.name site_name,m.name manufacturer_name FROM assets a JOIN projects p ON p.id=a.project_id JOIN sites si ON si.id=a.site_id LEFT JOIN manufacturers m ON m.id=a.manufacturer_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 500`,[s.organizationId]);
  const items=r.rows.map(row=>({...row,canonical:projectCanonicalAsset(row as LegacyAssetRow)}));
  return NextResponse.json({items,schemaVersion:STRATUM_SCHEMA_VERSION});
 }catch(e:any){
  return NextResponse.json({error:e.message},{status:e.status||500});
 }
}

export async function POST(req:Request){
 try{
  const s=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER']);
  const b=Asset.parse(await req.json());
  const context=await query<{project_id:string;site_id:string}>(
   `SELECT p.id project_id,si.id site_id FROM projects p JOIN sites si ON si.id=$2 AND si.project_id=p.id AND si.organization_id=$3 WHERE p.id=$1 AND p.organization_id=$3 LIMIT 1`,
   [b.projectId,b.siteId,s.organizationId],
  );
  if(!context.rows[0])return NextResponse.json({error:'Project/site hierarchy not found in active organization'},{status:404});
  const r=await query<any>(`INSERT INTO assets(organization_id,project_id,site_id,system_id,manufacturer_id,asset_code,asset_type,name,model,serial_number,location_label,specifications) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[s.organizationId,b.projectId,b.siteId,b.systemId||null,b.manufacturerId||null,b.assetCode,b.assetType,b.name,b.model||null,b.serialNumber||null,b.locationLabel||null,JSON.stringify(b.specifications)]);
  const row=r.rows[0];
  const canonical=projectCanonicalAsset(row as LegacyAssetRow,{createdBy:s.userId});
  return NextResponse.json({...row,canonical,schemaVersion:STRATUM_SCHEMA_VERSION},{status:201});
 }catch(e:any){
  return NextResponse.json({error:e.message},{status:e.status||400});
 }
}
