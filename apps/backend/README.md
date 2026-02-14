# Backend (NestJS + Prisma)

Backend API for scan jobs, catalog, and CSV imports.

## Modules
- `src/health/*`: `GET /health`
- `src/scan/*`: upload scan image, process candidates, confirm card
- `src/catalog/*`: list/get/update cards
- `src/import/*`: CSV card import
- `src/storage/*`: Garage S3-compatible upload and thumbnail storage
- `src/ocr/*`: OCR abstraction layer
- `src/validation/*`: automatic validation hints (eBay sold + PSA)
- `src/prisma/*`: Prisma service/module

## API Base
Global prefix: `/api/v1` (except `/health`)

Swagger UI:
- `GET /api/docs`

### Scan endpoints
- `POST /api/v1/scans` (multipart field: `image`)
- `GET /api/v1/scans/:scanId`
- `POST /api/v1/scans/:scanId/confirm`

### Catalog endpoints
- `GET /api/v1/cards?q=&collectionStatus=OWNED|WANTED&page=1&pageSize=25`
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

## Data Model
Prisma entities now include:
- `Card` (+ collection status, confidence, scan linkage, image keys)
- `ScanJob`
- `ScanCandidate`
- `CardReference`
- `ImportJob`

Enums:
- `CollectionStatus`: `OWNED | WANTED`
- `ScanStatus`: `QUEUED | PROCESSING | NEEDS_REVIEW | CONFIRMED | FAILED`
- `ImportStatus`: `QUEUED | PROCESSING | COMPLETED | FAILED`

## Reference Dataset
Seed file:
- `apps/backend/data/card-references.csv`

On startup/first scan, references are loaded into `CardReference` when table is empty.

## Environment
Loaded by `@nestjs/config` from:
- `.env`
- `.env.local`
- `.env.{NODE_ENV}`

Key variables:
- `PORT` (default `3001`)
- `DATABASE_URL`
- `CORS_ORIGIN`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`

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

## Tests
```bash
npm run test -w apps/backend
npm run typecheck -w apps/backend
```

## Current MVP Caveat
`OcrService` is intentionally a replaceable MVP abstraction. It currently uses lightweight extraction logic so the pipeline is stable locally; swap the implementation later for Tesseract/vision models without changing endpoint contracts.
