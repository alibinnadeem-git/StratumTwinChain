import {z} from 'zod';
import {eventConstantSchema} from '../schema/common';
import type {CanonicalEventType} from './events';

export const assetLifecycleStates=[
 'UNREGISTERED','REGISTERED','PROCURED','SHIPPED','CUSTODY_TRANSFERRED','RECEIVED','INSTALLED',
 'INSPECTED','TESTED','COMMISSIONED','VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','REPAIRED',
 'MODIFIED','REPLACED','RETIRED',
] as const;

export const assetLifecycleStateSchema=z.enum(assetLifecycleStates);
export type AssetLifecycleState=z.infer<typeof assetLifecycleStateSchema>;

export const transitionRuleSchema=z.object({
 eventType:eventConstantSchema,
 subjectType:z.string().min(1),
 allowedFromStates:z.array(assetLifecycleStateSchema).min(1),
 targetState:assetLifecycleStateSchema,
 requiredFinalizedEvents:z.array(eventConstantSchema).default([]),
 terminal:z.boolean().default(false),
 source:z.enum(['REDBOOK_STARTER','IMPLEMENTATION_PROFILE']),
}).strict();

export type TransitionRule=z.infer<typeof transitionRuleSchema>;
const rule=(value:TransitionRule)=>transitionRuleSchema.parse(value);

/**
 * Machine-readable asset state profile. Appendix B supplies the governed events/effects;
 * where the Redbook gives a prose precondition rather than an exact source-state set,
 * this file records the current STRATUM implementation profile explicitly.
 */
