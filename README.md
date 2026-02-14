# Trading Card App

Local dev setup for a Next.js frontend, NestJS backend, Postgres, and Garage (S3-compatible storage).

## Prerequisites
- Node.js 20+ and npm
- Docker + Docker Compose

## Environment
Fill in `.env` values based on `.env.example`. App-specific env files live in `apps/backend/.env` and `apps/frontend/.env`.

Garage config is rendered locally from `garage.toml.template` using `scripts/generate-garage-config.js` and written to `garage.toml` (gitignored).

## Local Services
Start Postgres and Garage:

```bash
npm run garage:config
docker compose up -d
```

Ports:
- Postgres: `5433` (configurable via `POSTGRES_PORT`)
- Garage S3 API: `3900`
- Garage RPC: `3901`
- Garage Web: `3902`
- Garage Admin API: `3903`

If you rotate Garage tokens, update `.env` and restart the Garage container so the config is re-rendered.

## Install Dependencies
From the repo root:

```bash
npm install
```

## Run Apps
Run both apps via Turbo:

```bash
npm run dev
```

Or run apps individually:

```bash
npm run dev -w apps/backend
npm run dev -w apps/frontend
```

## Prisma
Generate the client:

```bash
npx prisma generate -w apps/backend
```

If you want to create the initial schema in your local database, use either:

```bash
npx prisma migrate dev -w apps/backend
```

or

```bash
npx prisma db push -w apps/backend
```

## Garage Buckets
Garage does not auto-create buckets. You can create one locally with:

```bash
npm run garage:bucket
```

This script creates a bucket and key via the Garage CLI inside the container and updates local `.env` files with the new credentials.
