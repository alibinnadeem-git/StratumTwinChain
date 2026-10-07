import {z} from 'zod';
import {query,tx} from '@/lib/server/db';

export const TELEMETRY_PROTOCOLS=['OPC_UA','MQTT','REST_WEBHOOK','BACNET_IP','MODBUS_TCP','SIMULATOR'] as const;
export type TelemetryProtocol=(typeof TELEMETRY_PROTOCOLS)[number];

const TelemetryValue=z.union([z.number().finite(),z.string().max(500),z.boolean()]);
export const TelemetryIngestSchema=z.object({
 assetId:z.string().uuid(),
 sensorKey:z.string().trim().min(1).max(200),
 measurement:z.string().trim().min(1).max(120),
 unit:z.string().trim().min(1).max(60),
 value:TelemetryValue,
 observedAt:z.string().trim().min(10).max(80).refine(value=>Number.isFinite(Date.parse(value)),{message:'observedAt must be a valid timestamp'}),
 quality:z.enum(['GOOD','UNCERTAIN','BAD']).optional().default('GOOD'),
 source:z.object({
  protocol:z.enum(TELEMETRY_PROTOCOLS),
  ref:z.string().trim().max(500).optional(),
  samplingIntervalMs:z.number().int().positive().max(86_400_000).optional(),
  metadata:z.record(z.unknown()).optional().default({}),
 })
});
export type TelemetryIngest=z.infer<typeof TelemetryIngestSchema>;

export async function ingestTelemetry(organizationId:string,input:TelemetryIngest){
 const body=TelemetryIngestSchema.parse(input);
 return tx(async client=>{
  const asset=await client.query<{id:string;project_id:string}>(`
    SELECT id::text,project_id::text
    FROM assets
    WHERE organization_id=$1 AND id=$2
    LIMIT 1
    FOR SHARE
  `,[organizationId,body.assetId]);
  if(!asset.rows[0])throw Object.assign(new Error('Asset not found in this organization'),{status:404});
  const projectId=asset.rows[0].project_id;

  const point=await client.query<{id:string}>(`
    INSERT INTO telemetry_points
      (organization_id,project_id,asset_id,sensor_key,measurement,unit,source_protocol,source_ref,sampling_interval_ms,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
    ON CONFLICT (organization_id,asset_id,sensor_key)
    DO UPDATE SET
      measurement=EXCLUDED.measurement,
      unit=EXCLUDED.unit,
      source_protocol=EXCLUDED.source_protocol,
      source_ref=EXCLUDED.source_ref,
      sampling_interval_ms=EXCLUDED.sampling_interval_ms,
      metadata=telemetry_points.metadata||EXCLUDED.metadata
    RETURNING id::text
  `,[
    organizationId,projectId,body.assetId,body.sensorKey,body.measurement,body.unit,
    body.source.protocol,body.source.ref||null,body.source.samplingIntervalMs||null,JSON.stringify(body.source.metadata||{})
  ]);

  const reading=await client.query<any>(`
    INSERT INTO telemetry_readings
      (organization_id,project_id,asset_id,point_id,observed_at,value_json,quality,source_protocol,source_ref)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
    RETURNING id::text,point_id::text,asset_id::text,project_id::text,observed_at,received_at,value_json,quality,source_protocol,source_ref,truth_boundary
  `,[
    organizationId,projectId,body.assetId,point.rows[0].id,new Date(body.observedAt).toISOString(),
    JSON.stringify(body.value),body.quality,body.source.protocol,body.source.ref||null
  ]);

  return{
   ...reading.rows[0],
   sensor_key:body.sensorKey,
   measurement:body.measurement,
   unit:body.unit,
   sampling_interval_ms:body.source.samplingIntervalMs||null,
  };
 });
}

export async function latestTelemetry(organizationId:string,assetId:string){
 const asset=await query<{id:string}>(`
   SELECT id::text FROM assets WHERE organization_id=$1 AND id=$2 LIMIT 1
 `,[organizationId,assetId]);
 if(!asset.rows[0])throw Object.assign(new Error('Asset not found in this organization'),{status:404});
 const result=await query<any>(`
   SELECT DISTINCT ON (tp.id)
     tr.id::text,tr.asset_id::text,tr.project_id::text,tr.point_id::text,
     tp.sensor_key,tp.measurement,tp.unit,tp.sampling_interval_ms,
     tr.observed_at,tr.received_at,tr.value_json,tr.quality,tr.source_protocol,tr.source_ref,tr.truth_boundary
   FROM telemetry_points tp
   JOIN telemetry_readings tr
     ON tr.organization_id=tp.organization_id AND tr.point_id=tp.id
   WHERE tp.organization_id=$1 AND tp.asset_id=$2
   ORDER BY tp.id,tr.observed_at DESC,tr.received_at DESC,tr.id DESC
 `,[organizationId,assetId]);
 return result.rows;
}

export async function telemetrySince(organizationId:string,assetId:string,since:string){
 const parsed=new Date(since);
 if(!Number.isFinite(parsed.getTime()))throw Object.assign(new Error('Invalid since timestamp'),{status:400});
 const result=await query<any>(`
   SELECT tr.id::text,tr.asset_id::text,tr.project_id::text,tr.point_id::text,
          tp.sensor_key,tp.measurement,tp.unit,tp.sampling_interval_ms,
          tr.observed_at,tr.received_at,tr.value_json,tr.quality,tr.source_protocol,tr.source_ref,tr.truth_boundary
   FROM telemetry_readings tr
   JOIN telemetry_points tp ON tp.id=tr.point_id AND tp.organization_id=tr.organization_id
   WHERE tr.organization_id=$1 AND tr.asset_id=$2 AND tr.received_at>$3
   ORDER BY tr.received_at ASC,tr.id ASC
   LIMIT 500
 `,[organizationId,assetId,parsed.toISOString()]);
 return result.rows;
}

export const TELEMETRY_TRUTH_BOUNDARY='OBSERVED_OPERATIONAL_DATA_NOT_VERIFIED_PHYSICAL_TRUTH';
