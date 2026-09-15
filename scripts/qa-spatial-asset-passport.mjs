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
const page=fs.readFileSync('app/spatial/page.tsx','utf8');
assert.match(page,/CompiledGraphViewer registeredAssets=\{assets\}/);
assert.match(viewer,/ASSET PASSPORT PREVIEW/);assert.match(viewer,/DIR FINALIZED/);assert.match(viewer,/NO FINALIZED DIR/);assert.match(viewer,/Open Asset Passport/);
assert.match(viewer,/NOT YET LINKED TO A REGISTERED ASSET/);assert.match(viewer,/DIR finality secures the immutable record; it does not by itself establish physical truth/);
assert.doesNotMatch(viewer,/DIR.*physical truth established|physical truth.*DIR FINALIZED/i);

console.log('✓ spatial asset clicks bind only exact tenant identities and expose DIR-backed Passport context without upgrading physical truth');
