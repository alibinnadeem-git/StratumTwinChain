export const SPATIAL_PROJECT_KEY='stratum_spatial_project_id';
export const SPATIAL_PROJECT_SELECTION_EVENT='stratum:spatial-project-selected';

export function readSelectedSpatialProjectId(){
 try{return localStorage.getItem(SPATIAL_PROJECT_KEY)||''}catch{return''}
}

export function writeSelectedSpatialProjectId(projectId:string){
 let previous='';
 try{
  previous=localStorage.getItem(SPATIAL_PROJECT_KEY)||'';
  if(projectId)localStorage.setItem(SPATIAL_PROJECT_KEY,projectId);
  else localStorage.removeItem(SPATIAL_PROJECT_KEY);
 }catch{}
 if(previous!==projectId&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SPATIAL_PROJECT_SELECTION_EVENT,{detail:{projectId}}));
}
