---
name: spatial-component-explorer
description: Build searchable, selectable 3D component explorers with layers, isolation, exploded views, and source-grounded inspection for infrastructure models.
---

# Spatial Component Explorer

Apply the interaction patterns of Human Atlas and Model X Studio to the user's chosen spatial application. These are reference applications, not AI recognition engines or installable skills themselves.

## Reference applications

- https://github.com/ashemag/human-atlas — system layers, identifier/name search, structure isolation, packed exploded inventory, mobile controls and batched geometry. Application code is MIT; BodyParts3D data is separately CC BY 4.0. Preserve applicable notices if reusing either. Inspect current source and licenses before copying.
- https://github.com/ashemag/model-x-studio — progressive mesh separation, individual-piece inspection and descriptions. No repository code license was listed when inspected on 2026-09-13; its vehicle asset has separate BlendKit terms. Implement interaction concepts independently unless reuse permissions are established. Do not copy its vehicle asset into infrastructure products.

## Engineering workflow

Inspect the existing scene graph and identity model before editing. Preserve nested transforms and original assembled coordinates. Apply explosion as reversible display offsets, recomputed from original positions, never as saved engineering coordinates. Do not reparent meshes during traversal. Separate object identity, mesh identity and verified OEM part identity: a mesh island is not evidence of a service part.

Provide search by names and source identifiers; system/layer visibility; object selection; isolation and restore; accessible keyboard controls; camera focus; and progressive explosion where the geometry supports it. Avoid choosing objects after orbit drags. Fit camera and exploded layouts to actual bounds and viewport; do not claim nonoverlap without testing it. Large inventories need batching or virtualization and stable resource cleanup.

Inspection panels should expose source, identifiers, parameters, description, recorded state and uncertainty. Keep annotation-derived candidates distinct from registered assets. Bind QR and activity submission to actual registered IDs and authorized server workflows. Local drafts and illustrative procedural geometry must be labeled accordingly. PDF/image reconstruction requires its own extraction, scale, alignment and review pipeline; these viewers do not supply that capability.

For STRATUM, use STRATUM Spatial Verified and spatial model terminology, map to the existing L0–L8 framework, and preserve approval/registration/DIR boundaries. Do not modify STRATUM Electric's marketing website unless requested.

Validate selection after filtering, isolate/restore, exact assembled-coordinate restoration at zero explosion, unchanged source data, load failures, no-WebGL fallback and mobile interaction. Report implementation, verified behavior and remaining gaps separately. A build pass does not prove 3D rendering or production deployment.

## ChatGPT boundary

This skill guides implementation and inspection; it does not install a renderer into ordinary chat or change model weights. Use available application/browser tools for live 3D interaction. Confirm skill discovery before claiming an account-wide installation.
