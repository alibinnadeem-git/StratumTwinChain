# Real drawing reconstruction evidence — Audi Pacific E4.0

Date: 2026-09-19  
Release stream: STRATUM Spatial Verified Sept 19 closure  
Source handling: user-owned Library source; the drawing itself is **not committed to this public repository**.

## Source identity

- Library source name: `for hammad marked esheets 23-5039 Audi Pacific (Binder).pdf`
- SHA-256: `c6b4c02f0b97d6eef947ff57f6863eddd16a6f769c13777af42e113905ded35c`
- Pages: 1
- PDF page geometry observed: 3024 × 2160 points
- Sheet number observed: `E4.0`
- Sheet title observed: `FIRST FLOOR - POWER PLAN`
- Project text observed: `Audi Pacific`
- Issue date observed: `19 Dec. 2023`

## Source-structure preflight

A non-mutating local PDF-structure inspection was run against the exact SHA-256 source before adding regression coverage:

- 46 positioned text spans
- 13,473 vector drawing objects
- 88,305 vector path commands
- 85,993 line commands
- 1,705 curve commands
- 5 line/rectangle closed-vector candidates fall inside the compiler's normalized reconstruction area gate (`0.08 <= area <= 190`)
- 1 source text item matches the electrical asset-candidate vocabulary: `Cannot locate Panel`
- no trustworthy room-label text was present

The drawing therefore has enough real vector content to exercise reconstruction candidate generation, but it does **not** provide source-grounded room labels that would justify automatic room naming.

## Real-source defects found and fixed

The source exposed two parser assumptions that synthetic fixtures did not:

1. `FIRST FLOOR - POWER PLAN` was not recognized by the PDF page-floor resolver.
2. day-first engineering dates such as `19 Dec. 2023` were not recognized by title-block intelligence.

The release now:

- resolves `FIRST FLOOR - POWER PLAN` to an **L1 candidate**;
- resolves equivalent second/third/level/roof plan variants;
- fails closed to `UNRESOLVED` when source floor hints conflict;
- recognizes `19 Dec. 2023` as an issue-date candidate;
- resolves `E4.0` as an electrical sheet candidate;
- keeps title-block identity, floor, alignment, drawing scale, and reconstruction output review-gated.

## Acceptance interpretation

**PASS — source-grounded reconstruction candidate path.**

The expected output for this real sheet is **not** an automatically finalized room. The valid end-to-end behavior is:

`source fingerprint → PDF text/vector extraction → L1 sheet candidate → closed-vector candidates → electrical asset candidate → human review`

Because the sheet lacks a trustworthy room-label association, STRATUM must not guess a room name or mark geometry as validated. That fail-closed outcome is the acceptance condition for this source.

This evidence does **not** establish Verified physical state, DIR finality, PoVI finality, as-built accuracy, or authoritative geometry scale.
