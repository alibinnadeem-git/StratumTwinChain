import {resolveElectricalComponent} from './electrical-component-library.ts';

export type DxfAssociationEntity={
  id:string;
  source:string;
  layer?:string;
  kind:string;
  name:string;
  x:number;
  y:number;
  z?:number;
  rotation?:number;
  floor?:string;
  confidence:number;
  meta?:Record<string,unknown>;
};

type Proposal={
  label:DxfAssociationEntity;
  block:DxfAssociationEntity;
  distance:number;
  confidence:number;
  labelComponentKey:string|null;
  blockComponentKey:string|null;
  assetTag:string|null;
};

const norm=(value:unknown)=>String(value??'').trim().toUpperCase().replace(/s+/g,' ');
const sameFrame=(a:DxfAssociationEntity,b:DxfAssociationEntity)=>{
  const af=norm(a.meta?.xyCoordinateFrame),bf=norm(b.meta?.xyCoordinateFrame);
  return af&&bf?af===bf:true;
};
const sameFloor=(a:DxfAssociationEntity,b:DxfAssociationEntity)=>{
  const af=norm(a.floor),bf=norm(b.floor);
  return !af||!bf||af==='UNRESOLVED'||bf==='UNRESOLVED'||af===bf;
};
const metric=(entity:DxfAssociationEntity)=>String(entity.meta?.coordinateUnits||'').toLowerCase()==='m_dxf_design';
const distance=(a:DxfAssociationEntity,b:DxfAssociationEntity)=>Math.hypot(a.x-b.x,a.y-b.y);
const distinct=<T,>(values:T[])=>[...new Set(values)];

const TAG_PATTERNS=[
  /(?:MSB|MDP|MDB|MCC|PDU|ATS|UPS|GEN|XFMR|TX|EVSE|FACP|SWBD|SWGR)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*/i,
  /(?:LP|PP|DP|EP|RP|PNL)[-_ ]?#?[A-Z0-9]+(?:[-_.][A-Z0-9]+)*/i,
  /PANEL(?:BOARD)?s+([A-Z0-9]+(?:[-_.][A-Z0-9]+)*)/i
];

export function dxfEquipmentTagFromLabel(label:string){
  const value=String(label||'').trim();
  for(const pattern of TAG_PATTERNS){
    const match=value.match(pattern);
    if(!match)continue;
    if(/^PANEL/i.test(match[0])&&match[1])return match[1].replace(/s+/g,'-').toUpperCase();
    return match[0].replace(/s+/g,'-').toUpperCase();
  }
  return null;
}

function compatibleIdentity(label:DxfAssociationEntity,block:DxfAssociationEntity){
  const labelComponent=resolveElectricalComponent(label.name);
  const blockComponent=resolveElectricalComponent(block.name);
  if(!labelComponent||!blockComponent)return{
    compatible:true,
    labelComponentKey:labelComponent?.key||null,
    blockComponentKey:blockComponent?.key||null
  };
  return{
    compatible:labelComponent.twinShape===blockComponent.twinShape,
    labelComponentKey:labelComponent.key,
    blockComponentKey:blockComponent.key
  };
}

function associationThreshold(entity:DxfAssociationEntity){
  return metric(entity)
    ?{maxDistance:2.5,margin:.3,ratio:1.5}
    :{maxDistance:.7,margin:.12,ratio:1.5};
}

