import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const {Client}=pg;
const root=process.cwd();
const migrationsDir=path.join(root,'migrations');
const apply=process.argv.includes('--apply');
const files=fs.readdirSync(migrationsDir)
  .filter(name=>/^\d{3}_.+\.sql$/.test(name))
  .sort();

if(!files.length)throw new Error('No STRATUM database migrations found');

const migrations=files.map(name=>{
  const sql=fs.readFileSync(path.join(migrationsDir,name),'utf8');
  const sha256=crypto.createHash('sha256').update(sql).digest('hex');
  return{name,sql,sha256};
});

if(!apply){
  console.log('STRATUM Spatial Verified database migration plan');
  for(const item of migrations)console.log(`- ${item.name}  sha256:${item.sha256.slice(0,12)}…`);
  console.log('\nPlan only. Re-run with --apply and DATABASE_URL to apply this exact chain.');
  process.exit(0);
}

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required when --apply is used');

const client=new Client({
  connectionString:databaseUrl,
  ssl:/sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl)?{rejectUnauthorized:false}:undefined,
});

const LOCK_KEY='stratum-spatial-verified-schema-v1';

try{
  await client.connect();
  await client.query('SELECT pg_advisory_lock(hashtext($1))',[LOCK_KEY]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS stratum_schema_migrations (
      name text PRIMARY KEY,
      sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied=await client.query('SELECT name,sha256 FROM stratum_schema_migrations ORDER BY name');
  const byName=new Map(applied.rows.map(row=>[String(row.name),String(row.sha256)]));

  for(const migration of migrations){
    const previous=byName.get(migration.name);
    if(previous){
      if(previous!==migration.sha256){
        throw new Error(`Applied migration checksum changed: ${migration.name}`);
      }
      console.log(`✓ ${migration.name} already applied`);
      continue;
    }

    console.log(`Applying ${migration.name}…`);
    await client.query(migration.sql);
    await client.query(
      'INSERT INTO stratum_schema_migrations(name,sha256) VALUES($1,$2)',
      [migration.name,migration.sha256],
    );
    console.log(`✓ ${migration.name}`);
  }

  console.log(`\nApplied/verified ${migrations.length} STRATUM database migration(s).`);
}finally{
  if(client){
    try{await client.query('SELECT pg_advisory_unlock(hashtext($1))',[LOCK_KEY]);}catch{}
    await client.end().catch(()=>{});
  }
}
