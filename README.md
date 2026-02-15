# Trading Card App

Monorepo for a local-first trading card scanner/catalog app (frontend + backend + infra).

Stack:
- Frontend: Next.js (Pages Router)
- Backend: NestJS + Prisma
- DB: Postgres
- Object storage: Garage (S3-compatible)

Roadmap from MVP to end-state is documented in `roadmap.md`.

## Prerequisites
- Node.js 20+
- npm 11+
- Docker + Docker Compose

## Environment
1. Copy and fill env files:
- `.env.example` -> `.env`
- `apps/backend/.env.example` -> `apps/backend/.env`
- `apps/frontend/.env.example` -> `apps/frontend/.env`

2. Garage config is generated from template:
- Source: `garage.toml.template`
- Generated: `garage.toml` (gitignored)

## Common Commands

### Infra only (db + garage)
```bash
npm run infra:up
```

### Local app dev (backend + frontend on host, infra in docker)
```bash
npm run dev:local
```

### Full docker dev (infra + backend + frontend)
```bash
npm run dev:docker
```

### Full docker dev with rebuild
```bash
npm run dev:docker:build
```

### Stop local infra
```bash
npm run stop:local
```

### Clear stale dev cache/ownership artifacts
```bash
npm run clean:dev-cache
```

## Service Ports
- Frontend: `3000`
- Backend: `3001`
- Postgres (host): `5433`
- Garage S3 API: `3900`
- Garage RPC: `3901`
- Garage Web: `3902`
- Garage Admin API: `3903`

## API Summary (MVP)
Base URL: `http://localhost:3001/api/v1`

- `POST /scans` (multipart upload: `image` required, `backImage` optional)
- `GET /scans/:scanId`
- `POST /scans/:scanId/confirm`
- `GET /cards`
- `GET /cards/:cardId`
- `PATCH /cards/:cardId`
- `POST /import/cards/csv` (multipart CSV upload)

Health endpoint stays outside prefix:
- `GET http://localhost:3001/health`

Swagger docs:
- `GET http://localhost:3001/api/docs`

## Prisma
From repo root:

```bash
npm exec -w apps/backend prisma generate
npm exec -w apps/backend prisma migrate dev
```

## Tests
Backend unit tests:

```bash
npm run test -w apps/backend
```

Typecheck both apps:

```bash
npm run typecheck
```

## Notes
- OCR defaults to `tesseract` in backend (`OCR_PROVIDER=tesseract`) with fallback mode available via `OCR_PROVIDER=stub`.
- Reverse lookup defaults to `duckduckgo` only (`LOOKUP_PROVIDERS=duckduckgo`) to avoid paid cloud usage.
- Scan upload supports `image` (front, required) and `backImage` (optional but recommended).
- Matching now uses weighted scoring with structured OCR hints (`year`, `card number`, `brand`) when available.
- CSV import supports `imageUrl`/`image_url` to fetch card images and store them in Garage/S3.
- Validation hints are currently generated automatically for eBay sold and PSA lookup URLs and surfaced in scan review.
