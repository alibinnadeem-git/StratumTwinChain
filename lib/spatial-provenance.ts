export type ProvenanceClass='REAL'|'DEMO';
type Dict=Record<string,unknown>;
const isObject=(x:unknown):x is Dict=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
export const DEMO_ALLOWED_STATUSES=['UNRESOLVED','INFERRED_PREDICTED'] as const;
export function containsDemoProvenance(root:unknown):boolean{
 const work=[root],seen=new WeakSet<object>();let n=0;
 while(work.length){
  if(++n>400000)throw Object.assign(Error('Provenance check budget exceeded'),{status:413});
  const x=work.pop();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);
  if(Array.isArray(x)){x.forEach(y=>{if(y&&typeof y==='object')work.push(y)});continue}
  const o=x as Dict,m=isObject(o.meta)?o.meta:{};
  if(o.provenance_class==='DEMO'||m.provenance_class==='DEMO'||o.demo===true||o.synthetic===true||
     m.demo===true||m.synthetic===true||[o.id,o.asset_id,o.project_id,o.twin_id,o.source_file_id,o.assetCode]
     .some(y=>typeof y==='string'&&(y.startsWith('demo_')||y.startsWith('demo:')||y.startsWith('DEMO-SYNTHETIC-'))))return true;
  Object.values(o).forEach(y=>{if(y&&typeof y==='object')work.push(y)});
 }
 return false;
}
export function assertRealWritePayload(root:unknown):void{
 if(containsDemoProvenance(root))throw Object.assign(
  Error('DEMO provenance forbidden in REAL asset, source, review, and lifecycle writes'),{status:422});
}
export function assertDemoFixtureSafe(twin:unknown):void{
 if(!isObject(twin)||twin.provenance_class!=='DEMO'||twin.project_id!=='demo'||twin.twin_id!=='demo_spatial_e101'||
    !Array.isArray(twin.entities)||!Array.isArray(twin.sources))throw Error('DEMO twin identity invalid');
 for(const source of twin.sources)if(!isObject(source)||source.provenance_class!=='DEMO'||source.project_id!=='demo'||
  source.twin_id!==twin.twin_id||!String(source.name||'').includes('DEMO'))throw Error('Nonfictional demo source');
 for(const e of twin.entities){
  if(!isObject(e)||e.provenance_class!=='DEMO'||e.project_id!=='demo'||e.twin_id!==twin.twin_id||
     !String(e.id||'').startsWith('demo_')||e.actor!=='system:demo-seed')throw Error('DEMO asset provenance invalid');
  const m=isObject(e.meta)?e.meta:{};
  if(m.actor!=='system:demo-seed'||m.review_task||m.events||m.hash_chain||m.human_actor||
    m.verified_by||m.approved_by||e.review_task)throw Error('DEMO cannot contain authority actors or review tasks');
  if(m.status!==undefined&&!DEMO_ALLOWED_STATUSES.includes(m.status as typeof DEMO_ALLOWED_STATUSES[number]))
    throw Error('DEMO status above INFERRED_PREDICTED');
  if(!Array.isArray(m.evidence)||m.evidence.length===0)throw Error('DEMO source context missing');
  for(const v of m.evidence)if(!isObject(v)||!String(v.source_file_id||'').startsWith('demo:')||
     v.synthetic!==true||v.actor!=='system:demo-seed')throw Error('DEMO evidence must be fictional');
 }
}
