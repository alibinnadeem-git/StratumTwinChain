import type {CanonicalEventType} from '../registry/events';
import {eventRegistry} from '../registry/events';
import type {AssetLifecycleState} from '../registry/state-transitions';
import {stateTransitionRegistry} from '../registry/state-transitions';
import {microDirSchema,type MicroDIR} from '../schema/records';
import {STRATUM_SCHEMA_VERSION} from '../schema/common';

export const legacyLifecycleEventTypes=[
 'REGISTER_ASSET','PROCURE','SHIP','TRANSFER_CUSTODY','RECEIVE','INSTALL','INSPECT','TEST','COMMISSION',
 'AUTHORIZE_ENERGIZATION','ENERGIZE','MAINTAIN','REPAIR','REPLACE','DECOMMISSION',
] as const;
export type LegacyLifecycleEventType=(typeof legacyLifecycleEventTypes)[number];

export const legacyLifecycleToCanonicalEvent:Record<LegacyLifecycleEventType,CanonicalEventType>={
 REGISTER_ASSET:'ASSET_REGISTERED',
 PROCURE:'ASSET_PROCURED',
 SHIP:'ASSET_SHIPPED',
 TRANSFER_CUSTODY:'ASSET_CUSTODY_TRANSFERRED',
 RECEIVE:'ASSET_RECEIVED',
 INSTALL:'ASSET_INSTALLED',
 INSPECT:'INSPECTION_COMPLETED',
 TEST:'TEST_PASSED',
 COMMISSION:'COMMISSIONING_COMPLETED',
 AUTHORIZE_ENERGIZATION:'ENERGIZATION_AUTHORIZED',
 ENERGIZE:'ASSET_ENERGIZED',
 MAINTAIN:'MAINTENANCE_COMPLETED',
 REPAIR:'REPAIR_COMPLETED',
 REPLACE:'ASSET_REPLACED',
 DECOMMISSION:'ASSET_RETIRED',
};

export function canonicalEventForLegacy(eventType:LegacyLifecycleEventType):CanonicalEventType{
 return legacyLifecycleToCanonicalEvent[eventType];
}

export function createLifecycleMicroDirCandidate(args:{
 microDirId:string;
 tenantId:string;
 organizationId:string;
 projectId:string;
 assetId:string;
 actorRef:string;
 workOrderId?:string|null;
 legacyEventType:LegacyLifecycleEventType;
 eventOccurredAt:string;
 submittedAt:string;
 payloadHash:string;
 currentState:AssetLifecycleState;
 evidenceRefs?:string[];
 sourceRefs?:string[];
}):MicroDIR{
 const eventType=canonicalEventForLegacy(args.legacyEventType);
 const event=eventRegistry[eventType];
 const transition=stateTransitionRegistry[eventType];
 return microDirSchema.parse({
  objectId:args.microDirId,
  objectType:'MDIR',
  schemaVersion:STRATUM_SCHEMA_VERSION,
  tenantId:args.tenantId,
  organizationId:args.organizationId,
  projectId:args.projectId,
  createdAt:args.submittedAt,
  createdBy:args.actorRef,
  updatedAt:args.submittedAt,
  status:'RECEIVED',
  trustClass:'UNVERIFIED',
  sourceRefs:[...(args.sourceRefs||[]),...(args.workOrderId?[args.workOrderId]:[])],
  DIRRefs:[],
  microDirId:args.microDirId,
  eventType,
  eventVersion:event.eventVersion,
  subjectRefs:[args.assetId],
  actorRef:args.actorRef,
  eventOccurredAt:args.eventOccurredAt,
  submittedAt:args.submittedAt,
  acceptedSequence:null,
  priorityClass:event.priority,
  dependencies:transition?.requiredFinalizedEvents||[],
  evidenceRefs:args.evidenceRefs||[],
  NDIRRoots:[],
  NDIRRefs:[],
  payloadHash:args.payloadHash,
  proposedStateTransition:transition?{fromState:args.currentState,toState:transition.targetState}:null,
  signatures:[],
 });
}
