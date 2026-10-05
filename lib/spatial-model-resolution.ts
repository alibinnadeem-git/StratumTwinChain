import {ELECTRICAL_COMPONENTS,resolveElectricalComponent,type ElectricalComponent} from './electrical-component-library.ts';
import type {ElectricalModelConfig} from './electrical-model-registry.ts';

export type SpatialModelResolutionTier=
  |'EXACT_VERIFIED_OEM_CAD'
  |'EXACT_PRODUCT_VISUALIZATION'
  |'FAMILY_MODEL'
  |'PROCEDURAL_FALLBACK'
  |'UNRESOLVED';

export type SpatialModelEntity={
  name:string;
  meta?:Record<string,unknown>;
};

export type SpatialModelResolution={
  tier:SpatialModelResolutionTier;
  component:ElectricalComponent|null;
  model:ElectricalModelConfig|null;
  componentKey:string|null;
  exactProductIdentity:boolean;
  confidence:number;
  identityAuthority:string;
  geometryAuthority:string;
  evidence:string[];
  fallbackReason:string|null;
  physicalIdentityVerified:false;
};

const clean=(value:unknown)=>String(value??'').trim();
const norm=(value:unknown)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const has=(haystack:string,needle:string)=>Boolean(needle&&haystack.includes(needle));
const finiteConfidence=(value:number)=>Math.max(0,Math.min(1,value));

function findComponentByKey(key:string){
  return ELECTRICAL_COMPONENTS.find(component=>component.key===key)||null;
}

function explicitComponentKey(meta:Record<string,unknown>){
  for(const key of ['componentKey','electricalComponentKey','componentLibraryKey']){
    const value=clean(meta[key]);if(value&&findComponentByKey(value))return value;
  }
  return null;
}

function manufacturerEvidence(entity:SpatialModelEntity){
  const meta=entity.meta||{};
  return norm([meta.manufacturer,meta.oem,meta.brand].filter(Boolean).join(' '));
}

function modelEvidence(entity:SpatialModelEntity){
  const meta=entity.meta||{};
  return norm([
    entity.name,meta.manufacturer,meta.oem,meta.brand,meta.model,meta.modelNumber,meta.productName,meta.partNumber,
    meta.manufacturerPartNumber,meta.sku,meta.catalogNumber,meta.catalogNo
  ].filter(Boolean).join(' '));
}

function componentManufacturer(component:ElectricalComponent){return component.manufacturer||'unresolved manufacturer'}
function componentModelFamily(component:ElectricalComponent){return component.modelFamily||component.name}

function exactIdentitySupported(entity:SpatialModelEntity,component:ElectricalComponent,explicitKey:boolean){
  if(!component.manufacturer&&!component.modelFamily)return false;
  if(explicitKey)return true;
  const maker=manufacturerEvidence(entity),model=modelEvidence(entity);
  const makerExpected=norm(component.manufacturer),familyExpected=norm(component.modelFamily),componentName=norm(component.name);
  const manufacturerMatches=!makerExpected||has(maker,makerExpected)||has(model,makerExpected);
  const familyMatches=Boolean(
    (familyExpected&&has(model,familyExpected))||
    (componentName&&has(model,componentName))||
    component.aliases.some(alias=>{
      const a=norm(alias);if(!a)return false;
      return /\d/.test(a)&&has(model,a);
    })
  );
  return manufacturerMatches&&familyMatches;
}

function resolveGenericFamily(name:string,exactCandidate:ElectricalComponent){
  const normalized=norm(name);
  const aliasMatch=ELECTRICAL_COMPONENTS.find(component=>
    !component.manufacturer&&component.twinShape===exactCandidate.twinShape&&
    component.aliases.some(alias=>has(normalized,norm(alias)))
  );
  if(aliasMatch)return aliasMatch;
  return ELECTRICAL_COMPONENTS.find(component=>
    !component.manufacturer&&component.twinShape===exactCandidate.twinShape&&component.key===exactCandidate.twinShape
  )||null;
}

