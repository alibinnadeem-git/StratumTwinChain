# STRATUM Spatial Verified Semantic State Contract

Status: Release 0 implementation contract

## Purpose

Semantic state must mean the same thing everywhere in STRATUM Spatial Verified. A color, badge or label is never allowed to silently change meaning between Spatial, Work, Verify, Library, field workflows or administrative surfaces.

## Domains

- Trust: PoVI Verified, Field Verified, Surveyed, Scanned, OEM Verified, Source Verified, Live, Stale, Uncertain, Conflicted, Inferred, Predicted, AI Generated, Unverified.
- Hazard: Safe, Advisory, Warning, Critical.
- Uncertainty: Certain, Estimated, Uncertain, Conflicted.
- Operation: Active, Inactive, Degraded, Maintenance, Outage.
- Approval: Approved, Pending approval, Rejected, Not required.
- Connectivity: Online, Syncing, Offline, Conflict.
- Privacy: Public, Internal, Restricted, Private.

## Tone meanings

- verified: positive evidence or an accepted completed state. It never means physical truth solely because cryptographic finality exists.
- info: normal informational or connected state that does not imply approval.
- caution: attention, incompleteness, uncertainty or pending action.
- critical: conflict, rejection, outage, unverified boundary or immediate hazard.
- neutral: intentionally inactive, not-required or ordinary internal state.
- restricted: access-sensitive information.

## Accessibility rules

1. Text labels are mandatory; color is never the sole carrier of meaning.
2. Shared badges include a visible status dot plus a text label.
3. Foreground, background and border values are defined centrally in `app/semantic-tokens.css`.
4. Components must reference semantic states rather than arbitrary color names.
5. New state names must be added to `lib/ui/semantic-state.ts` before being used in product UI.
6. Trust, approval and finality remain separate concepts. In particular, PoVI finality does not by itself establish physical truth or engineering authority.

## Compatibility

Legacy `.proof`, `.pending` and `.status-chip` classes remain supported during Release 0 migration, but their visual treatment inherits the canonical verified, caution and information tokens respectively. New components should use `SemanticBadge` or another shared semantic component directly.
