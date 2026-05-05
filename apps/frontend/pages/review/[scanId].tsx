import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CardImage } from '../../components/CardImage';
import { PageHeader } from '../../components/PageHeader';
import { StatusPill } from '../../components/StatusPill';
import {
  actionRowClass,
  cn,
  finePrintClass,
  ghostButtonClass,
  messageClass,
  pageStackClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeaderClass,
  softSurfaceClass,
  surfaceClass,
  surfaceCopyClass,
  surfaceTitleClass,
} from '../../lib/ui';
import { useAuth } from '../../lib/auth-context';
import { getScan, ScanResponse } from '../../lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function toAbsoluteApiUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `${API_ORIGIN}${url}`;
}

function formatScanStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatCandidateSet(candidate: ScanResponse['candidates'][number]) {
  return candidate.setName ?? candidate.legacySetText ?? candidate.set ?? 'Unknown set';
}

export default function ReviewScanPage() {
  const router = useRouter();
  const { authenticated, loading } = useAuth();
  const scanId = useMemo(() => {
    const raw = router.query.scanId;
    if (!raw) {
      return null;
    }

    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.scanId]);

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || !scanId || Number.isNaN(scanId)) {
      return;
    }

    let stopped = false;

    const fetchScan = async () => {
      try {
        const payload = await getScan(scanId);
        if (stopped) {
          return;
        }

        setScan(payload);
        if (payload.candidates.length > 0 && selectedCandidateId === null) {
          setSelectedCandidateId(payload.candidates[0].id);
        }
      } catch (fetchError) {
        if (!stopped) {
          setError((fetchError as Error).message);
        }
      }
    };

    void fetchScan();

    const poller = setInterval(() => {
      if (
        scan?.status === 'NEEDS_REVIEW' ||
        scan?.status === 'FAILED' ||
        scan?.status === 'CONFIRMED'
      ) {
        return;
      }
      void fetchScan();
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(poller);
    };
  }, [authenticated, scanId, selectedCandidateId, scan?.status]);

  const handleContinue = async () => {
    if (!scanId || selectedCandidateId === null) {
      return;
    }

    try {
      await router.push(`/review/${scanId}/finalize?candidateId=${selectedCandidateId}`);
    } catch (navigationError) {
      setError((navigationError as Error).message);
    }
  };

  const statusTone =
    scan?.status === 'CONFIRMED'
      ? 'success'
      : scan?.status === 'FAILED'
        ? 'danger'
        : scan?.status === 'NEEDS_REVIEW'
          ? 'accent'
          : 'neutral';

  return (
    <AppShell>
      <Head>
        <title>Review Scan | Trading Card App</title>
      </Head>

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Scan Review"
          title={`Review scan ${scanId ?? '...'}`}
          description="Inspect OCR, compare evidence, and confirm the best candidate into your private inventory."
          actions={
            <div className={actionRowClass}>
              <StatusPill label={scan ? formatScanStatus(scan.status) : 'Loading'} tone={statusTone} />
              <Link className={ghostButtonClass} href="/scan">
                Scan another
              </Link>
            </div>
          }
        />

        {!loading && !authenticated ? (
          <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
            <h2 className={surfaceTitleClass}>Sign in to review scans</h2>
            <p className={cn(surfaceCopyClass, 'mt-3')}>
              Scan jobs are tied to user profiles, so guests cannot access review or confirmation
              flows.
            </p>
            <div className={cn(actionRowClass, 'mt-5')}>
              <Link className={primaryButtonClass} href="/login">
                Log in
              </Link>
              <Link className={secondaryButtonClass} href="/signup">
                Create account
              </Link>
            </div>
          </section>
        ) : (
          <>
            {error ? <p className={messageClass('error')}>{error}</p> : null}
            {!scan ? <p className={messageClass()}>Loading scan...</p> : null}

            {scan ? (
              <>
                {scan.error ? <p className={messageClass('error')}>Error: {scan.error}</p> : null}
                {(scan.status === 'PROCESSING' || scan.status === 'QUEUED') ? (
                  <section className={cn(surfaceClass, 'p-6')}>
                    <h2 className={surfaceTitleClass}>Processing scan</h2>
                    <p className={cn(surfaceCopyClass, 'mt-3')}>
                      The backend is still working through OCR and candidate lookup. This page will
                      keep polling until the scan is ready.
                    </p>
                  </section>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="flex flex-col gap-6">
                    <section className={cn(surfaceClass, 'p-5 sm:p-6')}>
                      <div className={sectionHeaderClass}>
                        <div>
                          <h2 className={surfaceTitleClass}>Uploaded images</h2>
                          <p className={cn(finePrintClass, 'mt-2')}>
                            Reference shots used for OCR and match lookup.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4">
                        {scan.frontImageUrl ? (
                          <div className={cn(softSurfaceClass, 'p-4')}>
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                              Front
                            </h3>
                            <CardImage
                              alt="Uploaded front"
                              src={toAbsoluteApiUrl(scan.frontImageUrl) ?? undefined}
                            />
                          </div>
                        ) : null}

                        {scan.backImageUrl ? (
                          <div className={cn(softSurfaceClass, 'p-4')}>
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                              Back
                            </h3>
                            <CardImage
                              alt="Uploaded back"
                              src={toAbsoluteApiUrl(scan.backImageUrl) ?? undefined}
                            />
                          </div>
                        ) : null}
                      </div>

                      {scan.ocrText ? (
                        <details className="mt-5 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                            OCR debug text
                          </summary>
                          <p className={cn(finePrintClass, 'mt-3 whitespace-pre-wrap')}>
                            {scan.ocrText}
                          </p>
                        </details>
                      ) : null}
                    </section>
                  </aside>

                  <section className={cn(surfaceClass, 'p-5 sm:p-6')}>
                    <div className={sectionHeaderClass}>
                      <div>
                        <h2 className={surfaceTitleClass}>Candidates</h2>
                        <p className={cn(finePrintClass, 'mt-2')}>
                          Pick the best match, then continue to the finalize step before the first
                          save.
                        </p>
                      </div>
                      <button
                        className={primaryButtonClass}
                        type="button"
                        onClick={handleContinue}
                        disabled={selectedCandidateId === null}
                      >
                        Continue to finalize
                      </button>
                    </div>

                    {scan.candidates.length > 0 ? (
                      <div className="mt-6 grid gap-4">
                        {scan.candidates.map((candidate) => {
                          const previewImageUrl = toAbsoluteApiUrl(
                            candidate.sourceHints?.find((hint) => hint.imageUrl)?.imageUrl ?? null,
                          );

                          return (
                            <article
                              key={candidate.id}
                              className={cn(
                                softSurfaceClass,
                                'grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)]',
                                selectedCandidateId === candidate.id
                                  ? 'border-[var(--accent)] shadow-[var(--ring)]'
                                  : '',
                              )}
                            >
                              <div className="flex flex-col gap-3">
                                <input
                                  className="h-5 w-5 accent-[var(--accent)]"
                                  type="radio"
                                  name="candidate"
                                  checked={selectedCandidateId === candidate.id}
                                  onChange={() => setSelectedCandidateId(candidate.id)}
                                />
                                <CardImage alt={`${candidate.name} preview`} src={previewImageUrl} />
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-xl font-semibold tracking-[-0.04em] text-[var(--text)] [font-family:var(--font-display)]">
                                  {candidate.name}
                                </h3>
                                <div className="mt-4 grid gap-2 text-sm text-[var(--text-soft)] sm:grid-cols-2">
                                  <span>
                                    <strong className="text-[var(--text)]">Player:</strong>{' '}
                                    {candidate.player ?? 'Unknown'}
                                  </span>
                                  <span>
                                    <strong className="text-[var(--text)]">Year / season:</strong>{' '}
                                    {candidate.season ??
                                      (candidate.year ? String(candidate.year) : 'Unknown')}
                                  </span>
                                  <span>
                                    <strong className="text-[var(--text)]">Brand:</strong>{' '}
                                    {candidate.brand ?? 'Unknown'}
                                  </span>
                                  <span>
                                    <strong className="text-[var(--text)]">Set:</strong>{' '}
                                    {formatCandidateSet(candidate)}
                                  </span>
                                  <span>
                                    <strong className="text-[var(--text)]">Card #:</strong>{' '}
                                    {candidate.cardNumber ? `#${candidate.cardNumber}` : 'Unknown'}
                                  </span>
                                  <span>
                                    <strong className="text-[var(--text)]">Sport:</strong>{' '}
                                    {candidate.sport ?? 'Unknown'}
                                  </span>
                                  {candidate.variant ? (
                                    <span className="sm:col-span-2">
                                      <strong className="text-[var(--text)]">Variant:</strong>{' '}
                                      {candidate.variant}
                                    </span>
                                  ) : null}
                                </div>

                                <div className={cn(actionRowClass, 'mt-4')}>
                                  <StatusPill label={`Match ${candidate.score.toFixed(3)}`} tone="accent" />
                                  <StatusPill
                                    label={`Validation ${
                                      candidate.validationScore?.toFixed(3) ?? 'n/a'
                                    }`}
                                  />
                                  <StatusPill
                                    label={`${candidate.sourceHints?.length ?? 0} evidence links`}
                                  />
                                </div>

                                {candidate.sourceHints?.length ? (
                                  <ul className="mt-4 grid gap-2 text-sm text-[var(--text-soft)]">
                                    {candidate.sourceHints.map((hint) => (
                                      <li key={`${candidate.id}-${hint.source}-${hint.url}`}>
                                        <a
                                          className="underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text)]"
                                          href={hint.url}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          {hint.title}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className={cn(finePrintClass, 'mt-4')}>
                                    No source evidence attached to this candidate.
                                  </p>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={cn(messageClass(), 'mt-6')}>
                        No candidates are available yet. If the scan failed to identify a card, try
                        a sharper photo or include the back image.
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
