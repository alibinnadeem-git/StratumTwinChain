# Spatial release verification — 2026-09-13

Release PR: https://github.com/alibinnadeem-git/StratumTwinChain/pull/23
Code tree: 6ebceb2541e96c50e6a3459d4c8c3a12e3a7056d

## Passed

- Next.js production build, including TypeScript and all 45 routes.
- `qa-annotation-persistence.mjs`: annotation replacement; last-annotation deletion; unrelated sources retained; dangling links removed; atomic storage; quota failure leaves saved state unchanged.
- `qa-mesh-inspection.mjs`: transformed hierarchy; 12 nonoverlapping exploded slots; isolation; repeated updates; exact restoration; unsupported hierarchy guards. These are geometry tests, not rendered WebGL verification.
- `qa-sheet-alignment.mjs`: control-point mapping; rotation/scale; measured elevation; source immutability; repeated calibration without drift; restoration; invalid inputs.
- `qa-asset-access.mjs`: required session; parameterized organization scope; grouped identifier lookup; public evidence visibility. Query dependencies are stubbed; this does not prove live database behavior.
- `qa-compiler-sources.mjs` on supplied private PDFs: electrical 9 pages / 569 base candidates; architectural 79 pages / 6,339 base candidates; civil 11 pages / 178 base candidates. Combined with derived candidates: 7,268 unique source-scoped entities. No private source files are included in the repository.
- Electrical PDF rerun after configuring bundled PDF.js decoders passed with 614 total entities and no previous JBIG2 decoder initialization warnings. The full three-file run preceded the decoder fix.

## Implementation changes

- Sheet boundary inspection with manual room confirmation and undo.
- Two measured control-point calibration, floor/elevation entry and restoration to original sheet coordinates. Alignment remains explicitly unverified pending independent engineering checks.
- PDF geometry preserves aspect ratio; image decoders and their license notices are prepared from the installed dependency during prebuild/predev.
- Source model hierarchy preserved; camera framing no longer modifies source coordinates. Real assets no longer assigned to reference equipment by list index; source model binding requires explicit asset identifiers.
- Registered asset views require session and organization scope.
- Server activity form/history and retry identifiers; delayed history merges instead of overwriting submissions.

## Unresolved release gates

- Production `/api/health`, checked 2026-09-13 23:33 UTC: HTTP 200, `databaseConfigured:false`, `authConfigured:false`, deterministic devnet adapter. Requires a configured database, schema, tenant accounts and authentication secret before live activity verification.
- Live production browser reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, and `Error creating WebGL context`. Requires a WebGL-enabled verification environment. Do not report rendered 3D as passed.
- Browser annotation deletion/restoration and new sheet-review interactions have not passed end to end. The prior preview's temporary access link redirected to Vercel login in this session.
- Full automatic room reconstruction, robust title-block extraction, and automatic multi-sheet registration remain incomplete. Manual boundary confirmation and measured calibration do not fulfill those automatic capabilities.
- Camera QR scanning and server approval/state transitions remain unverified end to end.
- Production promotion has not occurred. Do not merge or promote based only on build or mocked tests.

## Publishing

Local Git push failed because GitHub credentials were unavailable. The connected GitHub app published the release branch successfully. Its Git tree exactly matched the tested local tree above. Customer documents were not committed.