export const stateTransitionRegistry:Partial<Record<CanonicalEventType,TransitionRule>>={
 ASSET_REGISTERED:rule({eventType:'ASSET_REGISTERED',subjectType:'Asset',allowedFromStates:['UNREGISTERED'],targetState:'REGISTERED',requiredFinalizedEvents:[],terminal:false,source:'REDBOOK_STARTER'}),
 ASSET_PROCURED:rule({eventType:'ASSET_PROCURED',subjectType:'Asset',allowedFromStates:['REGISTERED'],targetState:'PROCURED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ASSET_SHIPPED:rule({eventType:'ASSET_SHIPPED',subjectType:'Asset',allowedFromStates:['REGISTERED','PROCURED'],targetState:'SHIPPED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ASSET_CUSTODY_TRANSFERRED:rule({eventType:'ASSET_CUSTODY_TRANSFERRED',subjectType:'Asset',allowedFromStates:['REGISTERED','PROCURED','SHIPPED','RECEIVED','INSTALLED','COMMISSIONED','VERIFIED','AUTHORIZED','ENERGIZED'],targetState:'CUSTODY_TRANSFERRED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ASSET_RECEIVED:rule({eventType:'ASSET_RECEIVED',subjectType:'Asset',allowedFromStates:['REGISTERED','PROCURED','SHIPPED','CUSTODY_TRANSFERRED'],targetState:'RECEIVED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'REDBOOK_STARTER'}),
 ASSET_INSTALLED:rule({eventType:'ASSET_INSTALLED',subjectType:'Asset',allowedFromStates:['REGISTERED','RECEIVED','CUSTODY_TRANSFERRED'],targetState:'INSTALLED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'REDBOOK_STARTER'}),
 INSPECTION_COMPLETED:rule({eventType:'INSPECTION_COMPLETED',subjectType:'Asset',allowedFromStates:['INSTALLED','TESTED'],targetState:'INSPECTED',requiredFinalizedEvents:['ASSET_INSTALLED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 TEST_PASSED:rule({eventType:'TEST_PASSED',subjectType:'Asset',allowedFromStates:['INSTALLED','INSPECTED'],targetState:'TESTED',requiredFinalizedEvents:['ASSET_INSTALLED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 COMMISSIONING_COMPLETED:rule({eventType:'COMMISSIONING_COMPLETED',subjectType:'Asset',allowedFromStates:['INSPECTED','TESTED'],targetState:'COMMISSIONED',requiredFinalizedEvents:['ASSET_INSTALLED','INSPECTION_COMPLETED','TEST_PASSED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ASSET_VERIFIED:rule({eventType:'ASSET_VERIFIED',subjectType:'Asset',allowedFromStates:['COMMISSIONED'],targetState:'VERIFIED',requiredFinalizedEvents:['COMMISSIONING_COMPLETED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ENERGIZATION_AUTHORIZED:rule({eventType:'ENERGIZATION_AUTHORIZED',subjectType:'Asset',allowedFromStates:['COMMISSIONED','VERIFIED'],targetState:'AUTHORIZED',requiredFinalizedEvents:['COMMISSIONING_COMPLETED'],terminal:false,source:'REDBOOK_STARTER'}),
 ASSET_ENERGIZED:rule({eventType:'ASSET_ENERGIZED',subjectType:'Asset',allowedFromStates:['AUTHORIZED'],targetState:'ENERGIZED',requiredFinalizedEvents:['ENERGIZATION_AUTHORIZED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 MAINTENANCE_COMPLETED:rule({eventType:'MAINTENANCE_COMPLETED',subjectType:'Asset',allowedFromStates:['VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','REPAIRED','MODIFIED'],targetState:'MAINTAINED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'REDBOOK_STARTER'}),
 REPAIR_COMPLETED:rule({eventType:'REPAIR_COMPLETED',subjectType:'Asset',allowedFromStates:['VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','MODIFIED'],targetState:'REPAIRED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 CONFIGURATION_CHANGED:rule({eventType:'CONFIGURATION_CHANGED',subjectType:'Asset',allowedFromStates:['INSTALLED','COMMISSIONED','VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','REPAIRED','MODIFIED'],targetState:'MODIFIED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'REDBOOK_STARTER'}),
 ASSET_REPLACED:rule({eventType:'ASSET_REPLACED',subjectType:'Asset',allowedFromStates:['INSTALLED','COMMISSIONED','VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','REPAIRED','MODIFIED'],targetState:'REPLACED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:false,source:'IMPLEMENTATION_PROFILE'}),
 ASSET_RETIRED:rule({eventType:'ASSET_RETIRED',subjectType:'Asset',allowedFromStates:['REGISTERED','PROCURED','SHIPPED','CUSTODY_TRANSFERRED','RECEIVED','INSTALLED','INSPECTED','TESTED','COMMISSIONED','VERIFIED','AUTHORIZED','ENERGIZED','MAINTAINED','REPAIRED','MODIFIED','REPLACED'],targetState:'RETIRED',requiredFinalizedEvents:['ASSET_REGISTERED'],terminal:true,source:'REDBOOK_STARTER'}),
};

export function validateStateTransition(args:{eventType:CanonicalEventType;currentState:AssetLifecycleState;finalizedEvents:Iterable<string>}){
 const ruleDef=stateTransitionRegistry[args.eventType];
 if(!ruleDef)return{ok:true as const,rule:null,errors:[] as string[]};
 const events=new Set(args.finalizedEvents);
 const errors:string[]=[];
 if(!ruleDef.allowedFromStates.includes(args.currentState))errors.push(`${args.eventType} is not allowed from ${args.currentState}`);
 for(const required of ruleDef.requiredFinalizedEvents){
  if(!events.has(required))errors.push(`${args.eventType} requires finalized ${required}`);
 }
 return{ok:errors.length===0,rule:ruleDef,errors};
}

/** Deterministic projection helper; only finalized events should be passed in. */
export function deriveAssetLifecycleState(finalizedEvents:Iterable<string>):AssetLifecycleState{
 let state:AssetLifecycleState='UNREGISTERED';
 for(const eventType of finalizedEvents){
  const ruleDef=stateTransitionRegistry[eventType as CanonicalEventType];
  if(ruleDef)state=ruleDef.targetState;
 }
 return state;
}
