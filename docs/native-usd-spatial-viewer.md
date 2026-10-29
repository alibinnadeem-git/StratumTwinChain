# STRATUM Spatial Verified — Native OpenUSD in Spatial Viewer

## Supported path

The compiler accepts `.usd`, `.usda`, `.usdc` and `.usdz`. The original source is SHA-256 fingerprinted and retained in STRATUM's browser source archive. The compiled graph stores its source digest and review-only bounds; it does **not** store megabytes of base64 model data or create an intermediate GLB.

The Spatial Viewer loads original bytes with Three.js USDLoader (requires three >=0.183). When the source is not in the current browser archive, a previously verified project-source-vault backup may be restored using the existing source vault UI/server. Library URLs for USD-family formats use the same native loader; the component-library preview is also wired.

## Boundaries

- Native scene rendering does **not** make an imported asset verified physical infrastructure. Original Z, orientation, unit scale and equipment identity remain review-only unless separately confirmed.
- Standalone files and self-contained USDZ are in scope. USD scene layers referencing other external USD files and textures may require their dependencies to be packaged into an accessible asset or USDZ. Missing referenced layers must not silently be treated as exact geometry.
- The browser source archive limit remains **250 MB per file**. It may be smaller in practice due to available storage; this PR does not lift it.
- Preview USD doesn't guarantee OpenUSD behavior such as physics, custom schemas, asset variants or SimReady semantics will survive in Three.js. Preserve original source file and provenance for OpenUSD/simulation.
- The model must be mapped to a source-grounded component and pass the existing library visibility policy. In-house/CC0 visualization assets are allowed; NVIDIA SimReady CC BY 4.0 assets require a retained matching source URL and attribution.
- Rendering in another browser depends on the existing project source vault backup being present and complete. A purely browser-local USD import without a project backup remains local.
- No existing GLB ingestion limit (512 KB embedded snapshot) is raised in this PR. Native USD avoids that embedded-GLB path.

## Verification

Run `npm run qa:native-usd`, `npm run typecheck`, `npm run qa:spatial-viewer` and a browser E2E check with a self-contained USDA/USDZ fixture. Test reload, selection, unit review state, missing archive behavior, legacy GLB and field/physical truth gates. Do not merge if build or acceptance tests are red.