export function associateDxfEquipmentLabels<T extends DxfAssociationEntity>(entities:T[]):T[]{
  const labels=entities.filter(entity=>entity.kind==='cad-text'&&entity.meta?.cadPhysicalAnchor===false&&entity.layer==='L2');
  const blocks=entities.filter(entity=>entity.kind==='cad-block'&&entity.meta?.cadPhysicalAnchor===true);
  const proposals:Proposal[]=[];
  const labelUpdates=new Map<string,Record<string,unknown>>();

  for(const label of labels){
    const threshold=associationThreshold(label);
    const candidates=blocks
      .filter(block=>block.source===label.source&&sameFrame(label,block)&&sameFloor(label,block))
      .map(block=>{
        const d=distance(label,block),identity=compatibleIdentity(label,block);
        return{block,d,identity};
      })
      .filter(item=>item.d<=threshold.maxDistance)
      .sort((a,b)=>a.d-b.d);

    if(!candidates.length){
      labelUpdates.set(label.id,{
        dxfLabelAssociationStatus:'UNRESOLVED',
        dxfLabelAssociationAuthority:'DXF_TEXT_IDENTITY_ONLY',
        dxfLabelAssociationCandidateBlockIds:[]
      });
      continue;
    }

    const compatible=candidates.filter(item=>item.identity.compatible);
    if(!compatible.length){
      labelUpdates.set(label.id,{
        dxfLabelAssociationStatus:'CONFLICT',
        dxfLabelAssociationAuthority:'DXF_TEXT_BLOCK_IDENTITY_CONFLICT',
        dxfLabelAssociationCandidateBlockIds:candidates.slice(0,4).map(item=>item.block.id),
        dxfLabelAssociationCandidateDistances:candidates.slice(0,4).map(item=>Number(item.d.toFixed(6)))
      });
      continue;
    }

    const best=compatible[0],second=compatible[1];
    const unique=!second||(
      second.d-best.d>=threshold.margin&&
      second.d/Math.max(best.d,metric(label)?.05:.02)>=threshold.ratio
    );
    if(!unique){
      labelUpdates.set(label.id,{
        dxfLabelAssociationStatus:'AMBIGUOUS',
        dxfLabelAssociationAuthority:'DXF_TEXT_IDENTITY_ONLY',
        dxfLabelAssociationCandidateBlockIds:compatible.slice(0,4).map(item=>item.block.id),
        dxfLabelAssociationCandidateDistances:compatible.slice(0,4).map(item=>Number(item.d.toFixed(6)))
      });
      continue;
    }

    proposals.push({
      label,
      block:best.block,
      distance:best.d,
      confidence:Math.max(0,Math.min(1,Math.min(label.confidence,best.block.confidence)*Math.max(.72,1-best.d/threshold.maxDistance*.2))),
      labelComponentKey:best.identity.labelComponentKey,
      blockComponentKey:best.identity.blockComponentKey,
      assetTag:dxfEquipmentTagFromLabel(label.name)
    });
  }

  const byBlock=new Map<string,Proposal[]>();
  for(const proposal of proposals)byBlock.set(proposal.block.id,[...(byBlock.get(proposal.block.id)||[]),proposal]);

  const accepted=new Map<string,Proposal>();
  for(const [blockId,items] of byBlock){
    const labelTexts=distinct(items.map(item=>norm(item.label.name)));
    if(labelTexts.length===1){
      const chosen=[...items].sort((a,b)=>a.distance-b.distance)[0];
      accepted.set(blockId,chosen);
      for(const item of items){
        labelUpdates.set(item.label.id,{
          dxfLabelAssociationStatus:'ASSOCIATED',
          dxfLabelAssociationAuthority:'UNIQUE_NEAREST_DXF_INSERT',
          dxfAssociatedBlockId:blockId,
          dxfLabelAssociationDistance:item.distance,
          dxfLabelAssociationConfidence:chosen.confidence,
          physicalTruth:false,
          physicalPositionVerified:false,
          asBuiltAuthority:false,
          reviewRequired:true
        });
      }
    }else{
      for(const item of items){
        labelUpdates.set(item.label.id,{
          dxfLabelAssociationStatus:'AMBIGUOUS',
          dxfLabelAssociationAuthority:'MULTIPLE_DISTINCT_LABELS_FOR_BLOCK',
          dxfLabelAssociationCandidateBlockIds:[blockId],
          dxfLabelAssociationDistance:item.distance
        });
      }
    }
  }

  return entities.map(entity=>{
    const labelUpdate=labelUpdates.get(entity.id);
    if(labelUpdate)return{...entity,meta:{...(entity.meta||{}),...labelUpdate}} as T;

    const proposal=accepted.get(entity.id);
    if(!proposal)return entity;

    const ownComponent=resolveElectricalComponent(entity.name);
    const labelText=proposal.label.name.trim();
    const mergedName=ownComponent&&norm(entity.name)!==norm(labelText)
      ?labelText+' · '+entity.name
      :labelText;
    const meta={
      ...(entity.meta||{}),
      ...(proposal.assetTag?{assetTag:proposal.assetTag,equipmentTag:proposal.assetTag}:{}),
      dxfIdentityLabelId:proposal.label.id,
      dxfIdentityLabelText:labelText,
      dxfIdentityAssociationStatus:'SOURCE_RECONCILED_CANDIDATE',
      dxfIdentityAssociationAuthority:'UNIQUE_NEAREST_DXF_INSERT',
      dxfIdentityAssociationDistance:proposal.distance,
      dxfIdentityAssociationConfidence:proposal.confidence,
      dxfIdentityLabelComponentKey:proposal.labelComponentKey,
      dxfIdentityBlockComponentKey:proposal.blockComponentKey,
      productIdentityPhysicalAssetVerified:false,
      physicalTruth:false,
      physicalPositionVerified:false,
      asBuiltAuthority:false,
      reviewRequired:true
    };
    return{...entity,name:mergedName,meta} as T;
  });
}
