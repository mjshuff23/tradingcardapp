# Trading Card App

Monorepo for a local-first trading card scanner/catalog app (frontend + backend + infra).

Stack:

- Frontend: Next.js (Pages Router)
- Backend: NestJS + Prisma
- DB: Postgres
- Object storage: Garage (S3-compatible)

Roadmap from MVP to end-state is documented in `roadmap.md`.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Environment

1. Copy and fill env files:

- `.env.example` -> `.env`
- `apps/backend/.env.example` -> `apps/backend/.env`
- `apps/frontend/.env.example` -> `apps/frontend/.env`

1. Garage config is generated from template:

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

### Terraform scaffold checks

```bash
npm run infra:terraform:fmt
npm run infra:terraform:validate
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

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
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

Auth now uses an HttpOnly cookie named `trading_card_session`. Guests can browse the demo binder, but scans, imports, and card edits require login.

## Prisma

From repo root:

```bash
npm exec -w apps/backend prisma generate
npm run db:migrate -w apps/backend
npm run db:seed -w apps/backend
```

Railway / hosted database rescue is now explicit instead of happening during app startup.

Inspect the target database first:

```bash
TARGET_DATABASE_URL="postgres://..." npm run db:railway:inspect
```

If the database is still on the legacy pre-normalized `Card` table, export the catalog, migrate a clean database, then import:

```bash
TARGET_DATABASE_URL="postgres://legacy-db" npm run db:catalog:export
TARGET_DATABASE_URL="postgres://clean-db" npm exec -w apps/backend prisma migrate deploy
TARGET_DATABASE_URL="postgres://clean-db" npm run db:catalog:import
```

If the database already matches the current normalized Prisma schema and only lacks `_prisma_migrations`, verify the diff is empty and then mark migrations as applied once:

```bash
TARGET_DATABASE_URL="postgres://..." npm run db:railway:mark-applied
```

`start:prod` no longer tries to auto-baseline `P3005` at boot. Partial drift should be treated as a manual rescue task, not something hidden inside deployment startup.

To export legacy local `Card` rows into the normalized catalog seed before a reset:

```bash
npm run db:export:catalog -w apps/backend
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

## AWS / Terraform

Terraform scaffolding for the AWS move now lives in `infra/terraform`.

It provisions:

- one private bucket for profile images
- one private bucket for card media
- versioning, public-access blocks, lifecycle cleanup, and CORS configuration
- IAM policy document outputs scoped to `profiles/`, `user-cards/`, and `canonical-cards/`

Example flow:

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
npm run infra:terraform:fmt
npm run infra:terraform:validate
terraform -chdir=infra/terraform plan
```

Backend env wiring for AWS-compatible storage:

- `S3_ENDPOINT` stays optional so local Garage keeps working
- `S3_PROFILE_BUCKET`
- `S3_CARD_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_REGION`

Operational scripts for media cutover:

```bash
npm run storage:verify -w apps/backend
npm run storage:migrate:s3 -w apps/backend
```

Migration uses the configured target `S3_*` variables and optional `SOURCE_S3_*` variables for the current source storage. Object keys are preserved exactly; legacy HTTP URLs and `local/*` paths are skipped.

## Notes

- OCR defaults to `tesseract` in backend (`OCR_PROVIDER=tesseract`) with fallback mode available via `OCR_PROVIDER=stub`.
- Reverse lookup always includes `duckduckgo`, and automatically layers in `google_vision` when Google Vision credentials are configured.
- Scan upload supports `image` (front, required) and `backImage` (optional but recommended).
- Matching now uses weighted scoring with structured OCR hints (`year`, `card number`, `brand`, `season`, `set`) when available.
- CSV import supports `imageUrl`/`image_url` to fetch card images and store them in Garage/S3.
- Validation now uses lexical scoring; scan review links come from lookup hints (DuckDuckGo/web lookup).
