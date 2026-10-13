# Attestation — Enclosure Family Models & Generator

**From:** Ujjan · **To:** Ali Bin Nadeem / Stratum
**Date:** 2026-10-12 · **Covers:** `stratum-48h-delivery-v2.zip` (E-02, E-03, E-04, E-05, E-06, E-07, E-11, E-12) and the generator `tools/generators/enclosure_family.py` (v0.2.1)

## (a) No OEM geometry

I attest that **no OEM/manufacturer mesh, CAD or BIM geometry was traced,
imported, converted, or re-meshed** into any of these models. Every model is an
in-house generic solid, generated procedurally from axis-aligned box primitives
by `enclosure_family.py`. No vendor model file was opened, referenced as
geometry, or used as a tracing base. Manufacturer-*published dimensions* were
used only as dimensional facts (see (b)); geometry is entirely original.

## (b) Published dimension sources followed, per type

Default dimensions follow published **envelope standards** for each equipment
class — i.e. the standard/typical enclosure envelopes those standards define,
not any single manufacturer SKU drawing. Every dimension is an explicit,
overridable generator parameter; the defaults are intended to be replaced with a
project's actual equipment-schedule / datasheet figures when available. Nothing
is hidden-guessed — unknown values are exposed as parameters with the stated
default below.

| Type | Model | Default W×H×D (m) | Published envelope standard(s) followed |
|------|-------|-------------------|------------------------------------------|
| E-02 | mv_switchgear_2section | 1.8 × 2.3 × 1.5 (2 × 0.9 m sections) | ANSI/IEEE C37.20.2 (metal-clad MV switchgear): section ≈0.66–0.95 m W, ≈2.3 m H, ≈1.5–2.4 m D |
| E-03 | lv_switchgear_3section | 2.4 × 2.3 × 1.5 (3 × 0.8 m sections) | ANSI/IEEE C37.20.1 (LV power switchgear): section ≈0.6–0.9 m W, ≈2.3 m H, ≈1.5 m D |
| E-04 | main_switchboard_2section | 1.5 × 2.28 × 0.9 | UL 891 (switchboards): ≈2.28 m (90") H, ≈0.6–0.9 m D |
| E-05 | distribution_panelboard_600x1800 | 0.6 × 1.8 × 0.25 | NEMA PB 1 / UL 67 (panelboards): box width ≈0.5–0.6 m, height to ≈1.8 m, depth ≈0.1–0.25 m |
| E-06 | branch_panelboard_500x1000 | 0.5 × 1.0 × 0.15 | NEMA PB 1 / UL 67 (panelboards / load centres): narrower/shorter branch envelope |
| E-07 | mcc_2section_5bucket | 1.0 × 2.286 × 0.5 (2 × 0.5 m sections, 5 buckets) | NEMA ICS 18 / UL 845 (MCCs): 20" (0.508 m) sections, 90" (2.286 m) H, ≈0.4–0.5 m D, 6" (152 mm) bucket space-factor increments |
| E-11 | disconnect_switch_60a | 0.3 × 0.45 × 0.18 | NEMA 250 / UL 50 enclosures + UL 98 (enclosed switches): 30–100 A safety-switch envelope |
| E-12 | enclosed_breaker_100a | 0.3 × 0.5 × 0.2 | NEMA 250 / UL 50 enclosures + UL 489 (molded-case breakers): enclosed MCCB envelope |

These are standards-based envelope defaults, not a specific SKU's datasheet; they
should be overridden per the real equipment schedule for a given project.

## (c) Assignment and licence

I, Ujjan, **assign all right, title and interest** in (i) the eight enclosure
models delivered in `stratum-48h-delivery-v2.zip` and (ii) the generator
`enclosure_family.py` **to Stratum**.

- **Models** — licence tier **T1** (in-house, ships by default), owned by and
  assigned to Stratum.
- **Generator (`enclosure_family.py`)** — **Proprietary to Stratum.**
  `Copyright (c) 2026 Stratum. All rights reserved.` Assigned to Stratum; for
  internal Stratum use; **not licensed for external distribution.** This notice
  is also carried in the header of the generator source file.

Signed: **Ujjan**, 2026-10-12.
