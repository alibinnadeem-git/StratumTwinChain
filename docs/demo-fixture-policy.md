# STRATUM Demo Fixture Policy

Real project drawing sets may be used as named client demonstrations, regression fixtures, and training examples.

## Allowed

A dedicated demo/presentation data layer may contain project-specific display metadata such as:
- project name and address
- source-file and sheet names
- thumbnails/screenshots
- demo narrative and walkthrough steps
- expected QA outcomes
- preselected UI views used only to exhibit the platform

For example, a future Brynhurst client exhibit may explicitly display "5749 Brynhurst" and its real sheet names.

## Not allowed

Project-specific identifiers must never change:
- parsing
- drawing classification
- scale resolution
- coordinate registration
- Z resolution
- terrain reconstruction
- equipment identification
- confidence scoring
- cross-sheet alignment
- placement
- trust/finality behavior

The same source geometry and annotations must produce the same technical result when filenames, project names, addresses, and sheet display labels are changed.

## Architecture rule

Named demo metadata belongs outside the parser/resolver/compiler/viewer decision logic. Runtime engineering behavior must depend only on source evidence and reviewed transforms. Demo content may explain or navigate to that behavior but must not create it.

## Acceptance

A named fixture is considered generalized only when:
1. production logic contains no fixture-name/address/sheet-specific branch;
2. semantic regression tests pass on the real fixture;
3. an equivalent renamed fixture would follow the same code paths;
4. unresolved evidence continues to fail closed.
