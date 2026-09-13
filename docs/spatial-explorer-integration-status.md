# Spatial explorer reference integration — 2026-09-13

References inspected through GitHub: ashemag/human-atlas and ashemag/model-x-studio (README and repository trees). Neither contains SKILL.md. Human Atlas documents MIT application code and separately CC BY 4.0 anatomy data; Model X Studio has no listed code license and documents separate model terms. No external application code or model assets were copied.

## Delivered

Viewer commit 1ef8da945cf97cc42dc4e070085d13f1fbbc85a7 adds object search, object isolation/restore, reversible visual mesh offsets, source metadata disclosure and pointer drag-versus-selection handling. Skill commit 5d0c0bcccaafcbc18a4fcbb682355335b7fbff12 adds skills/spatial-component-explorer/SKILL.md. Skill validated with quick_validate.py and copied into this workspace's Codex skills directory. ChatGPT skill catalog did not list it after installation; account-wide activation is unconfirmed.

## Verification

- Local TypeScript and production build passed.
- Vercel viewer preview READY: https://stratumspatialverified-gou8ua8ju-ali-bin-nadeems-projects.vercel.app/spatial (protected).
- In preview browser, uploaded user EV plan and created explicitly labeled temporary QA transformer annotation in browser-local storage. Confirmed annotation reaches Spatial inventory.
- Search for nonexistent object yielded zero; transformer search yielded fixture. Selection displayed correct fixture name and drawing reference.
- Isolation control toggled true. Keyboard End set separation slider to 100. Restore returned isolation false and slider zero.
- Browser WebGL creation failed. Rendered mesh separation, camera framing, source-coordinate restoration in a live scene, touch behavior, and physical-device performance remain unverified.

## Remaining scope

This is initial asset-level exploration, not full parity with the references. Individual mesh identity/inspection and isolation, collision-free packed inventory, batched rendering, source-specific component descriptions, representative OEM models and visual/device verification remain. These reference applications do not perform PDF room reconstruction, sheet alignment or automatic image recognition. Server lifecycle synchronization and registered-asset QR integration remain separate work. No production promotion performed; preview branch retains pre-existing main merge conflicts and unrelated consensus work.

## Follow-up implementation

Personal skill installation has now completed and its active path was verified after ChatGPT reconciliation. It is available as Spatial Component Explorer in the user's skill directory.

Commits 8067b5d6 and 82ecd2be add a model mesh inspection module and viewer controls. Internal mesh identifiers, names, triangle counts, materials, sibling isolation and camera fitting are implemented. Mesh IDs identify traversal entries within the current model, not durable OEM service parts. Full expansion uses bounds-based grid spacing; the helper preserves parent relationships and original transforms. Skinned, instanced, fixed-matrix and nested-mesh hierarchies are excluded from rigid separation. Hidden scene groups cannot be selected by ray picking.

The regression script in commit 2c286e1d passed on a 12-mesh fixture with rotated and nonuniformly scaled ancestors: nonoverlapping full-expansion bounds, repeated-call stability, isolation, exact restoration and unchanged geometry buffers. The production build and TypeScript checks passed. This is geometry-level verification; live WebGL rendering, representative OEM assets, mobile visual layout and performance remain unverified. Packed layouts are per equipment model; this is not a global nonoverlapping inventory of every project asset. GPU batching, source-specific service descriptions, PDF reconstruction/alignment, server lifecycle and production promotion remain outstanding.
