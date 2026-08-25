import {NextResponse} from 'next/server';
import {query} from '@/lib/server/db';
import {findAsset} from '@/lib/data';

export async function GET(req:Request){
 const q=new URL(req.url).searchParams.get('q')?.trim();
 if(!q)return NextResponse.json({error:'q is required'},{status:400});
 try{
  const r=await query<any>(`SELECT a.id::text,a.asset_code,a.asset_type,a.name,a.serial_number,a.location_label,a.status,p.id::text project_id,p.project_code,p.name project_name,si.name site_name,sy.name system_name FROM assets a JOIN projects p ON p.id=a.project_id JOIN sites si ON si.id=a.site_id LEFT JOIN systems sy ON sy.id=a.system_id WHERE a.id::text=$1 OR a.asset_code=$1 OR a.serial_number=$1 OR a.qr_token::text=$1 LIMIT 1`,[q]);
  if(r.rows[0])return NextResponse.json({source:'live',asset:r.rows[0]});
 }catch{}
 const d=findAsset(q);
 if(d)return NextResponse.json({source:'reference',asset:{id:d.id,asset_code:d.id,asset_type:d.type,name:d.name,serial_number:d.serial,location_label:d.location,status:d.status,project_id:d.project,project_code:d.project,project_name:d.site,site_name:d.site,system_name:d.system}});
 return NextResponse.json({error:'Asset not found'},{status:404});
}
