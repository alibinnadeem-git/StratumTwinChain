export type DrawingMark={
 id:string;page:number;x:number;y:number;width:number;height:number;
 label:string;reference:string;legend:string;
 component:'unresolved'|'panel'|'switch'|'receptacle'|'other';
 drawingState:'unresolved'|'existing'|'new';
};

export function drawingMarkEntity(mark:DrawingMark,digest:string,source:string){
 if(!Number.isInteger(mark.page)||mark.page<1||![mark.x,mark.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!mark.label.trim())throw new Error('Invalid sheet annotation');
 if(mark.component!=='unresolved'&&!mark.legend.trim())throw new Error('A sheet legend or schedule reference is required to classify a symbol.');
 const aspectX=mark.width/Math.max(mark.width,mark.height,1),aspectY=mark.height/Math.max(mark.width,mark.height,1);
 return {
  id:`${digest}:annotation:${mark.id}`,source,layer:'L2' as const,kind:'annotated-asset-candidate',name:mark.label.trim(),
  x:(mark.x-.5)*20*aspectX,y:(.5-mark.y)*20*aspectY,z:0,floor:'UNRESOLVED',confidence:1,
  meta:{sourceSha256:digest,sourceType:'MANUAL_SHEET_REVIEW',page:mark.page,
   normalizedX:mark.x,normalizedY:mark.y,reference:mark.reference.trim(),legendReference:mark.legend.trim(),
   electricalComponentHint:mark.component==='unresolved'?undefined:mark.component,
   drawingState:mark.drawingState,reviewRequired:true,registrationState:'CANDIDATE',
   coordinateUnits:'normalized-sheet',spatialPlacementAuthority:'SOURCE_SHEET_POSITION_ONLY',
   geometryAuthority:'NONE',physicalTruth:false,description:mark.label.trim()}
 };
}
