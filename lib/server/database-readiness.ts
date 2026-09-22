export const DATABASE_CAPABILITY_TABLES={
 core:['organizations','users','memberships','projects','sites','assets'],
 lifecycle:['organizations','users','memberships','projects','sites','assets','lifecycle_events'],
 evidence:['organizations','users','memberships','projects','sites','assets','lifecycle_events','evidence','evidence_files'],
 archive:['organizations','users','memberships','projects','sites','assets','asset_archive_events'],
 spatialPersistence:['organizations','users','memberships','projects','sites','assets','spatial_compilations','spatial_compilation_reviews'],
 powerIntelligence:['organizations','users','memberships','projects','sites','assets','spatial_compilations','power_intelligence_snapshots','expected_power_requirements','power_gap_findings','power_finding_dispositions'],
 attestations:['organizations','users','memberships','projects','sites','assets','lifecycle_events','human_attestations'],
 dirRuntime:['organizations','users','memberships','projects','sites','assets','lifecycle_events','approvals','ledger_records','approval_policies'],
} as const;

export const REQUIRED_DATABASE_TABLES=[...new Set(Object.values(DATABASE_CAPABILITY_TABLES).flat())].sort();

export const DATABASE_READINESS_SQL=`
 SELECT table_name
 FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name = ANY($1::text[])
 ORDER BY table_name
`;

export type DatabaseCapabilityName=keyof typeof DATABASE_CAPABILITY_TABLES;
export type DatabaseReadiness={
 requiredTableCount:number;
 presentTableCount:number;
 missingTables:string[];
 coreReady:boolean;
 lifecycleReady:boolean;
 evidenceReady:boolean;
 archiveReady:boolean;
 spatialPersistenceReady:boolean;
 powerIntelligenceReady:boolean;
 attestationsReady:boolean;
 dirRuntimeReady:boolean;
 fullSchemaReady:boolean;
};

function capabilityReady(present:Set<string>,capability:DatabaseCapabilityName){
 return DATABASE_CAPABILITY_TABLES[capability].every(table=>present.has(table));
}

export function summarizeDatabaseReadiness(tableNames:string[]):DatabaseReadiness{
 const present=new Set(tableNames.map(value=>String(value).trim().toLowerCase()).filter(Boolean));
 const missingTables=REQUIRED_DATABASE_TABLES.filter(table=>!present.has(table));
 const coreReady=capabilityReady(present,'core');
 const lifecycleReady=capabilityReady(present,'lifecycle');
 const evidenceReady=capabilityReady(present,'evidence');
 const archiveReady=capabilityReady(present,'archive');
 const spatialPersistenceReady=capabilityReady(present,'spatialPersistence');
 const powerIntelligenceReady=capabilityReady(present,'powerIntelligence');
 const attestationsReady=capabilityReady(present,'attestations');
 const dirRuntimeReady=capabilityReady(present,'dirRuntime');
 return{
  requiredTableCount:REQUIRED_DATABASE_TABLES.length,
  presentTableCount:REQUIRED_DATABASE_TABLES.length-missingTables.length,
  missingTables,
  coreReady,lifecycleReady,evidenceReady,archiveReady,spatialPersistenceReady,powerIntelligenceReady,attestationsReady,dirRuntimeReady,
  fullSchemaReady:missingTables.length===0,
 };
}
