# Copilot Instructions for Trading Card App

## Scope
Local-first trading card scanner & catalog app (monorepo: NestJS backend, Next.js frontend, Prisma ORM, PostgreSQL, Garage S3).

## Key Frameworks & Patterns
- **Backend:** NestJS (feature-driven modules), Prisma ORM, class-validator/transformer
- **Frontend:** Next.js Pages Router, React Context (auth, theme), Tailwind CSS
- **Testing:** Jest (backend only, ts-jest preset)
- **Build:** Turbo monorepo, workspace scripts via npm

## Code Organization
- **Backend modules:** `src/{auth, catalog, scan, ocr, lookup, import, storage, validation, health}/` (controllers → services)
- **Generated code:** `src/generated/prisma/` (auto-generated, skip linting)
- **Frontend:** `pages/` (routes), `components/`, `lib/` (utilities, auth context)

## Conventions
- **Linting:** ESLint + Prettier (backend). Run `npm run lint` (auto-fixes).
- **TypeScript:** Node 22+, strict mode, monorepo tsconfig pattern
- **Env vars:** `.env`, `.env.example`; Prisma requires `DATABASE_URL`; Garage requires `S3_*` keys
- **PRs:** Follow `.github/pull_request_template.md`

## Common Commands
```bash
npm run dev:local           # Local dev (docker infra, host apps)
npm run dev:docker          # Full docker stack
npm run test:backend        # Run backend Jest tests
npm run lint                # Lint all (ESLint + Next.js)
npm run typecheck           # TypeScript check
npm run db:migrate          # Prisma migrate (interactive)
npm run db:seed             # Run seed script
```

## Recommended Prompts
- "Write a NestJS service for [feature] with Prisma queries, following our module pattern"
- "Generate a Next.js page for [feature] using our auth context and Tailwind"
- "Write Jest tests for [module] using our repo's coverage rules (common/ + validation/)"
- "Ensure this code follows ESLint + Prettier rules for [file type]"
- "Review this migration script for best practices with Prisma + PostgreSQL"

## Pitfalls
- **Prisma:** Always run `prisma:generate` before dev/build/test
- **Docker perms:** Use `LOCAL_UID:LOCAL_GID` env vars; run `npm run clean:dev-cache` if ownership breaks
- **Env setup:** Copy `.env.example` and fill S3_* secrets (Garage credentials)
- **Seed data:** Fixtures in `prisma/seed-data/`; be cautious running seeds against production databases

---

If you'd like, I can:
- create `.github/copilot-instructions.md` now (done)
- open a PR with this change
- extend instructions with `applyTo` examples or separate `AGENTS.md` for agent metadata
