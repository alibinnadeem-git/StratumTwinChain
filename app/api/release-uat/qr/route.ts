import QRCode from 'qrcode';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const session=new URL(req.url).searchParams.get('session')?.slice(0,96)||'missing';
 const value=`STRATUM-RELEASE-UAT:${session}`;
 const svg=await QRCode.toString(value,{type:'svg',margin:2,errorCorrectionLevel:'M'});
 return new Response(svg,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'no-store'}});
}
