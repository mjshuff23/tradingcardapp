# Frontend (Next.js)

Web client for scan upload/review and binder management.

## Pages
- `/` home + backend health indicator
- `/scan` upload/camera capture flow
- `/review/[scanId]` scan status, candidate review, confirmation
- `/binder` search/filter catalog and CSV import

## API Client
- `lib/api.ts`
- Uses `NEXT_PUBLIC_API_URL` and targets backend routes under `/api/v1`

## Environment
See `.env.example`:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_S3_ENDPOINT`
- `NEXT_PUBLIC_S3_BUCKET`

## Run
From repo root:

```bash
npm run dev -w apps/frontend
```

## Build / Typecheck
```bash
npm run typecheck -w apps/frontend
npm run build -w apps/frontend
```

## Mobile-first Note
The scan page uses browser camera capture (`capture="environment"`) for a phone-friendly upload path while keeping development web-first.
