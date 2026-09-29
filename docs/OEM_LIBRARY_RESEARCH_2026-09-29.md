# OEM component library research — 29 September 2026

## Delivered scope

This is a bounded expansion of official OEM discovery and acquisition records, not an exhaustive inventory of every OEM or product. The catalog now contains 62 source records across 45 manufacturer/brand labels (including sub-brands), 24 exact product/configuration acquisition records, and four downloaded-file inspections. The existing one approved exact OEM GLB is unchanged. No new OEM geometry is activated by this update.

Added 29 sources and 18 product/configuration acquisition records. Source URLs, formats, access caveats and class links are in `lib/oem-research-sources.ts` and `lib/oem-research-candidates.ts`. Existing records were preserved; only new sources and the ChargePoint download routes receive a 2026-09-29 check date. The catalog update date does not imply every older record was revalidated.

## Coverage added

- Distribution and protection: Eaton CoSPEC and Bussmann, Siemens TIP, Schneider multi-format CAD, Socomec.
- Enclosures, racks and cable support: Rittal, nVent HOFFMAN, Panduit, Legrand Cablofil.
- Generation: Generac, Rehlko, Caterpillar SpecSizer BIM.
- HVAC and pumps: Carrier, Daikin Applied, Greenheck, Xylem, Wilo, Belimo, Danfoss, Johnson Controls ENVIRO-TEC.
- Controls and motors: WAGO, ABB Baldor-Reliance, SEW-EURODRIVE, Rockwell Automation, Littelfuse.
- Lighting and wiring devices: Acuity Brands and Hubbell Wiring Device-Kellems.
- EV charging: ChargePoint STEP packages and exact CT4000 mounting variants.

Manufacturer pages are the primary evidence. Format lists describe what the source offers, not a guarantee of all formats for every SKU. Search-index evidence can identify a source even when direct retrieval is blocked; that limitation is recorded, for example nVent HTTP 403. Mechanical products lacking an existing class stay CLASS_PENDING rather than being incorrectly mapped to an electrical cabinet or motor.

## Actual downloaded file evidence

Four STEP payloads were inspected across three successful downloads. Inspection checked signatures and fingerprints, not CAD topology, physical dimensions, units, or installation applicability. ChargePoint configurations come from the archive filenames and still require exact configuration review. Hashes are retained as `downloadInspection`, not the tenant-vault `sourceSha256` approval field.

| File | Bytes | SHA-256 |
|---|---:|---|
| CP6323B-L5.5-WallMountCMK.STEP | 147875487 | ae29ce59ce657c08c79d37b599cc6cb363b878e50d56acfc040df906c9bf3c5e |
| CP6321B-L5.5-6ftCMK.STEP | 131734711 | 3fb8fcfee546b6f2da85862c99b628c9edd23e08c0c4808390ff378ea96952ca |
| CPE250_2-arm_ID_Master_Skins_NA_01102020.STEP | 457902273 | 784ea50faba345c37d26d97f8a1e71e2e5a059ee2e2fb1ffa2e45c181b769e2c |
| bus-ele-cd-bspd48rj45.stp | 1697045 | 8242f595a6d5d21e814a05487a0790f12e20bdb91e563af2018735bd7c204398 |

Reacquisition URLs:

- CP6000: https://www.chargepoint.com/download-file/step-cp6000-commerical — archive SHA-256 `4e9cbedf96527df6c5e0f7d5bd79937ff8475411afdcaf6778fb22f9ef9eba2b`; contains nested wall and pedestal archives.
- Express 250: https://www.chargepoint.com/download-file/3d-cad-model-step-express — archive SHA-256 `04cedd88b31149d895df160b17beffff04d76ff1f9307476874cab05189c140e`.
- Eaton: https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/cad-drawing-library/bus-ele-cd-bspd48rj45.stp

The Eaton header names DEHN+SOEHNE and DPA M CLE RJ45B, while the download table lists BSPD48RJ45. This may have a legitimate supplier explanation, but it is unresolved. Do not promote it as an exact identity match. Some other Eaton legacy links returned 403 or point to old editor paths; avoid treating the entire legacy catalog as downloadable.

The large ChargePoint STEP files require a bounded CAD conversion process, geometry validation, simplification and browser performance checks. Merely changing the extension to GLB is not conversion.

Original downloads were temporary inspection inputs, not uploaded to the application's tenant vault or committed to the public repository. Their redistribution permission was not established. Public download availability alone is not a reusable-model license.

## Remaining acquisition boundaries

- Kempower, Alpitronic, Delta and Tesla remain represented by existing product references; this pass did not establish a reusable official CAD/GLB download for them. This is not proof that none exists.
- Hitachi Energy, GE Vernova, Cummins, solar/storage OEMs and other configured equipment still need exact model-specific acquisition beyond the existing source entries.
- Partner portals, forms and account requirements were not bypassed. No registration, contact submission or OEM outreach was performed.
- New records remain CAD_DOWNLOAD_IDENTIFIED even when a temporary file inspection exists. Exact identity/revision, units, reuse rights and tenant-vault import are separate gates; validated GLB conversion and approval must precede activation.
- Library geometry does not establish installed equipment, project coordinates, Z elevations or maintenance history.

## Verification

Run `npm run qa:oem-cad-registry`, `npm run qa:spatial-viewer`, `npm run qa:oem-cad-verification`, `npm run typecheck`, `npm run build`, and the component-library scenarios in `tests/e2e/spatial-viewer.spec.ts`. The new browser scenario checks that the Eaton discrepancy is visible and remains blocked, and that the ChargePoint direct-download route is exposed.
