import {ELECTRICAL_COMPONENTS,resolveElectricalComponent,type ElectricalComponent} from './electrical-component-library.ts';
import {classifyElectricalLabel,type SldEquipmentClass} from './sld-recognition.ts';

// Bridges the two electrical taxonomies so drawing tags/abbreviations the library's alias matcher
// misses still resolve to a library component. `resolveElectricalComponent` (exact alias substring)
// is tried first; if it misses, `classifyElectricalLabel` (tag/abbreviation-savvy coarse class) is
// mapped to a family library key. Bridge matches are lower-confidence review candidates, never truth.

export type LibraryComponentAuthority='ALIAS_EXACT'|'COARSE_CLASS_BRIDGE';
export type LibraryComponentResolution={
  key:string;
  component:ElectricalComponent;
  authority:LibraryComponentAuthority;
  coarseClass:SldEquipmentClass|null;
  confidence:number;
};

// Coarse SLD class -> family library component key. Each target key exists in the library and carries
// representative dimensions, so an identified component has a size for later (Phase 4) sizing/Z work.
export const CLASS_TO_LIBRARY_KEY:Record<SldEquipmentClass,string>={
  UTILITY_SOURCE:'service-entrance',
  GENERATOR_SOURCE:'generator',
  PV_SOURCE:'pv-array',
  BATTERY_SOURCE:'battery-bank',
  UPS:'ups',
  TRANSFORMER:'dry-transformer',
  SWITCHGEAR:'utility-switchgear',
  SWITCHBOARD:'main-switchboard',
  ATS:'ats',
  BREAKER:'mccb',
  MCC:'mcc',
  PDU:'distribution-panel',
  PANEL:'panelboard',
  DISCONNECT:'disconnect',
  VFD:'vfd',
  INVERTER:'solar-inverter',
  EVSE:'evse',
  MOTOR:'motor',
  METER:'power-meter',
};

const COMPONENT_BY_KEY=new Map(ELECTRICAL_COMPONENTS.map(component=>[component.key,component]));

// Precision guard for the fuzzy bridge path: common drawing prose that must never be force-identified
// as equipment. (e.g. classifyElectricalLabel's GEN... rule otherwise matches "GENERAL NOTES".)
// Includes drawing-view/sheet terms (ELEVATION, SECTION, DIAGRAM, ONE-LINE, RISER, PLAN) so a view
// or sheet title like "ELEC SERVICE & ONE-LINE DIAGRAM" is never force-identified as equipment.
const NON_EQUIPMENT_TEXT=/\b(?:GENERAL|NOTES?|LEGEND|SCHEDULES?|TYPICAL|TYP|DETAILS?|KEYNOTES?|ABBREVIATIONS?|SYMBOLS?|SHEET|INDEX|COVER|SPECIFICATIONS?|SCOPE|DRAWINGS?|PLAN|DIAGRAMS?|ELEVATIONS?|SECTIONS?|ONE[-\s]?LINE|RISER|TITLE)\b/i;

const ALIAS_CONFIDENCE=.9;
const BRIDGE_CONFIDENCE=.6;

export function resolveLibraryComponentForLabel(name:string):LibraryComponentResolution|null{
  const text=String(name||'').trim();
  if(!text)return null;
  // Exact alias is high-precision; keep it unguarded so a real equipment label with a descriptive
  // suffix (e.g. "MOTOR · project legend open-vector match") still resolves.
  const exact=resolveElectricalComponent(text);
  if(exact)return{key:exact.key,component:exact,authority:'ALIAS_EXACT',coarseClass:classifyElectricalLabel(text),confidence:ALIAS_CONFIDENCE};
  // The bridge path is fuzzier, so refuse drawing prose / view-sheet titles here before trusting the
  // coarse class (e.g. "ELEC SERVICE & ONE-LINE DIAGRAM" would otherwise match SERVICE).
  if(NON_EQUIPMENT_TEXT.test(text))return null;
  const coarse=classifyElectricalLabel(text);
  if(coarse){
    const key=CLASS_TO_LIBRARY_KEY[coarse];
    const component=key?COMPONENT_BY_KEY.get(key):undefined;
    if(component)return{key:component.key,component,authority:'COARSE_CLASS_BRIDGE',coarseClass:coarse,confidence:BRIDGE_CONFIDENCE};
  }
  return null;
}
