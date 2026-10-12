// Runner: rewrite DATABASE_URL to the direct endpoint + the app's target DB,
// then delegate to the given script. Keeps the secret out of argv/history.
const script=process.argv[2];
const raw=(process.env.DATABASE_URL||'').trim();
if(!raw){console.error('no DATABASE_URL');process.exit(2);}
const u=new URL(raw);
u.hostname=u.hostname.replace('-pooler','');   // direct endpoint for DDL/locks
u.pathname='/stratum_spatial_verified';          // the database the app resolves to
process.env.DATABASE_URL=u.toString();
await import('./'+script);
