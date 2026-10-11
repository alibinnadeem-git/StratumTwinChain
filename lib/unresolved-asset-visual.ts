/**
 * A07 Day-2 presentation-only overlay. This classifies visibility, not position.
 * It must not assign canonical XYZ, trust state, or a resolved component.
 */
export type UnresolvedVisualEntity={
 layer:string;kind:string;x:number;y:number;meta?:Record<string,unknown>;
};
export type UnresolvedVisual={
 kind:'GHOST_MARKER'|'SHEET_PIN'|'NONE';
 label:string;
 canonicalZ:null;
 reviewOnly:boolean;
 takeoffEligible:false;
 measurementEligible:false;
 exportEligible:false;
 missingInputs:readonly string[];
};
const isKnownZ=(meta:Record<string,unknown>)=>
 (meta.physicalElevationKnown===true||meta.elevationKnown===true)&&
 meta.physicalElevationKnown!==false&&meta.elevationKnown!==false;
export function unresolvedAssetVisual(entity:UnresolvedVisualEntity):UnresolvedVisual{
 const meta=entity.meta||{};
 const common={canonicalZ:null as null,reviewOnly:true as const,takeoffEligible:false as const,
  measurementEligible:false as const,exportEligible:false as const};
 if(!['L2','L4'].includes(entity.layer)||isKnownZ(meta))
  return{...common,kind:'NONE',label:'',missingInputs:[]};
 const sheetOnly=entity.kind==='sheet-callout-candidate'||
  entity.kind==='annotated-asset-candidate'||
  (entity.kind==='cad-text'&&meta.cadPhysicalAnchor===false)||
  meta.coordinateUnits==='sheet'||meta.planXYValidated===false||
  !Number.isFinite(entity.x)||!Number.isFinite(entity.y);
 if(sheetOnly){
  return{...common,kind:'SHEET_PIN',label:'SOURCE SHEET PIN · XYZ UNRESOLVED',
   missingInputs:['Human-confirmed metric XY transform or recorded source coordinates','A named elevation datum and mounting/reference-point evidence']};
 }
 return{...common,kind:'GHOST_MARKER',label:'PROVISIONAL GHOST · Z UNRESOLVED',
  missingInputs:['Source-linked grade/floor datum or elevation control','Mounting/host reference point and reviewed Z evidence']};
}
