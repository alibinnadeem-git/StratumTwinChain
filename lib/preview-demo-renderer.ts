import {normalizeObjectToMeters} from './three-model-normalization';
import {unresolvedAssetVisual} from './unresolved-asset-visual';
/** Only available in preview builds. No persistence or authoritative classification. */
export function makePreviewEquipmentRenderer(ctx:any):(entity:any)=>void{
 const {THREE,loader,registry,renderProvisionalMarker,setModelLoadErrors,interactionProxy,
 tag,groups,label,bounds,renderOrigin,runtime,clickable,isDisposed}=ctx;
 const previewFixtureEquipment=(e:any)=>{
        const tier=String(e.meta?.demoPlacementTier||'');
        const sheetPin=unresolvedAssetVisual(e).kind==='SHEET_PIN';
        if(sheetPin){renderProvisionalMarker(e,'SHEET_PIN');return}
        const key=String(e.meta?.demoComponentKey||'');
        const cfg=registry.find(item=>item.componentKey===key);
        const validLibraryGeometry=Boolean(cfg &&
          ['GLB','GLTF'].includes(cfg.format) &&
          cfg.modelUrl.startsWith('/models/equipment/') &&
          (cfg.modelUrl.endsWith('.glb')||cfg.modelUrl.endsWith('.gltf')) &&
          /^STRATUM-authored geometry/.test(cfg.license||'') &&
          cfg.geometryStatus==='DIMENSIONAL_VISUALIZATION' &&
          cfg.dimensionsMeters?.length===3 &&
          cfg.dimensionsMeters.every((size:number)=>Number.isFinite(size)&&size>0));
        if(!validLibraryGeometry||!cfg){
          setModelLoadErrors(errors=>errors.includes(e.id)?errors:[...errors,e.id]);
          renderProvisionalMarker(e,'GHOST_MARKER');
          return;
        }
        const derived=tier==='DERIVED_Z_CANDIDATE';
        const unresolved=tier==='UNRESOLVED_Z';
        // UI-only visualization plane when Z is missing; no canonical datum is assigned.
        const reviewDisplayZ=unresolved?0:derived?Number(e.meta?.zCandidateMeters):Number(e.z);
        if(!Number.isFinite(reviewDisplayZ)){
          setModelLoadErrors(errors=>errors.includes(e.id)?errors:[...errors,e.id]);
          renderProvisionalMarker(e,'GHOST_MARKER');
          return;
        }
        loader.load(cfg.modelUrl,gltf=>{
          if(isDisposed())return;
          try{
            const target=cfg.dimensionsMeters!;
            const model=gltf.scene;
            model.rotation.set(...cfg.rotation.map(value=>THREE.MathUtils.degToRad(value)) as [number,number,number]);
            // Same library normalization boundary as the production viewer.
            const normalized=normalizeObjectToMeters(model,target,.05);
            const root=new THREE.Group();
            root.position.set(e.x,reviewDisplayZ,e.y);
            root.userData.demo=true;root.userData.synthetic=true;
            root.userData.extras={demo:true,provenance_class:'DEMO'};
            model.userData.extras={demo:true,provenance_class:'DEMO'};
            model.traverse((obj:any)=>{if(obj.isMesh)obj.userData.extras={demo:true,provenance_class:'DEMO'}});
            root.userData.canonicalZ=null;root.userData.physicalTruth=false;
            root.userData.reviewRequired=true;root.userData.authorityEligible=false;
            root.userData.verificationPromotionEligible=false;
            root.userData.takeoffEligible=false;root.userData.measurementEligible=false;
            root.userData.exportEligible=false;
            root.userData.status=String(e.meta?.status||'UNRESOLVED');
            root.userData.visualTier=tier;root.userData.modelComponentKey=key;
            root.userData.modelUrl=cfg.modelUrl;
            root.userData.modelGeometryAuthority='DEMO_REPRESENTATIVE_LIBRARY_MODEL';
            root.userData.normalization={scalar:normalized.scalar,ratioSpread:normalized.ratioSpread,reviewRequired:true};
            const color=unresolved?new THREE.Color(0x8bbcff):new THREE.Color(0xffb74e);
            if(derived||unresolved){
              model.traverse((obj:any)=>{
                if(!obj.isMesh)return;
                const style=(material:any)=>{
                  const copy=material.clone();
                  copy.transparent=true;copy.opacity=unresolved?.22:.5;copy.depthWrite=false;
                  copy.side=THREE.DoubleSide;
                  if(copy.color)copy.color.lerp(color,unresolved?.68:.34);
                  return copy;
                };
                obj.material=Array.isArray(obj.material)?obj.material.map(style):style(obj.material);
              });
            }
            root.add(model);
            const ringColor=unresolved?0x8bbcff:derived?0xffb74e:0x3ed5a9;
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.025,8,32),
              new THREE.MeshBasicMaterial({color:ringColor,transparent:true,opacity:.78,depthTest:false,depthWrite:false}));
            ring.rotation.x=Math.PI/2;ring.position.y=.045;root.add(ring);
            interactionProxy(root,target);tag(root,e);clickable.push(ring);
            groups.L2.add(root);
            label(unresolved?'DEMO · LIBRARY GHOST · Z UNRESOLVED':
              derived?'DEMO · LIBRARY MODEL · DERIVED Z':
              'DEMO · LIBRARY MODEL · STATED Z',
              e.x,reviewDisplayZ,e.y,unresolved?'#8bbcff':derived?'#ffca81':'#8dffd5',e);
            const renderedBox=new THREE.Box3().setFromObject(root);
            if(!renderedBox.isEmpty()){
              renderedBox.translate(new THREE.Vector3(renderOrigin.x,0,renderOrigin.y));
              bounds.union(renderedBox);
            }
            runtime.current?.fit?.();
          }catch(error){
            console.warn('Synthetic demo model unavailable; retaining unplaced review marker',key,error);
            setModelLoadErrors(errors=>errors.includes(e.id)?errors:[...errors,e.id]);
            renderProvisionalMarker(e,'GHOST_MARKER');
          }
        },undefined,()=>{
          if(isDisposed())return;
          setModelLoadErrors(errors=>errors.includes(e.id)?errors:[...errors,e.id]);
          renderProvisionalMarker(e,'GHOST_MARKER');
        });
      };
 return previewFixtureEquipment;
}
