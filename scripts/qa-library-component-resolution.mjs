import {resolveLibraryComponentForLabel} from '../lib/library-component-resolution.ts';

// Phase 2 bridge resolver contract. Exact alias wins; tags/abbreviations fall back to the coarse-class
// bridge; non-equipment resolves to nothing (precision guard). Synthetic labels only.
function ok(label,condition){if(!condition)throw new Error('FAIL: '+label);console.log('✓ '+label)}

function expectResolve(name,key,authority){
  const r=resolveLibraryComponentForLabel(name);
  ok(`${name} -> ${key} (${authority})`,Boolean(r)&&r.key===key&&r.authority===authority);
}
function expectNull(name){
  ok(`${name} -> no library component (precision guard)`,resolveLibraryComponentForLabel(name)===null);
}

// Exact alias matches keep ALIAS_EXACT authority (not downgraded to the bridge).
expectResolve('Panelboard LP1','panelboard','ALIAS_EXACT');
expectResolve('MSB','main-switchboard','ALIAS_EXACT');
expectResolve('Dry Transformer','dry-transformer','ALIAS_EXACT');
expectResolve('Automatic Transfer Switch','ats','ALIAS_EXACT');

// Tag/abbreviation labels the alias matcher misses resolve via the coarse-class bridge.
expectResolve('PNL-3','panelboard','COARSE_CLASS_BRIDGE');
expectResolve('XFMR-2','dry-transformer','COARSE_CLASS_BRIDGE');
expectResolve('SWBD-2','main-switchboard','COARSE_CLASS_BRIDGE');
// Abbreviations that ARE library aliases stay exact (alias-first precedence), not downgraded.
expectResolve('MCC-B','mcc','ALIAS_EXACT');

// Non-equipment / unknown labels must not be force-identified.
expectNull('Zubzub Mystery Unit');
expectNull('Room 101');
expectNull('General Notes');
expectNull('');
// Drawing-view / sheet titles that reach the fuzzy bridge path (no exact alias) are refused.
expectNull('ELEC SERVICE & ONE-LINE DIAGRAM');
expectNull('MS - ELEC SERVICE ELEVATION');
expectNull('POWER RISER DIAGRAM');
// Exact-alias labels are not prose-guarded: a real equipment label with a descriptive suffix resolves.
expectResolve('Service Entrance Equipment','service-entrance','ALIAS_EXACT');
expectResolve('MOTOR · project legend open-vector match','motor','ALIAS_EXACT');
// #5: "Fire Alarm" resolves to fire-alarm (not null, and not mis-bridged to panelboard via "...Panel").
expectResolve('Fire Alarm','fire-alarm','ALIAS_EXACT');
expectResolve('Fire Alarm Control Panel','fire-alarm','ALIAS_EXACT');
expectResolve('FACP','fire-alarm','ALIAS_EXACT');

console.log('\nLibrary component bridge resolver contract passed.');
