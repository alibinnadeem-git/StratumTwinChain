import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';

export const dynamic='force-dynamic';

const allowed=new Set([
  '/models/equipment/pad-mount-transformer.glb',
  '/models/equipment/dry-type-transformer.glb',
  '/models/equipment/oil-filled-transformer.glb',
  '/models/equipment/main-switchboard.glb',
  '/models/equipment/motor-control-center.glb',
  '/models/equipment/industrial-electric-motor.glb',
  '/models/equipment/end-suction-pump.glb',
  '/models/equipment/enclosed-diesel-generator.glb',
  '/models/equipment/automatic-transfer-switch.glb',
  '/models/equipment/uninterruptible-power-supply.glb',
  '/models/equipment/battery-cabinet.glb',
  '/models/oem/kempower-satellite-v2.glb',
  '/models/oem/alpitronic-hyc400-s2.glb',
  '/models/oem/delta-dc-wallbox-50kw.glb',
  '/models/oem/abb-terra-360.glb',
  '/models/oem/tesla-supercharger-v3-community.glb',
]);

export async function GET(request:NextRequest){
  const path=request.nextUrl.searchParams.get('path')||'';
  if(!allowed.has(path))return NextResponse.json({error:'unsupported recovery path'},{status:400});
  const response=await fetch('https://stratumspatialverified.vercel.app'+path,{cache:'no-store'});
  if(!response.ok)return NextResponse.json({error:'source fetch failed',status:response.status},{status:502});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<12||bytes.subarray(0,4).toString('ascii')!=='glTF'){
    return NextResponse.json({error:'source is not a GLB',length:bytes.length},{status:502});
  }
  return NextResponse.json({
    path,
    length:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex'),
    base64:bytes.toString('base64'),
  });
}
