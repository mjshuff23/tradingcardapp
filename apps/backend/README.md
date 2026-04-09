# Backend (NestJS + Prisma)

Backend API for scan jobs, catalog, auth, and CSV imports.

## Modules

- `src/health/*`: `GET /health`
- `src/auth/*`: cookie auth, session lookup, demo-user fallback
- `src/scan/*`: upload scan image, process candidates, confirm card
- `src/catalog/*`: list/get/update cards
- `src/import/*`: CSV card import
- `src/storage/*`: Garage S3-compatible upload and thumbnail storage
- `src/ocr/*`: OCR abstraction layer
- `src/validation/*`: lexical validation scoring utility
- `src/prisma/*`: Prisma service/module

## API Base

Global prefix: `/api/v1` (except `/health`)

Swagger UI:

- `GET /api/docs`

### Scan endpoints

- `POST /api/v1/scans` (multipart fields: `image` required, `backImage` optional)
- `GET /api/v1/scans/:scanId`
- `POST /api/v1/scans/:scanId/confirm`

### Auth endpoints

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Catalog endpoints

- `GET /api/v1/cards?q=&collectionStatus=OWNED|WANTED&queryMode=text|nl&page=1&pageSize=25`
- `GET /api/v1/cards/:cardId`
- `PATCH /api/v1/cards/:cardId`

### Import endpoint

- `POST /api/v1/import/cards/csv` (multipart field: `file`)

CSV columns accepted:

- `name` or `card` (required)
- `set`
- `year`
- `player`
- `variant`
- `sport`
- `collectionStatus` (`OWNED` or `WANTED`)
- `gradeEstimate`
- `imageUrl` or `image_url` (optional: remote image is downloaded and stored in Garage/S3)

## Data Model

Prisma entities now include:

- `User`
- `CardSet`
- `CardDefinition`
- `UserCard`
- `UserWishlist`
- `ScanJob`
- `ScanCandidate`
- `ImportJob`

Enums:

- `CollectionStatus`: `OWNED | WANTED`
- `ScanStatus`: `QUEUED | PROCESSING | NEEDS_REVIEW | CONFIRMED | FAILED`
- `ImportStatus`: `QUEUED | PROCESSING | COMPLETED | FAILED`

## Matching Inputs

Scan ranking uses:

- OCR text (front + optional back)
- web lookup hints (DuckDuckGo by default)
- existing `CardDefinition` rows as a growing local reference set

## Environment

Loaded by `@nestjs/config` from:

- `.env`
- `.env.local`
- `.env.{NODE_ENV}`

Key variables:

- `PORT` (default `3001`)
- `DATABASE_URL`
- `CORS_ORIGIN`
- `NODE_ENV`
- `OCR_PROVIDER` (`tesseract` or `stub`)
- `OCR_LANG` (default `eng`)
- `OCR_DEBUG` (`true` to log OCR worker progress)
- `LOOKUP_PROVIDERS` (default `duckduckgo`; add `google_vision` only if you want cloud reverse image lookup)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PROFILE_BUCKET`, `S3_CARD_BUCKET`, `S3_REGION`

Auth behavior:

- anonymous requests resolve to the seeded demo user for read-only binder/search/detail access
- mutations require the `trading_card_session` HttpOnly cookie
- cookie security is `SameSite=Lax` and `Secure` in production

## Run

From repo root:

```bash
npm run dev -w apps/backend
```

## Quick Manual Test

1. Start infra:

```bash
npm run infra:up
```

2. Run backend:

```bash
npm run dev -w apps/backend
```

3. Open docs:

- `http://localhost:3001/api/docs`

4. Verify health:

```bash
curl http://localhost:3001/health
```

## Prisma

```bash
npm exec -w apps/backend prisma generate
npm exec -w apps/backend prisma migrate dev
```

Hosted bootstrap / seed:

```bash
npm run db:migrate -w apps/backend
npm run db:seed -w apps/backend
```

Hosted / Railway rescue now uses explicit commands instead of hidden startup baseline logic.

Inspect the target database:

```bash
TARGET_DATABASE_URL="postgres://..." npm run db:railway:inspect -w apps/backend
```

If the target still contains the legacy `Card` table, export catalog data, migrate a clean database, then import:

```bash
TARGET_DATABASE_URL="postgres://legacy-db" npm run db:catalog:export -w apps/backend
TARGET_DATABASE_URL="postgres://clean-db" npm exec -w apps/backend prisma migrate deploy
TARGET_DATABASE_URL="postgres://clean-db" npm run db:catalog:import -w apps/backend
```

If the target already matches the current normalized schema and only lacks `_prisma_migrations`, mark the migrations as applied once:

```bash
TARGET_DATABASE_URL="postgres://..." npm run db:railway:mark-applied -w apps/backend
```

`start:prod` now fails fast on migration problems. If `db:railway:inspect` reports `unknown_drift`, treat it as a manual rescue case instead of trying to baseline it during app boot.

Legacy card export to normalized seed data:

```bash
npm run db:export:catalog -w apps/backend
```

Normalized seed data lives in `apps/backend/prisma/seed-data/catalog.json`.
Optional seed images can be placed in `apps/backend/prisma/seed-assets/` and referenced via `seedImagePath`.

## Tests

```bash
npm run test -w apps/backend
npm run typecheck -w apps/backend
```

## Current MVP Caveat

`OcrService` is intentionally replaceable. It now uses Tesseract with light image preprocessing and falls back to filename-based text if OCR fails. You can force fallback mode with `OCR_PROVIDER=stub`.

Current OCR/matching behavior:

- OCR runs multi-pass (multiple preprocessing variants + region crops).
- Front/back OCR hints are merged, with extra region crops for top banner, side text, and card-number strips.
- Structured hints extracted: `year`, `card number`, `brand`, `season`, `set/category` hints where available.
- Candidate scoring is weighted using token overlap + fuzzy similarity + structured hint bonuses.
- Reverse lookup always uses DuckDuckGo and auto-enables Google Vision enrichment when credentials are present.
