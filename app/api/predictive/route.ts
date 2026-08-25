import {NextResponse} from 'next/server';
import {liveAssets} from '@/lib/server/live-views';
import {scorePredictiveAsset} from '@/lib/predictive';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const rows=await liveAssets();
    const states=rows.map(scorePredictiveAsset).sort((a,b)=>a.healthScore-b.healthScore);
    return NextResponse.json({ok:true,count:states.length,states});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Predictive maintenance unavailable',states:[]},{status:503});
  }
}
