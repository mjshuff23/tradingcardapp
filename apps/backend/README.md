# Backend (NestJS + Prisma)

This service is a NestJS API using Prisma for database access.

## Structure
- `src/main.ts`: App bootstrap.
- `src/app.module.ts`: Global config + providers.
- `src/prisma/prisma.service.ts`: PrismaClient wrapper (injectable).
- `src/health/health.controller.ts`: `GET /health` endpoint.
- `prisma/schema.prisma`: Data model and datasource URL.
- `prisma/migrations/`: Migration history.

## Environment
Loaded by `@nestjs/config` from:
- `.env`
- `.env.local`
- `.env.{NODE_ENV}`

Required variables (see `.env.example`):
- `DATABASE_URL` (Postgres connection string)
- `PORT` (default `3001`)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` (Garage S3-compatible storage)

## Run
From repo root:

```bash
npm run dev -w apps/backend
```

Health check:
```
http://localhost:3001/health
```

## Prisma Basics

### Generate Client
```bash
npx prisma generate
```

### Create Migrations (recommended)
Tracks schema changes for production use.

```bash
npx prisma migrate dev --name init
```

### Push Schema (no migrations)
Useful for quick prototyping.

```bash
npx prisma db push
```

### Validate Schema
```bash
npx prisma validate
```

### Open Prisma Studio
```bash
npx prisma studio
```

## Why PrismaService?
`PrismaService` extends `PrismaClient` and integrates with NestJS lifecycle hooks so connections open and close cleanly. Import it in other modules to access the database via DI.

## Common Issues
- **Port 5432 already in use**: This repo uses Postgres on `5433`. Check `.env` and `docker-compose.yml`.
- **Prisma schema warning in VS Code**: Pin the Prisma extension to Prisma 6 and set schema path to `apps/backend/prisma/schema.prisma`.
