# Frontend (Next.js)

This is a basic Next.js app that will talk to the backend and Garage S3 storage.

## Structure
- `pages/index.tsx`: Home page.
- `next.config.js`: Next.js config (empty placeholder).
- `next-env.d.ts`: Generated Next.js TS types.

## Environment
See `.env.example`:
- `NEXT_PUBLIC_API_URL` (backend base URL)
- `NEXT_PUBLIC_S3_ENDPOINT` (Garage S3 endpoint)
- `NEXT_PUBLIC_S3_BUCKET` (bucket name)

## Run
From repo root:

```bash
npm run dev -w apps/frontend
```

The app runs at:
```
http://localhost:3000
```

## Notes
- `NEXT_PUBLIC_*` env vars are exposed to the browser and must be safe to share.
- S3 credentials should stay on the backend. The frontend only needs the endpoint and bucket name.
