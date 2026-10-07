import {NextResponse} from 'next/server';
import {z,ZodError} from 'zod';
import {requireSession} from '@/lib/server/auth';
import {ingestTelemetry,TELEMETRY_TRUTH_BOUNDARY} from '@/lib/server/telemetry';

const Body=z.object({
 assetId:z.string().uuid(),
 tick:z.number().int().min(0).max(1_000_000).optional().default(0),
});

export async function POST(req:Request){
 try{
  const session=await requireSession(['SUPER_ADMIN','ORG_ADMIN','PROJECT_MANAGER','TECHNICIAN']);
  const {assetId,tick}=Body.parse(await req.json());
  const observedAt=new Date().toISOString();
  const wave=(period:number,amplitude:number,base:number)=>base+Math.sin((tick%period)/period*Math.PI*2)*amplitude;
  const samples=[
   {sensorKey:'sim.voltage.l1',measurement:'Voltage L1-N',unit:'V',value:Number(wave(20,2.4,277).toFixed(2))},
   {sensorKey:'sim.current.l1',measurement:'Current L1',unit:'A',value:Number(wave(16,6.5,82).toFixed(2))},
   {sensorKey:'sim.power.kw',measurement:'Active Power',unit:'kW',value:Number(wave(24,3.2,38).toFixed(2))},
   {sensorKey:'sim.temperature',measurement:'Enclosure Temperature',unit:'°C',value:Number(wave(30,1.1,31).toFixed(2))},
  ];
  const readings=[];
  for(const sample of samples){
   readings.push(await ingestTelemetry(session.organizationId,{
    assetId,
    ...sample,
    observedAt,
    quality:'GOOD',
    source:{
     protocol:'SIMULATOR',
     ref:'STRATUM deterministic telemetry simulator v1',
     samplingIntervalMs:2000,
     metadata:{tick,adapterContract:'SAME_INGESTION_SERVICE_AS_PHYSICAL_PROTOCOL_ADAPTERS'},
    }
   }));
  }
  return NextResponse.json({
   assetId,tick,readings,
   truthBoundary:TELEMETRY_TRUTH_BOUNDARY,
   simulatorBoundary:'SIMULATED_OBSERVED_DATA_NOT_FIELD_MEASUREMENT',
  },{status:201,headers:{'cache-control':'private, no-store'}});
 }catch(error:any){
  if(error instanceof ZodError)return NextResponse.json({error:'Invalid simulator payload',issues:error.issues},{status:400});
  return NextResponse.json({error:error.message},{status:error.status||500,headers:{'cache-control':'private, no-store'}});
 }
}
