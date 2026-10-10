/**
 * A16 P0-04 evidence-only MVP. Safe to implement before the contested lifecycle,
 * sheet-transform, Z and electrical-relations sections receive Ali's disposition.
 * This module never assigns an asset status, model, physical position, or approval.
 */
export type EvidenceDiscipline='ELE'|'ARC'|'MEC'|'PLB'|'FPR';
export type ExtractionMethod='vector'|'raster'|'hybrid';
export type EvidenceKind='symbol'|'tag'|'schedule'|'legend'|'dimension'|'note'|'human';
export type AssetEvidenceInput={
 evidence_id:string;
 source_file_id:string; // SHA-256 of the original drawing (optionally prefixed sha256:).
 sheet_number:string|null;
 page_index:number; // zero-based PDF index
 bbox_page:readonly [number,number,number,number]; // PDF points, lower-left origin
 crop_ref?:string|null;
 extraction_method:ExtractionMethod;
 evidence_kind:EvidenceKind;
 detector?:{name:string;version:string;class_label:string;detection_confidence:number}|null;
};
export type ImmutableAssetEvidence=Readonly<Omit<AssetEvidenceInput,'bbox_page'|'detector'>>&{
 readonly bbox_page:readonly [number,number,number,number];
 readonly detector?:Readonly<NonNullable<AssetEvidenceInput['detector']>>|null;
};
export type EvidenceOnlyAssetRecord=Readonly<{
 record_kind:'UNCLASSIFIED_SOURCE_OBSERVATION';
 asset_id:string;
 project_id:string;
 discipline:EvidenceDiscipline;
 evidence_revision:number;
 evidence:readonly ImmutableAssetEvidence[];
}>;
const ulid=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const sha=/^(?:sha256:)?[a-f0-9]{64}$/i;
const nonempty=(x:string|null|undefined)=>typeof x==='string'&&x.trim().length>0;
function freezeEvidence(e:AssetEvidenceInput):ImmutableAssetEvidence{
 if(!nonempty(e.evidence_id))throw Error('Evidence requires an evidence_id');
 if(!sha.test(e.source_file_id))throw Error('Evidence requires a complete SHA-256 source_file_id');
 if(!Number.isInteger(e.page_index)||e.page_index<0)throw Error('Evidence requires a zero-based page_index');
 if(!Array.isArray(e.bbox_page)||e.bbox_page.length!==4||!e.bbox_page.every(Number.isFinite)||
  e.bbox_page[2]<=e.bbox_page[0]||e.bbox_page[3]<=e.bbox_page[1])throw Error('Evidence requires a finite, nonempty PDF page bounding box');
 if(!['vector','raster','hybrid'].includes(e.extraction_method))throw Error('Unsupported evidence extraction method');
 if(!['symbol','tag','schedule','legend','dimension','note','human'].includes(e.evidence_kind))throw Error('Unsupported evidence kind');
 if(e.detector&&(!nonempty(e.detector.name)||!nonempty(e.detector.version)||!nonempty(e.detector.class_label)||
  !Number.isFinite(e.detector.detection_confidence)||e.detector.detection_confidence<0||e.detector.detection_confidence>1))throw Error('Detector requires provenance and confidence in [0,1]');
 return Object.freeze({...e,bbox_page:Object.freeze([...e.bbox_page] as [number,number,number,number]),
  ...(e.detector?{detector:Object.freeze({...e.detector})}:{})});
}
function validatedEvidence(items:readonly AssetEvidenceInput[]):readonly ImmutableAssetEvidence[]{
 if(!Array.isArray(items)||items.length===0)throw Error('An asset observation needs at least one source evidence item');
 const out=items.map(freezeEvidence);
 if(new Set(out.map(e=>e.evidence_id)).size!==out.length)throw Error('Duplicate evidence_id would corrupt append-only provenance');
 return Object.freeze(out);
}
export function makeEvidenceOnlyAssetRecord(input:{asset_id:string;project_id:string;discipline:EvidenceDiscipline;evidence:readonly AssetEvidenceInput[]}):EvidenceOnlyAssetRecord{
 if(!ulid.test(input.asset_id))throw Error('Asset ID must be an uppercase 26-character ULID');
 if(!nonempty(input.project_id))throw Error('Missing project_id');
 if(!['ELE','ARC','MEC','PLB','FPR'].includes(input.discipline))throw Error('Unsupported discipline');
 return Object.freeze({record_kind:'UNCLASSIFIED_SOURCE_OBSERVATION' as const,asset_id:input.asset_id,
  project_id:input.project_id,discipline:input.discipline,evidence_revision:1,evidence:validatedEvidence(input.evidence)});
}
export function appendAssetSourceEvidence(record:EvidenceOnlyAssetRecord,additional:readonly AssetEvidenceInput[]):EvidenceOnlyAssetRecord{
 if(!additional.length)throw Error('Append requires at least one new evidence item');
 const next=validatedEvidence(additional);
 const prior=new Set(record.evidence.map(e=>e.evidence_id));
 if(next.some(e=>prior.has(e.evidence_id)))throw Error('Cannot overwrite or duplicate a prior evidence item');
 return Object.freeze({...record,evidence_revision:record.evidence_revision+1,
  evidence:Object.freeze([...record.evidence,...next])});
}
