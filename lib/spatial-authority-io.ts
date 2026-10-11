import {assertRealWritePayload,containsDemoProvenance} from './spatial-provenance';
type Shape={provenance_class?:string;entities?:unknown[];sources?:unknown[];[key:string]:unknown};
const deny=(why:string)=>{throw Object.assign(Error(why),{status:403})};
/** One default-deny guard for API exports, JSON backups, glTF/IFC and print/share flows. */
export function requireExportAuthority(twin:Shape):void{
 if(!twin||twin.provenance_class!=='REAL')deny('Export requires an explicitly REAL-provenance twin');
 if(containsDemoProvenance(twin))deny('DEMO or mixed-provenance twins may never be exported');
 if(!Array.isArray(twin.entities)||!Array.isArray(twin.sources))deny('Export requires a valid source graph');
 assertRealWritePayload(twin);
}
/** No mesh, ghost, DEMO or sheet XY coordinate can be measured without calibrated transform provenance. */
export function requireMeasureAuthority(args:{
 twin:Shape;
 sheet_transform_id:string|null;
 transform:{id:string;status:string;residual_mm:number|null;approved_by:string|null;applied_by:string|null;witness_ids:readonly string[]}|null;
}):void{
 requireExportAuthority(args.twin);
 const t=args.transform;
 if(!t||!args.sheet_transform_id||t.id!==args.sheet_transform_id||
    t.status!=='APPLIED'||!t.approved_by||!t.applied_by||
    !Number.isFinite(t.residual_mm)||t.residual_mm===null||t.residual_mm<0||
    !Array.isArray(t.witness_ids)||t.witness_ids.length<2)
  deny('Measurement requires an applied human-reviewed sheet_transform_id with a recorded residual and independent witnesses');
}
