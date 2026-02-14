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

- `POST /scans` (multipart image upload)
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
- Scan OCR service is an MVP baseline abstraction and can be swapped for a stronger OCR engine later without changing API contracts.
- Validation hints are currently generated automatically for eBay sold and PSA lookup URLs and surfaced in scan review.
