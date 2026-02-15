import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
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

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Review Scan</h1>
      <p>
        Scan ID: <strong>{scanId ?? '...'}</strong>
      </p>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {!scan ? <p>Loading scan...</p> : null}

      {scan ? (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <p>
            Status: <strong>{scan.status}</strong>
          </p>

          {scan.error ? <p style={{ color: '#b91c1c' }}>Error: {scan.error}</p> : null}
          {scan.ocrText ? <p>OCR text: {scan.ocrText}</p> : null}

          {scan.status === 'PROCESSING' || scan.status === 'QUEUED' ? <p>Processing scan...</p> : null}

          {(scan.frontImageUrl || scan.backImageUrl) ? (
            <section
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                alignItems: 'start',
              }}
            >
              {scan.frontImageUrl ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Uploaded Front</p>
                  <img
                    src={toAbsoluteApiUrl(scan.frontImageUrl) ?? undefined}
                    alt="Uploaded front"
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      borderRadius: '0.5rem',
                      border: '1px solid #ddd',
                    }}
                  />
                </div>
              ) : null}

              {scan.backImageUrl ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Uploaded Back</p>
                  <img
                    src={toAbsoluteApiUrl(scan.backImageUrl) ?? undefined}
                    alt="Uploaded back"
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      borderRadius: '0.5rem',
                      border: '1px solid #ddd',
                    }}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {scan.candidates.length > 0 ? (
            <div>
              <h2>Candidates</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Pick</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Card</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Preview</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Score</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.candidates.map((candidate) => {
                    const previewImageUrl =
                      candidate.sourceHints?.find((hint) => hint.imageUrl)?.imageUrl ?? null;

                    return (
                    <tr key={candidate.id}>
                      <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="radio"
                          name="candidate"
                          checked={selectedCandidateId === candidate.id}
                          onChange={() => setSelectedCandidateId(candidate.id)}
                        />
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', verticalAlign: 'top' }}>
                        {candidate.year ? `${candidate.year} ` : ''}
                        {candidate.player ? `${candidate.player} - ` : ''}
                        {candidate.name}
                        {candidate.set ? ` (${candidate.set})` : ''}
                        {candidate.variant ? ` [${candidate.variant}]` : ''}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', verticalAlign: 'top' }}>
                        {previewImageUrl ? (
                          <img
                            src={previewImageUrl}
                            alt={`${candidate.name} preview`}
                            style={{
                              width: '110px',
                              height: '150px',
                              objectFit: 'cover',
                              borderRadius: '0.5rem',
                              border: '1px solid #ddd',
                              background: '#f3f4f6',
                            }}
                          />
                        ) : (
                          <span style={{ color: '#6b7280' }}>No preview</span>
                        )}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', verticalAlign: 'top' }}>
                        {candidate.score.toFixed(3)}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', verticalAlign: 'top' }}>
                        {candidate.validationScore?.toFixed(3) ?? 'n/a'}
                        {candidate.sourceHints?.length ? (
                          <ul>
                            {candidate.sourceHints.map((hint) => (
                              <li key={`${candidate.id}-${hint.source}-${hint.url}`}>
                                <a href={hint.url} target="_blank" rel="noreferrer">
                                  {hint.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>

              <button type="button" onClick={handleConfirm} disabled={busy || selectedCandidateId === null}>
                {busy ? 'Confirming...' : 'Confirm Candidate'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {confirmed ? (
        <p style={{ color: '#0f766e' }}>
          Card saved (ID: {confirmed}). <Link href="/binder">Open binder</Link>
        </p>
      ) : null}

      <p>
        <Link href="/scan">Scan another</Link>
      </p>
    </main>
  );
}
