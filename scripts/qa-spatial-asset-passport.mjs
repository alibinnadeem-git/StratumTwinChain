import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveRegisteredSpatialAsset,spatialAssetDirState} from '../lib/spatial-asset-link.ts';

const assets=[
 {id:'asset-1',asset_code:'LP-1',asset_type:'PANELBOARD',name:'Lighting Panel LP-1',model:'NQ',serial_number:'SN-LP1',location_label:'Electrical Room 101',status:'ACTIVE',system_name:'Lighting',manufacturer_name:'Schneider Electric',latest_event_type:'COMMISSIONED',ledger_network:'stratum-devnet-1',ledger_tx_hash:'0xabc123',ledger_block_height:'142'},
 {id:'asset-2',asset_code:'LP-2',asset_type:'PANELBOARD',name:'Lighting Panel LP-2',model:'NQ',serial_number:'SN-LP2',location_label:'Electrical Room 201',status:'ACTIVE',system_name:'Lighting',manufacturer_name:'Schneider Electric',latest_event_type:'INSTALLED',ledger_network:null,ledger_tx_hash:null,ledger_block_height:null}
];

const explicit=resolveRegisteredSpatialAsset({id:'candidate',name:'PANELBOARD',layer:'L4',meta:{registeredAssetId:'asset-1'}},assets);
assert.equal(explicit?.asset.id,'asset-1');assert.equal(explicit?.method,'EXPLICIT_ID');assert.equal(spatialAssetDirState(explicit).finalized,true);

const label=resolveRegisteredSpatialAsset({id:'cad-1',name:'PANELBOARD LP-1',layer:'L2',meta:{}},assets);
assert.equal(label?.asset.id,'asset-1');assert.equal(label?.method,'IDENTIFIER_IN_LABEL');assert.equal(spatialAssetDirState(label).blockHeight,'142');

const noDir=resolveRegisteredSpatialAsset({id:'cad-2',name:'PANELBOARD LP-2',layer:'L2',meta:{}},assets);
assert.equal(noDir?.asset.id,'asset-2');assert.equal(spatialAssetDirState(noDir).finalized,false);

const unbound=resolveRegisteredSpatialAsset({id:'cad-x',name:'PANELBOARD LP',layer:'L2',meta:{}},assets);
assert.equal(unbound,null,'similar or incomplete labels must not borrow another asset identity or DIR');

const viewer=fs.readFileSync('components/CompiledGraphViewer.tsx','utf8');
const inspector=fs.readFileSync('components/SpatialAssetInspector.tsx','utf8');
const page=fs.readFileSync('app/spatial/page.tsx','utf8');
const experience=fs.readFileSync('components/SpatialExperience.tsx','utf8');
const activity=fs.readFileSync('components/AssetActivityPanel.tsx','utf8');
const approvals=fs.readFileSync('app/api/approvals/route.ts','utf8');
const lifecycle=fs.readFileSync('app/api/lifecycle/route.ts','utf8');
const printableQr=fs.readFileSync('components/PrintableAssetQr.tsx','utf8');
assert.match(page,/SpatialExperience assets=\{assets\}/,'the route must pass registered assets into the single-source Spatial experience');
assert.match(experience,/CompiledGraphViewer registeredAssets=\{assets\}/,'imported project mode must pass registered assets into the interactive viewer');
assert.match(viewer,/SpatialAssetInspector/,'the interactive viewer must use the shared asset inspector');
assert.match(viewer,/groups\.L4\.visible=true/,'default Spatial model must keep direct STRATUM assets visible');
assert.match(viewer,/groups\[e\.layer===\"L4\"\?\"L4\":\"L2\"\]\.add\(root\)/,'direct L4 assets must render as equipment, not marker-only metadata');
assert.match(viewer,/derivedFrom[\s\S]*sourceEntity[\s\S]*continue/,'derived L4 duplicates must not double-render over their source equipment');
assert.match(viewer,/new THREE\.Raycaster\(\)/,'3D asset selection must use scene raycasting');
assert.match(viewer,/addEventListener\(\"pointerdown\",pointerDown\)[\s\S]*addEventListener\(\"pointermove\",pointerMove\)[\s\S]*addEventListener\(\"pointerup\",pointerUp\)[\s\S]*addEventListener\(\"click\",clickPick\)/,'3D selection must support pointer/tap plus native click fallback around OrbitControls');
assert.match(viewer,/Math\.hypot\(ev\.clientX-down\.x,ev\.clientY-down\.y\)>6\)moved=true/,'orbit drags must be detected and not interpreted as asset clicks');
assert.match(viewer,/if\(wasMoved\)\{ignoreNextClick=true;return\}/,'pointer-up after an orbit drag must fail closed without selecting');
assert.match(viewer,/const clickPick=.*selectAt\(ev\)/,'native click fallback must use the same raycast selection path');
assert.match(viewer,/dataset\.clickableAssets/,'rendered clickable asset count must be exposed for release UAT');
assert.match(viewer,/dataset\.selectedAsset=entity\.id/,'raycast selection must expose the selected rendered asset for release UAT');
assert.match(viewer,/interactionProxy/,'rendered assets must have a forgiving 3D hit envelope for desktop and touch selection');
assert.match(viewer,/dataset\.primaryHitX/,'browser UAT must click the actual projected Spatial asset position');
assert.match(viewer,/sprite\.userData\.entity=entity/,'visible equipment labels must select the same asset as the 3D geometry');
assert.match(viewer,/Interactive Spatial model/,'WebGL canvas must remain discoverable for accessibility and UAT');
assert.match(inspector,/Registered asset/);assert.match(inspector,/DIR FINALIZED/);assert.match(inspector,/No finalized DIR yet/);assert.match(inspector,/>Passport</);
assert.match(inspector,/AssetActivityPanel/,'asset click must expose server lifecycle activity');
assert.match(inspector,/Print QR/,'asset click must expose printable registry QR');
assert.match(inspector,/Link asset/,'unbound project equipment must support explicit tenant asset binding');
assert.match(inspector,/LINK THIS OBJECT BEFORE USING LIVE ASSET DATA/);
assert.doesNotMatch(inspector,/DIR.*physical truth established|physical truth.*DIR FINALIZED/i);
assert.match(activity,/\/api\/approvals/,'asset activity must retain the governed approval handoff');
assert.match(activity,/crypto\.subtle\.generateKey/,'approval UI must sign the lifecycle payload in-browser');
assert.match(activity,/Approve & advance DIR/,'pending lifecycle activity must expose an explicit approval action');
assert.match(activity,/Activity/);assert.match(activity,/Evidence/);assert.match(activity,/Approval/);assert.match(activity,/PoVI DIR/,'activity view must make DIR progression explicit');
assert.match(activity,/Add inspection evidence/,'activity view must preserve evidence workflow continuity');
assert.match(lifecycle,/can_approve/);assert.match(lifecycle,/approvals_required/);assert.match(lifecycle,/require_evidence/);
assert.match(approvals,/Separation of duties/);assert.match(approvals,/approvalsRequired/);assert.match(approvals,/getLedger\(\)\.anchor/);
assert.match(approvals,/DIR_FINALITY_SECURES_THE_RECORD_AND_DOES_NOT_INDEPENDENTLY_ESTABLISH_PHYSICAL_TRUTH/);
assert.match(printableQr,/window\.print\(\)/);assert.match(printableQr,/qrToken/);assert.match(printableQr,/Scan to open the asset verification record/);

console.log('✓ spatial asset clicks bind exact tenant identities and preserve activity, governed approval, DIR finality and printable QR continuity');
