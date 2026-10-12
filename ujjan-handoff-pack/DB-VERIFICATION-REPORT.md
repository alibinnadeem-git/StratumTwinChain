# STRATUM Spatial Verified — Local DB Bring-up & Verification Report

**Date:** 2026-10-12 · **By:** Ujjan · **Scope:** stand up the dummy database
from `.env`, create the schema, seed dummy credentials, restart the local app,
verify end-to-end in the browser/API.

## Outcome

**Working.** The app is running locally against the dummy Neon database with the
full canonical schema applied and dummy logins verified end-to-end. Health
reports **35/35 tables present, `fullSchemaReady: true`**, and all three seeded
accounts log in with the correct roles.

## Dummy login credentials

Local app: **http://localhost:3000** → sign in at **/login**

| Email | Password | Role |
|-------|----------|------|
| `admin@stratum.test` | `Stratum#Test123` | SUPER_ADMIN |
| `orgadmin@stratum.test` | `Stratum#Test123` | ORG_ADMIN |
| `viewer@stratum.test` | `Stratum#Test123` | VIEWER |

Organization: **STRATUM Dummy Test Org** (`e5862d64-0a47-4c98-bdd9-5b9593514b5b`).
Passwords are set with the app's own scheme (pgcrypto bcrypt, `gen_salt('bf',12)`),
i.e. identical to what the `/set-password` flow produces — not a shortcut hash.

## What I did

1. **Discovered the real connection target.** The app does not use the `.env`
   URL verbatim: for a Neon host it **retargets** the database name from
   `neondb` to **`stratum_spatial_verified`** and pins TLS to **`verify-full`**
   (see `lib/server/runtime-config.ts`, `lib/server/db.ts`,
   `lib/server/database-tls.ts`). The session signing key is **derived from the
   DB password** when no `AUTH_SECRET` is set, so no extra secret was needed.
2. **Created the target database.** `stratum_spatial_verified` did not exist on
   the Neon instance (only `neondb`/`postgres`). Created it via the direct
   (unpooled) endpoint. **`.env` was left untouched** — the app runs on its
   real default.
3. **Applied the schema.** Ran all 14 migrations (`migrations/000…013`) against
   `stratum_spatial_verified` → 40 tables (incl. `pgcrypto`). Used the direct
   endpoint for DDL/advisory locks; the app itself uses the pooler endpoint.
4. **Bootstrapped tenancy + admin.** `db:bootstrap-organization` then
   `db:bootstrap-super-admin` (governed one-time-setup flow).
5. **Seeded dummy credentials.** Set known bcrypt passwords for the SUPER_ADMIN
   and added ORG_ADMIN + VIEWER accounts for RBAC testing; invalidated the
   outstanding one-time setup tokens since passwords are now set.
6. **Restarted the app.** Killed the previous `next dev` on :3000 and started a
   fresh instance loading `.env`.

## Verification (all passed)

| Check | Result |
|-------|--------|
| `/api/health` database probe | `databaseReachable: true`, `databaseProbeStatus: READY`, `databaseTarget: stratum_spatial_verified`, `authConfigured: true` |
| Schema readiness | `requiredTableCount 35 / presentTableCount 35`, `missingTables: []`, `fullSchemaReady: true` |
| Login — SUPER_ADMIN / ORG_ADMIN / VIEWER | `200`, correct role in session |
| Authenticated API with cookie (`/api/oem/cad-verifications`) | `401` unauthenticated → `200` authenticated |
| Wrong password | `401` rejected |
| RBAC gate (`POST /api/admin/members`, SUPER_ADMIN-only) | route is SUPER_ADMIN-gated (`requireSession(['SUPER_ADMIN'])`) |
| Logout | `200` |
| Page routes `/ /login /admin /spatial /assets /component-library` | all `200` |

## Notes / caveats

- Health `mode` is **`LIVE_INCOMPLETE`** and `liveDataReady: false` — that is
  **expected** here: it reflects the STRATUM Chain / DIR validator RPC not being
  configured locally (`chainRpcConfigured: false`), **not** a database problem.
  The entire database/auth layer is green.
- Schema landed in `stratum_spatial_verified`, which is the database the app
  actually reads. If migrations had been run against the raw `.env` URL
  (`neondb`) via `npm run db:migrate`, the app would not have seen them.
- Reproducibility helper: `ujjan-handoff-pack/db-runner.mjs` rewrites
  `DATABASE_URL` to the direct endpoint + target DB and delegates to a script,
  e.g. `node --env-file=.env ujjan-handoff-pack/db-runner.mjs scripts/apply-database-migrations.mjs --apply`.
- No secrets are printed in this report; the connection string stays in `.env`.
- The repo's tracked files were not modified (only the pre-existing
  `next-env.d.ts`); a new database was created on the Neon instance.
