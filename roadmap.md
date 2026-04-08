# Product Roadmap: Trading Card Scanner to Community Platform

## Vision

Build a community-driven sports/non-sports trading card platform that starts with a local scan + catalog MVP and evolves into a mobile-first ecosystem with trading, social, and premium AI grading features.

## Product Strategy

- Architecture: modular monolith (NestJS + Prisma + Postgres + Garage S3-compatible storage).
- Delivery path: web-first/API-first now, React Native/Expo clients later reusing backend APIs.
- Monetization path: premium grading and power-user tools after scan/catalog quality is validated.

## Scope Boundaries

### In Scope (near-term)

- Single-user local MVP.
- Card image upload/capture.
- OCR-driven candidate matching with user confirmation.
- Searchable binder and CSV import.

### Out of Scope (near-term)

- Multi-user auth and cloud sync.
- Community feed/chat/trade workflow.
- Billing/subscriptions.
- Native app distribution.

## Phases

## Phase 0 — Baseline (Completed)

Goal: stable local dev stack and infra loop.

Delivered:

- Docker infra for Postgres + Garage.
- Backend health endpoint.
- Frontend/backend connectivity checks.

Exit gate:

- `npm run dev:local` and `npm run dev:docker` run reliably.

## Phase 1 — MVP: Local Scan + Catalog (Current)

Goal: scan -> confirm -> save -> searchable binder.

Scope:

- Single image upload/camera capture.
- OCR text extraction service and candidate ranking.
- Automatic validation hints for eBay sold and PSA lookups.
- User candidate confirmation endpoint.
- Binder list/search/filter.
- CSV import endpoint.
- Single local user model (no auth).

Non-goals:

- Social/community/trade.
- Native mobile app package.
- Paid grading feature.

Exit gate:

- A card can be uploaded, matched, confirmed, saved, and found in binder search.

## Phase 2 — Private Beta Quality + Reliability

Goal: improve scan quality and operational confidence.

Scope:

- Better OCR preprocessing and ranking quality.
- Dedupe improvements and import robustness.
- Timeout/retry/caching strategies for validation adapters.
- Basic observability (errors, latency, job outcomes).
- Optional grading estimate alpha behind feature flag (non-paid).

Exit gate:

- Match precision and failed scan rates meet internal quality targets.

## Phase 3 — Accounts + Cloud Sync

Goal: multi-device user continuity.

Scope:

- Auth and user profiles.
- Cloud sync for cards and scans.
- Signed URL/object access controls.
- Permission model baseline.

Exit gate:

- Users can sign in and access the same binder across devices.

## Phase 4 — Community + Trade

Goal: launch collector-to-collector interaction loops.

Scope:

- Public/private collection sharing.
- Duplicate/wanted lists.
- Trade proposal workflow.
- In-app messaging.

Exit gate:

- End-to-end trade proposal flow is live and moderated.

## Phase 5 — Premium Grading + Monetization

Goal: launch paid value layer.

Scope:

- AI grade estimate v1.
- Premium subscription tier.
- Feature gating, metering, and rate limits.
- Confidence and explainability UX.

Exit gate:

- Paid grading works with billing + supportable SLA.

## Phase 6 — Scale + App Store + Platform

Goal: mobile distribution and platform hardening.

Scope:

- React Native/Expo clients using existing API contracts.
- App Store + Play Store release process.
- Performance tuning, abuse prevention, deeper observability.
- Expanded domain coverage and partner data integrations.

Exit gate:

- Stable mobile app releases with parity for core scan/catalog workflows.

## API/Domain Milestones

- v1 API set (scan/candidates/confirm/cards/import).
- Background scan job lifecycle and status polling.
- Card reference index ingest pipeline.
- Collection status lifecycle (`OWNED`, `WANTED`).
- Scan auditability via original + thumbnail image retention.

## Monetization Milestones

- M0: free local MVP, validate collector workflow.
- M1: premium waitlist and demand capture.
- M2: gated grading alpha.
- M3: paid subscription rollout with limits/quotas.

## Risks and Mitigations

- OCR inaccuracy: keep mandatory user confirmation + manual override.
- External validation fragility: keep adapters non-blocking and timeout-bounded.
- Data model churn: version migrations and keep DTO/API contracts explicit.
- Scope creep: keep Phase 1 strictly scan/catalog/import.

## Assumptions and Defaults

- Local-first MVP remains single-user.
- Web-first implementation precedes native app delivery.
- Validation is automatic but non-blocking for scan completion.
- Initial reference data seeded from curated NBA + Pokemon CSV snapshots.
- Premium grading is intentionally post-MVP.
