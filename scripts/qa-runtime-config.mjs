import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveAuthRuntime,resolveDatabaseRuntime} from '../lib/server/runtime-config.ts';

const KEYS=[
 'DATABASE_URL','POSTGRES_URL','POSTGRES_PRISMA_URL','NEON_DATABASE_URL',
 'DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','STRATUM_DATABASE_NAME',
 'AUTH_SECRET','NEXTAUTH_SECRET','SESSION_SECRET','STRATUM_AUTH_SECRET'
];
const saved=Object.fromEntries(KEYS.map(key=>[key,process.env[key]]));
const clear=()=>{for(const key of KEYS)delete process.env[key]};
try{
 clear();
 assert.equal(resolveDatabaseRuntime(),null);
 assert.equal(resolveAuthRuntime(),null);
 console.log('✓ missing runtime secrets fail closed');

 process.env.DATABASE_URL='postgresql://u:p@db.example.test/original?sslmode=require';
 let db=resolveDatabaseRuntime();
 assert.equal(db?.source,'DATABASE_URL');
 assert.equal(db?.retargeted,false);
 assert.equal(db?.targetDatabase,'original');
 assert.equal(db?.url,process.env.DATABASE_URL);
 console.log('✓ explicit DATABASE_URL remains authoritative and unmodified');

 clear();
 process.env.POSTGRES_URL='postgresql://user:abcdefghijklmnopqrstuvwxyz012345@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require';
 db=resolveDatabaseRuntime();
 assert.equal(db?.source,'POSTGRES_URL');
 assert.equal(db?.retargeted,true);
 assert.equal(db?.targetDatabase,'stratum_spatial_verified');
 assert.equal(new URL(db.url).pathname,'/stratum_spatial_verified');
 assert.equal(new URL(db.url).searchParams.get('sslmode'),'require');
 const derived=resolveAuthRuntime();
 assert.ok(derived);
 assert.equal(derived?.source,'DERIVED_FROM_POSTGRES_URL');
 assert.equal(derived?.derived,true);
 assert.equal(derived?.key.length,32);
 const derivedAgain=resolveAuthRuntime();
 assert.deepEqual([...derived.key],[...derivedAgain.key]);
 console.log('✓ managed Neon URL retargets to isolated Spatial database and yields stable domain-separated session key');

 process.env.STRATUM_DATABASE_NAME='spatial_custom';
 db=resolveDatabaseRuntime();
 assert.equal(db?.targetDatabase,'spatial_custom');
 assert.equal(new URL(db.url).pathname,'/spatial_custom');
 console.log('✓ explicit STRATUM database-name override is honored');

 clear();
 process.env.NEON_DATABASE_URL='postgresql://user:abcdefghijklmnopqrstuvwxyz012345@ep-other.us-east-1.aws.neon.tech/neondb';
 db=resolveDatabaseRuntime();
 assert.equal(db?.source,'NEON_DATABASE_URL');
 assert.equal(new URL(db.url).pathname,'/stratum_spatial_verified');
 console.log('✓ NEON_DATABASE_URL is supported');

 clear();
 process.env.POSTGRES_URL='postgresql://user:abcdefghijklmnopqrstuvwxyz012345@postgres.example.test/neondb';
 db=resolveDatabaseRuntime();
 assert.equal(db?.retargeted,false);
 assert.equal(db?.targetDatabase,null);
 assert.equal(db?.url,process.env.POSTGRES_URL);
 console.log('✓ non-Neon fallback URL is never silently retargeted');

 clear();
 process.env.AUTH_SECRET='A'.repeat(48);
 const direct=resolveAuthRuntime();
 assert.equal(direct?.source,'AUTH_SECRET');
 assert.equal(direct?.derived,false);
 assert.equal(new TextDecoder().decode(direct.key),'A'.repeat(48));
 console.log('✓ dedicated AUTH_SECRET wins when configured');

 const health=fs.readFileSync('app/api/health/route.ts','utf8');
 assert.match(health,/databaseConnectionSource/);
 assert.match(health,/authSecretSource/);
 assert.doesNotMatch(health,/databaseRuntime\?\.url/);
 assert.doesNotMatch(health,/authRuntime\?\.key/);
 console.log('✓ health endpoint exposes source names only, never credential material');

 const auth=fs.readFileSync('lib/server/auth.ts','utf8');
 const dbSource=fs.readFileSync('lib/server/db.ts','utf8');
 assert.match(auth,/resolveAuthRuntime/);
 assert.match(dbSource,/resolveDatabaseRuntime/);
 console.log('✓ database and session runtime paths use the resolver');

 console.log('\nManaged runtime configuration contract passed.');
}finally{
 clear();
 for(const [key,value] of Object.entries(saved))if(value!==undefined)process.env[key]=value;
}
