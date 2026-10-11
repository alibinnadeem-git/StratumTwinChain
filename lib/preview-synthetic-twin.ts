/**
 * Explicitly synthetic, display-only input for the Vercel preview Spatial viewer.
 * Never feed this fixture to browser recovery, source vault, asset APIs, approval,
 * DIR, measurements, takeoffs, or exports. Nothing here represents actual work.
 */
const source='DEMO / SYNTHETIC E-101 — Electrical Room (NOT AN ACTUAL PDF)';
const sourceHash='d'.repeat(64);
const evidence=(sheet:string,note:string)=>({
 source_file_id:sourceHash,sheet_number:sheet,page_index:0,
 bbox_page:[40,40,120,90],note,synthetic:true
});
const baseMeta={
 demo:true,synthetic:true,tenantData:false,authorityEligible:false,
 verificationPromotionEligible:false,takeoffEligible:false,
 measurementEligible:false,exportEligible:false,
 physicalTruth:false,reviewRequired:true,
 planDiscipline:'Electrical',discipline:'Electrical',page:1,
 sourceSha256:sourceHash,sheetTitle:'DEMO E-101 · Synthetic Electrical Room',
};
function asset(id:string,name:string,x:number,y:number,tier:'STATED_Z'|'DERIVED_Z_CANDIDATE'|'UNRESOLVED_Z',
 z?:number,extra:Record<string,unknown>={}){
 return {
  id:`DEMO-SYNTHETIC-${id}`,source,layer:'L2' as const,kind:extra.kind==='sheet-callout-candidate'?'sheet-callout-candidate':'equipment',
  name:`DEMO · ${name}`,x,y,...(tier==='STATED_Z'?{z}:{}),
  floor:'DEMO E-101',confidence:tier==='STATED_Z'?.92:tier==='DERIVED_Z_CANDIDATE'?.8:.56,
  meta:{...baseMeta,...extra,demoPlacementTier:tier,status:(tier==='UNRESOLVED_Z'?'UNRESOLVED':'INFERRED_PREDICTED') as 'UNRESOLVED'|'INFERRED_PREDICTED',
   evidence:[evidence('DEMO E-101',tier==='STATED_Z'
     ?'Synthetic elevation note; source-stated within fixture, not field-verified'
     :tier==='DERIVED_Z_CANDIDATE'
     ?'Synthetic grade/FFE control; Z interpolation proposal only'
     :'No Z source evidence; must remain unresolved')],
   ...(tier==='STATED_Z'
    ?{elevationKnown:true,physicalElevationKnown:true,sourceStatedZ:true}
    :{elevationKnown:false,physicalElevationKnown:false,zResolutionStatus:tier==='DERIVED_Z_CANDIDATE'?'RESOLVED_DESIGN_CANDIDATE':'UNRESOLVED'}),
   ...(tier==='DERIVED_Z_CANDIDATE'?{zCandidateMeters:z,zResolutionConfidence:.77,
    zResolutionAuthority:'DEMO_SOURCE_CONTROL_REVIEW',
    zCandidateReferencePoint:'HOST_CONTACT',zCandidatePhysicalTruth:false}:{}),
   ...(tier==='UNRESOLVED_Z'?{reason_codes:['Z_NOT_STATED','SCALE_UNKNOWN'],
    missing_inputs:['Synthetic sheet elevation control','Human-confirmed XY scale and Z reference']}:{}),
  }
 };
}
const entities=[
 asset('MSB-01','Main Switchboard',4,5,'STATED_Z',.1,{demoComponentKey:'main-switchboard',sourceElevationNote:'DEMO E-101: TOP OF CONCRETE PAD +0.10 m'}),
 asset('XFMR-01','Pad-mount Transformer',8.5,4.5,'STATED_Z',.25,{demoComponentKey:'pad-mount-transformer',sourceElevationNote:'DEMO E-101: BASE AT +0.25 m'}),
 asset('UPS-01','UPS Cabinet',12,5,'DERIVED_Z_CANDIDATE',.18,{demoComponentKey:'ups'}),
 asset('ATS-01','Automatic Transfer Switch',15,7.5,'DERIVED_Z_CANDIDATE',1.2,{demoComponentKey:'ats'}),
 asset('PANEL-01','Panelboard',5,10,'UNRESOLVED_Z',undefined,{location_state:'known',demoComponentKey:'panelboard'}),
 asset('SHEET-PIN-01','Unknown Device · source sheet pin',14,10,'UNRESOLVED_Z',undefined,{
  kind:'sheet-callout-candidate',coordinateUnits:'sheet',location_state:'unknown',
  reason_codes:['SCALE_UNKNOWN','LOCATION_AMBIGUOUS','Z_NOT_STATED'],
  missing_inputs:['Scale corroboration and human XY confirmation','Readable drawing legend and elevation note']
 })
];
const room={
 id:'DEMO-SYNTHETIC-ROOM',source,layer:'L1' as const,kind:'room-boundary',
 name:'DEMO · Electrical Room outline',x:1,y:2,floor:'DEMO E-101',confidence:1,
 vertices:[{x:1,y:2},{x:18,y:2},{x:18,y:12},{x:1,y:12}],
 meta:{...baseMeta,sourceGeometry:true,verified:false}
};
export const PREVIEW_DEMO_GRAPH={
 version:'DEMO-SYNTHETIC-ONLY-v1',createdAt:'2026-10-10T00:00:00.000Z',
 demo:true,synthetic:true,persisted:false,authorityEligible:false,
 sources:[{name:source,ext:'pdf',sha256:sourceHash,discipline:'Electrical',floor:'DEMO E-101',entities:entities.length,vectors:8}],
 entities:[room,...entities],links:[],
 stats:{L0:0,L1:1,L2:6,L3:0,L4:0}
};
export function isPreviewDemoEntity(value:unknown):boolean{
 const e=value as {id?:string;meta?:Record<string,unknown>}|null;
 return Boolean(e&&e.id?.startsWith('DEMO-SYNTHETIC-')&&e.meta?.demo===true&&e.meta?.synthetic===true);
}
