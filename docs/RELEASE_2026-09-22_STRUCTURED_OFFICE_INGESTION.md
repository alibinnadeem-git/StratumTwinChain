# STRATUM Power Spatial Verified — Structured Office Ingestion Release
Date: 2026-09-22

Release commit: d9190187344d0fb190f68552870dbf9225866841

## Included
- Real XLSX equipment-matrix extraction from Office Open XML workbook, relationship, shared-string and worksheet structures.
- Real DOCX specification extraction from Office Open XML tables and paragraphs.
- XLSX/DOCX equipment and specification evidence feeds the existing Expected Power and coordination intelligence layers.
- Extracted Office records remain non-spatial until drawing/BIM geometry establishes placement.
- No Office-derived record may establish as-built geometry, scale, code compliance, engineering approval, AHJ approval, Verified state, DIR finality or PoVI finality.
- Legacy binary XLS remains an explicit adapter state; no structured values are invented.

## Verification
The release passed:
- structured XLSX/DOCX deterministic conformance;
- all pre-existing STRATUM trust, persistence, UI, security and accessibility gates;
- TypeScript;
- Next.js production build;
- desktop/tablet/mobile Playwright UAT using generated real XLSX and DOCX ZIP payloads.

## Next source-format work
- Structured IFC/BIM semantic and placement ingestion.
- Scanned/image-only source recognition as lower-authority review evidence.
- Native/proprietary DWG/RVT adapters.
- Cross-source geometry authority and true clash/dimension review only after coordinate systems are reconciled.
