# STRATUM Power — Company Name Migration Note
Date: 2026-09-22

Canonical company name: **STRATUM Power**

The active production tenant retains organization UUID `10000000-0000-4000-8000-000000000001` and all existing project, site, asset, evidence, lifecycle, approval and DIR relationships. The prior empty duplicate STRATUM Power organization was retired, and the active historical tenant was renamed in place from STRATUM Electric to STRATUM Power.

## Identity/domain boundary
Existing user email addresses under `@stratumelectric.com` remain account identifiers until an explicit email/domain migration is approved. Company display name, tenant identity and login email domain are separate concerns.

## Product rule
New UI copy, metadata, documentation, bootstrap defaults and external product references should use **STRATUM Power**. Historical evidence/DIR payloads must not be rewritten merely to change branding; immutable historical records retain their original captured data and provenance.
