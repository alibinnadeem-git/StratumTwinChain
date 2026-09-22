# STRATUM Power Spatial Verified — Automatic Spatial Model Recovery

Date: 2026-09-22

Release commit: 3cbb7d5d5c6a8eebe8b15f06e5200e21cf1e4bea

## Problem fixed
The production Spatial route could hide the 3D viewer when the active browser key `stratum_compiled_graph` was missing, even when a real compiled model had previously existed in the same browser.

## Resolution
- Every renderable compiler graph is now stored as the current Spatial graph and protected as last-good browser recovery state.
- Renderable graphs are also protected in IndexedDB.
- Spatial attempts automatic model recovery before deciding that no model exists.
- Recovery prefers graphs with actual renderable entities over zero-entity shells.
- The viewer still does not display a fake/demo project before a real engineering source has produced spatial objects.

## Verification
Full CI passed on PR #67:
- Spatial persistence/recovery conformance
- Spatial asset click and DIR Passport conformance
- TypeScript
- Next.js production build
- Security, accessibility, product/design/UI/QA gates
- Desktop, tablet and mobile browser UAT

Browser UAT explicitly uploads a DXF, protects the model, deletes the active browser graph key, opens /spatial, and requires automatic recovery plus a visible WebGL Spatial model.
