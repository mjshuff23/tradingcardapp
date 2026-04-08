import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CardImage } from '../../components/CardImage';
import { PageHeader } from '../../components/PageHeader';
import { StatusPill } from '../../components/StatusPill';
import { confirmScan, getScan, ScanResponse } from '../../lib/api';

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

export default function ReviewScanPage() {
  const router = useRouter();
  const scanId = useMemo(() => {
    const raw = router.query.scanId;
    if (!raw) {
      return null;
    }

    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.scanId]);

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<number | null>(null);

  useEffect(() => {
    if (!scanId || Number.isNaN(scanId)) {
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
      if (scan?.status === 'NEEDS_REVIEW' || scan?.status === 'FAILED' || scan?.status === 'CONFIRMED') {
        return;
      }
      void fetchScan();
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(poller);
    };
  }, [scanId, selectedCandidateId, scan?.status]);

  const handleConfirm = async () => {
    if (!scanId || selectedCandidateId === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const card = await confirmScan(scanId, {
        candidateId: selectedCandidateId,
        collectionStatus: 'OWNED',
      });
      setConfirmed(card.id);
      const refreshed = await getScan(scanId);
      setScan(refreshed);
    } catch (confirmError) {
      setError((confirmError as Error).message);
    } finally {
      setBusy(false);
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

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Scan Review"
          title={`Review scan ${scanId ?? '...'}`}
          description="Inspect the OCR result, compare candidates, and confirm the best match into the binder."
          actions={
            <div className="action-row">
              <StatusPill
                label={scan ? formatScanStatus(scan.status) : 'Loading'}
                tone={statusTone}
              />
              <Link className="button-ghost" href="/scan">
                Scan another
              </Link>
            </div>
          }
        />

        {error ? <p className="message message--error">{error}</p> : null}
        {!scan ? <p className="message">Loading scan...</p> : null}

        {scan ? (
          <>
            {scan.error ? <p className="message message--error">Error: {scan.error}</p> : null}
            {confirmed ? (
              <p className="message message--success">
                Card saved (ID: {confirmed}). <Link href="/binder">Open binder</Link>
              </p>
            ) : null}

            {(scan.status === 'PROCESSING' || scan.status === 'QUEUED') ? (
              <section className="surface">
                <h2 className="surface-title">Processing scan</h2>
                <p className="surface-copy">
                  The backend is still working through OCR and candidate lookup. This page will keep polling until the scan is ready.
                </p>
              </section>
            ) : null}

            {(scan.frontImageUrl || scan.backImageUrl) ? (
              <section className="surface">
                <div className="section-header">
                  <div>
                    <h2>Uploaded images</h2>
                    <p className="fine-print">Reference shots used for OCR and match lookup.</p>
                  </div>
                </div>

                <div className="preview-grid">
                  {scan.frontImageUrl ? (
                    <div className="preview-frame">
                      <h3>Front</h3>
                      <CardImage
                        alt="Uploaded front"
                        src={toAbsoluteApiUrl(scan.frontImageUrl) ?? undefined}
                      />
                    </div>
                  ) : null}

                  {scan.backImageUrl ? (
                    <div className="preview-frame">
                      <h3>Back</h3>
                      <CardImage
                        alt="Uploaded back"
                        src={toAbsoluteApiUrl(scan.backImageUrl) ?? undefined}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {scan.ocrText ? (
              <section className="surface">
                <details>
                  <summary>OCR debug text</summary>
                  <p className="helper-text summary-copy">{scan.ocrText}</p>
                </details>
              </section>
            ) : null}

            {scan.candidates.length > 0 ? (
              <section className="surface">
                <div className="section-header">
                  <div>
                    <h2>Candidates</h2>
                    <p className="fine-print">
                      Pick the best match, then confirm it into the collection.
                    </p>
                  </div>
                  <button
                    className="button"
                    type="button"
                    onClick={handleConfirm}
                    disabled={busy || selectedCandidateId === null}
                  >
                    {busy ? 'Confirming...' : 'Confirm candidate'}
                  </button>
                </div>

                <div className="candidate-grid">
                  {scan.candidates.map((candidate) => {
                    const previewImageUrl = toAbsoluteApiUrl(
                      candidate.sourceHints?.find((hint) => hint.imageUrl)?.imageUrl ?? null,
                    );

                    return (
                      <article
                        key={candidate.id}
                        className={`candidate-card${
                          selectedCandidateId === candidate.id ? ' is-selected' : ''
                        }`}
                      >
                        <input
                          className="candidate-radio"
                          type="radio"
                          name="candidate"
                          checked={selectedCandidateId === candidate.id}
                          onChange={() => setSelectedCandidateId(candidate.id)}
                        />

                        <CardImage alt={`${candidate.name} preview`} src={previewImageUrl} />

                        <div>
                          <h3>
                            {candidate.year ? `${candidate.year} ` : ''}
                            {candidate.player ? `${candidate.player} - ` : ''}
                            {candidate.name}
                          </h3>
                          <p className="helper-text">
                            {candidate.set ? `${candidate.set}` : 'Unknown set'}
                            {candidate.variant ? ` · ${candidate.variant}` : ''}
                            {candidate.sport ? ` · ${candidate.sport}` : ''}
                          </p>

                          <div className="candidate-meta">
                            <StatusPill label={`Match ${candidate.score.toFixed(3)}`} tone="accent" />
                            <StatusPill
                              label={`Validation ${
                                candidate.validationScore?.toFixed(3) ?? 'n/a'
                              }`}
                            />
                          </div>

                          {candidate.sourceHints?.length ? (
                            <ul className="evidence-list">
                              {candidate.sourceHints.map((hint) => (
                                <li key={`${candidate.id}-${hint.source}-${hint.url}`}>
                                  <a className="subtle-link" href={hint.url} target="_blank" rel="noreferrer">
                                    {hint.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="helper-text">No source evidence attached to this candidate.</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="surface">
                <div className="empty-state">
                  No candidates are available yet. If the scan failed to identify a card, try a
                  sharper photo or include the back image.
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