function bestComponent(entity:SpatialModelEntity){
  const meta=entity.meta||{},explicitKey=explicitComponentKey(meta);
  if(explicitKey){
    const component=findComponentByKey(explicitKey)!;
    return{component,exact:exactIdentitySupported(entity,component,true),evidence:['Explicit component-library key '+explicitKey]};
  }

  const composite=[
    entity.name,meta.manufacturer,meta.oem,meta.brand,meta.model,meta.modelNumber,
    meta.productName,meta.partNumber,meta.manufacturerPartNumber,meta.sku,meta.catalogNumber,meta.catalogNo
  ].filter(Boolean).join(' ');

  const compositeComponent=resolveElectricalComponent(composite);
  if(compositeComponent&&exactIdentitySupported(entity,compositeComponent,false)){
    return{
      component:compositeComponent,exact:true,
      evidence:[
        'Source product identity matched '+compositeComponent.name,
        ...(compositeComponent.manufacturer?['Manufacturer '+componentManufacturer(compositeComponent)]:[]),
        ...(compositeComponent.modelFamily?['Model family '+componentModelFamily(compositeComponent)]:[])
      ]
    };
  }

  const familyComponent=resolveElectricalComponent(entity.name);
  if(familyComponent){
    if(familyComponent.manufacturer||familyComponent.modelFamily){
      if(exactIdentitySupported(entity,familyComponent,false)){
        return{component:familyComponent,exact:true,evidence:['Drawing label matched exact product '+familyComponent.name]};
      }
      const generic=resolveGenericFamily(entity.name,familyComponent);
      if(generic)return{component:generic,exact:false,evidence:['Product-specific wording was insufficient for exact identity; reduced to family '+generic.name]};
      return{component:null,exact:false,evidence:['OEM/product wording was insufficient to establish an exact or generic component identity.']};
    }
    return{component:familyComponent,exact:false,evidence:['Drawing label classified as '+familyComponent.name]};
  }
  return{component:null,exact:false,evidence:['No component-library classification matched the available source identity.']};
}

function modelFor(component:ElectricalComponent|null,registry:ElectricalModelConfig[]){
  if(!component)return null;
  return registry.find(item=>item.componentKey===component.key)||null;
}

function geometryTier(model:ElectricalModelConfig|null,exact:boolean):SpatialModelResolutionTier{
  if(!model||!model.modelUrl.trim())return'PROCEDURAL_FALLBACK';
  const status=String(model.geometryStatus||'').toUpperCase();
  if(exact&&status==='OEM_SUPPLIED')return'EXACT_VERIFIED_OEM_CAD';
  if(exact)return'EXACT_PRODUCT_VISUALIZATION';
  return'FAMILY_MODEL';
}

export function resolveSpatialModel(entity:SpatialModelEntity,registry:ElectricalModelConfig[]):SpatialModelResolution{
  const match=bestComponent(entity),component=match.component,model=modelFor(component,registry);
  if(!component){
    return{
      tier:'UNRESOLVED',component:null,model:null,componentKey:null,exactProductIdentity:false,confidence:0,
      identityAuthority:'UNRESOLVED',geometryAuthority:'NO_MODEL_IDENTITY',evidence:match.evidence,
      fallbackReason:'No source-grounded component identity is available.',physicalIdentityVerified:false
    };
  }

  const tier=geometryTier(model,match.exact);
  const geometryStatus=String(model?.geometryStatus||'PROCEDURAL').toUpperCase();
  const hasRenderable=Boolean(model?.modelUrl.trim()&&['GLB','GLTF'].includes(model.format));
  const confidence=finiteConfidence(
    match.exact
      ?(geometryStatus==='OEM_SUPPLIED'?.98:geometryStatus==='LICENSED_COMMUNITY'?.82:.9)
      :(hasRenderable?.65:.45)
  );
  const identityAuthority=match.exact?'SOURCE_PRODUCT_IDENTITY_MATCH':'SOURCE_COMPONENT_FAMILY_MATCH';
  const geometryAuthority=tier==='EXACT_VERIFIED_OEM_CAD'
    ?'VERIFIED_CATALOG_OEM_GEOMETRY'
    :tier==='EXACT_PRODUCT_VISUALIZATION'
      ?'EXACT_PRODUCT_'+(geometryStatus||'VISUALIZATION')
      :tier==='FAMILY_MODEL'
        ?'FAMILY_'+(geometryStatus||'VISUALIZATION')
        :'PROCEDURAL_FAMILY_ENVELOPE';

  let fallbackReason:string|null=null;
  if(tier==='FAMILY_MODEL')fallbackReason='Exact manufacturer/model geometry was not established; a family visualization is used without asserting OEM identity.';
  if(tier==='PROCEDURAL_FALLBACK')fallbackReason='No renderable component-library model is available; procedural geometry is used as a review envelope.';

  return{
    tier,component,model:model&&hasRenderable?model:null,componentKey:component.key,
    exactProductIdentity:match.exact,confidence,identityAuthority,geometryAuthority,
    evidence:[
      ...match.evidence,
      ...(model?.dimensionsSource?['Dimensions: '+model.dimensionsSource]:[]),
      ...(model?.source?['Geometry source: '+model.source]:[]),
      ...(model?.geometryStatus?['Geometry status: '+model.geometryStatus]:[])
    ],
    fallbackReason,physicalIdentityVerified:false
  };
}
