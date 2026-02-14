# Scripts

Helper scripts for local development.

## `project-to-ai.sh`
Creates a snapshot of the repo structure and file contents for sharing.

Usage:
```bash
bash scripts/project-to-ai.sh
```

Output:
- Writes/overwrites `project-dump.txt` in the repo root.
- This file is in `.gitignore`.

## `generate-garage-config.js`
Renders `garage.toml` from `garage.toml.template` using values in `.env`.

Usage:
```bash
npm run garage:config
```

Output:
- Writes `garage.toml` (gitignored).

## `garage-bucket.sh`
Initializes Garage and creates a bucket + access key, then updates local `.env` files.

Usage:
```bash
npm run garage:bucket
```

Notes:
- Requires the Garage container to be running.
- If `S3_ACCESS_KEY`/`S3_SECRET_KEY` are default values, the script generates new ones and writes them to:
  - `.env`
  - `apps/backend/.env`
  - `apps/frontend/.env` (bucket only)

## Root npm helpers
- `npm run infra:up`: render `garage.toml` and start only `db` + `garage`.
- `npm run infra:down`: stop `db` + `garage`.
- `npm run dev:local`: stop app containers, ensure infra is up, then run local Turbo dev.
- `npm run dev:docker`: start full dockerized stack (`db`, `garage`, `backend`, `frontend`).
- `npm run dev:docker:build`: same as above but rebuild app images first.
- `npm run clean:dev-cache`: fixes ownership on stale dev caches (if needed) and removes:
  - `apps/frontend/.next`
  - `apps/backend/dist`
  - `apps/backend/tsconfig.build.tsbuildinfo`
