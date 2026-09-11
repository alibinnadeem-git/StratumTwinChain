import {z} from 'zod';
import {eventConstantSchema,hitlLevelSchema,priorityClassSchema,schemaVersionSchema} from '../schema/common';

export const EVENT_REGISTRY_VERSION='STRATUM-EVENT/1' as const;

export const eventDefinitionSchema=z.object({
 eventType:eventConstantSchema,
 eventVersion:schemaVersionSchema,
 subjects:z.array(z.string().min(1)).min(1),
 preconditions:z.array(z.string().min(1)).default([]),
 requiredEvidence:z.array(z.string().min(1)).default([]),
 authority:z.array(hitlLevelSchema).min(1),
 priority:priorityClassSchema,
 effect:z.string().min(1),
 governanceClass:z.enum(['REDBOOK_STARTER','STRATUM_EXTENSION']),
}).strict();

export type EventDefinition=z.infer<typeof eventDefinitionSchema>;

const define=(entry:EventDefinition)=>eventDefinitionSchema.parse(entry);

/** Appendix B starter catalog, transcribed into a machine-readable governed registry. */
export const redbookStarterEventRegistry={
 ASSET_REGISTERED:define({eventType:'ASSET_REGISTERED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['Unique identity'],requiredEvidence:['Asset metadata','Provenance'],authority:['H2','H3'],priority:'P2',effect:'REGISTERED',governanceClass:'REDBOOK_STARTER'}),
 ASSET_RECEIVED:define({eventType:'ASSET_RECEIVED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['REGISTERED'],requiredEvidence:['Receiving evidence','Authenticity evidence'],authority:['H2'],priority:'P2',effect:'RECEIVED',governanceClass:'REDBOOK_STARTER'}),
 ASSET_INSTALLED:define({eventType:'ASSET_INSTALLED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['REGISTERED or RECEIVED'],requiredEvidence:['Installation evidence'],authority:['H2','H3'],priority:'P2',effect:'INSTALLED',governanceClass:'REDBOOK_STARTER'}),
 INSPECTION_COMPLETED:define({eventType:'INSPECTION_COMPLETED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','Work'],preconditions:['Applicable work complete'],requiredEvidence:['Inspection evidence','Inspector identity'],authority:['H3'],priority:'P2',effect:'INSPECTED',governanceClass:'REDBOOK_STARTER'}),
 TEST_PASSED:define({eventType:'TEST_PASSED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['Test prerequisites'],requiredEvidence:['Raw test result','Instrument identity','Calibration evidence'],authority:['H3','H4'],priority:'P2',effect:'TESTED',governanceClass:'REDBOOK_STARTER'}),
 COMMISSIONING_COMPLETED:define({eventType:'COMMISSIONING_COMPLETED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['Required tests complete','Deficiencies closed'],requiredEvidence:['Commissioning package'],authority:['H3','H4'],priority:'P2',effect:'COMMISSIONED',governanceClass:'REDBOOK_STARTER'}),
 ASSET_VERIFIED:define({eventType:'ASSET_VERIFIED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['Required lifecycle evidence'],requiredEvidence:['Approval','Evidence','State validation'],authority:['H3','H4'],priority:'P1',effect:'VERIFIED',governanceClass:'REDBOOK_STARTER'}),
 MAINTENANCE_COMPLETED:define({eventType:'MAINTENANCE_COMPLETED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','WorkOrder'],preconditions:['Approved work order'],requiredEvidence:['Work evidence','Parts evidence','Instrument evidence'],authority:['H2','H3'],priority:'P3',effect:'MAINTAINED',governanceClass:'REDBOOK_STARTER'}),
 CONFIGURATION_CHANGED:define({eventType:'CONFIGURATION_CHANGED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['Authorized current configuration'],requiredEvidence:['Change evidence','Approvals'],authority:['H3','H4'],priority:'P2',effect:'MODIFIED',governanceClass:'REDBOOK_STARTER'}),
 ASSET_RETIRED:define({eventType:'ASSET_RETIRED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['Policy conditions'],requiredEvidence:['Retirement reason','Retirement evidence'],authority:['H3'],priority:'P2',effect:'RETIRED',governanceClass:'REDBOOK_STARTER'}),
 SPATIAL_POSITION_VERIFIED:define({eventType:'SPATIAL_POSITION_VERIFIED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','Spatial'],preconditions:['Evidence hierarchy satisfied'],requiredEvidence:['Survey evidence or scan evidence or field evidence'],authority:['H3'],priority:'P2',effect:'SPATIAL_TRUST_UPDATE',governanceClass:'REDBOOK_STARTER'}),
 INCIDENT_REPORTED:define({eventType:'INCIDENT_REPORTED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Incident'],preconditions:[],requiredEvidence:['Reporter or source','Incident evidence'],authority:['H1','H2'],priority:'P1',effect:'OPEN',governanceClass:'REDBOOK_STARTER'}),
 INCIDENT_CONFIRMED:define({eventType:'INCIDENT_CONFIRMED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Incident'],preconditions:['Incident reported','Evidence available'],requiredEvidence:['Qualified confirmation'],authority:['H3'],priority:'P1',effect:'CONFIRMED',governanceClass:'REDBOOK_STARTER'}),
 LOTO_APPLIED:define({eventType:'LOTO_APPLIED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Safety','Asset'],preconditions:['Permit or JHA/JSA'],requiredEvidence:['Lock/tag evidence','Isolation evidence'],authority:['H3','H4'],priority:'P1',effect:'ISOLATED',governanceClass:'REDBOOK_STARTER'}),
 ZERO_ENERGY_VERIFIED:define({eventType:'ZERO_ENERGY_VERIFIED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Safety','Asset'],preconditions:['LOTO applied'],requiredEvidence:['Instrument result','Calibration evidence'],authority:['H3','H4'],priority:'P1',effect:'ZERO_ENERGY_VERIFIED',governanceClass:'REDBOOK_STARTER'}),
 ENERGIZATION_AUTHORIZED:define({eventType:'ENERGIZATION_AUTHORIZED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['Safety prerequisites','Commissioning prerequisites'],requiredEvidence:['Exact action approval'],authority:['H4','H5'],priority:'P1',effect:'AUTHORIZED',governanceClass:'REDBOOK_STARTER'}),
 PROTECTION_TRIP:define({eventType:'PROTECTION_TRIP',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['Source event'],requiredEvidence:['OPC/source NDIRs'],authority:['H0','H2'],priority:'P1',effect:'OPERATIONAL_EVENT',governanceClass:'REDBOOK_STARTER'}),
 VALIDATOR_ADMISSION_PROPOSED:define({eventType:'VALIDATOR_ADMISSION_PROPOSED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Validator'],preconditions:['Candidate synced'],requiredEvidence:['Identity','Health','Package attestation'],authority:['H5'],priority:'P0',effect:'CANDIDATE',governanceClass:'REDBOOK_STARTER'}),
 VALIDATOR_ACTIVATED:define({eventType:'VALIDATOR_ACTIVATED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Validator'],preconditions:['Governed admission'],requiredEvidence:['Governance proof'],authority:['H5'],priority:'P0',effect:'ACTIVE',governanceClass:'REDBOOK_STARTER'}),
 VALIDATOR_QUARANTINED:define({eventType:'VALIDATOR_QUARANTINED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Validator'],preconditions:['Objective evidence or defined emergency policy'],requiredEvidence:['Fault evidence or equivocation evidence'],authority:['H5'],priority:'P0',effect:'QUARANTINED',governanceClass:'REDBOOK_STARTER'}),
 PROTOCOL_VERSION_SCHEDULED:define({eventType:'PROTOCOL_VERSION_SCHEDULED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Protocol'],preconditions:['Conformance and governance'],requiredEvidence:['Change package','Test package','Security package'],authority:['H5'],priority:'P0',effect:'SCHEDULED',governanceClass:'REDBOOK_STARTER'}),
 POLICY_EXCEPTION_APPROVED:define({eventType:'POLICY_EXCEPTION_APPROVED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Compliance'],preconditions:['Exception request'],requiredEvidence:['Reason','Evidence','Expiry','Compensating control'],authority:['H3','H4'],priority:'P1',effect:'APPROVED_EXCEPTION',governanceClass:'REDBOOK_STARTER'}),
 PROCUREMENT_SUBSTITUTION_APPROVED:define({eventType:'PROCUREMENT_SUBSTITUTION_APPROVED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Commercial','Asset'],preconditions:['Comparison complete'],requiredEvidence:['Technical evidence','Commercial evidence'],authority:['H3','H4'],priority:'P2',effect:'APPROVED_SUBSTITUTION',governanceClass:'REDBOOK_STARTER'}),
} as const;

/**
 * Product extensions preserve current field workflows without pretending the Appendix B starter list is exhaustive.
 * Extensions may add event families but may not redefine Redbook starter meanings.
 */
export const stratumExtensionEventRegistry={
 ASSET_PROCURED:define({eventType:'ASSET_PROCURED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['REGISTERED'],requiredEvidence:['Procurement record'],authority:['H2','H3'],priority:'P2',effect:'PROCURED',governanceClass:'STRATUM_EXTENSION'}),
 ASSET_SHIPPED:define({eventType:'ASSET_SHIPPED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['PROCURED or REGISTERED'],requiredEvidence:['Shipment record'],authority:['H2'],priority:'P2',effect:'SHIPPED',governanceClass:'STRATUM_EXTENSION'}),
 ASSET_CUSTODY_TRANSFERRED:define({eventType:'ASSET_CUSTODY_TRANSFERRED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['Current custodian known'],requiredEvidence:['Custody transfer record'],authority:['H2','H3'],priority:'P2',effect:'CUSTODY_TRANSFERRED',governanceClass:'STRATUM_EXTENSION'}),
 ASSET_ENERGIZED:define({eventType:'ASSET_ENERGIZED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','System'],preconditions:['ENERGIZATION_AUTHORIZED'],requiredEvidence:['Energization evidence'],authority:['H3','H4'],priority:'P1',effect:'ENERGIZED',governanceClass:'STRATUM_EXTENSION'}),
 REPAIR_COMPLETED:define({eventType:'REPAIR_COMPLETED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset','WorkOrder'],preconditions:['Repair work authorized'],requiredEvidence:['Repair evidence'],authority:['H2','H3'],priority:'P2',effect:'REPAIRED',governanceClass:'STRATUM_EXTENSION'}),
 ASSET_REPLACED:define({eventType:'ASSET_REPLACED',eventVersion:EVENT_REGISTRY_VERSION,subjects:['Asset'],preconditions:['Replacement authorized'],requiredEvidence:['Replacement evidence','Replacement asset identity'],authority:['H3'],priority:'P2',effect:'REPLACED',governanceClass:'STRATUM_EXTENSION'}),
} as const;

export const eventRegistry={...redbookStarterEventRegistry,...stratumExtensionEventRegistry} as const;
export type CanonicalEventType=keyof typeof eventRegistry;

export function getEventDefinition(eventType:string):EventDefinition|undefined{
 return eventRegistry[eventType as CanonicalEventType];
}
