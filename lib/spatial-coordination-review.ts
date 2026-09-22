import type {CoordinationFinding,CoordinationSnapshot} from './coordination-intelligence.ts';

export type SpatialCoordinationReview={
 entityId:string;
 findingIds:string[];
 findingTypes:string[];
 findingCount:number;
 highCount:number;
 reviewCount:number;
 severity:'H3'|'H2';
 truthBoundary:'VISUAL_REVIEW_MARKER_NOT_GEOMETRIC_CLASH_OR_ENGINEERING_APPROVAL';
};

export function buildSpatialCoordinationReviewIndex(snapshot:CoordinationSnapshot|null|undefined){
 const byEntity=new Map<string,SpatialCoordinationReview>();
 if(!snapshot)return byEntity;
 for(const finding of snapshot.findings||[]){
  for(const entityId of finding.entityRefs||[]){
   if(!entityId)continue;
   const existing=byEntity.get(entityId);
   const high=finding.humanControlLevel==='H3'?1:0;
   const review=finding.humanControlLevel==='H2'?1:0;
   if(existing){
    if(!existing.findingIds.includes(finding.id))existing.findingIds.push(finding.id);
    if(!existing.findingTypes.includes(finding.findingType))existing.findingTypes.push(finding.findingType);
    existing.findingCount=existing.findingIds.length;
    existing.highCount+=high;
    existing.reviewCount+=review;
    existing.severity=existing.highCount>0?'H3':'H2';
   }else{
    byEntity.set(entityId,{
     entityId,
     findingIds:[finding.id],
     findingTypes:[finding.findingType],
     findingCount:1,
     highCount:high,
     reviewCount:review,
     severity:high?'H3':'H2',
     truthBoundary:'VISUAL_REVIEW_MARKER_NOT_GEOMETRIC_CLASH_OR_ENGINEERING_APPROVAL'
    });
   }
  }
 }
 return byEntity;
}

export function findingsForEntity(snapshot:CoordinationSnapshot|null|undefined,entityId:string):CoordinationFinding[]{
 if(!snapshot||!entityId)return[];
 return snapshot.findings.filter(finding=>finding.entityRefs.includes(entityId));
}
