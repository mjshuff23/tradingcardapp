import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CardImage } from '../components/CardImage';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../lib/auth-context';
import { uploadScan } from '../lib/api';

export default function ScanPage() {
  const router = useRouter();
  const { authenticated, loading } = useAuth();
  const [frontImageFile, setFrontImageFile] = useState<File | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!frontImageFile) {
      setFrontPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(frontImageFile);
    setFrontPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [frontImageFile]);

  useEffect(() => {
    if (!backImageFile) {
      setBackPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(backImageFile);
    setBackPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [backImageFile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!frontImageFile) {
      setError('Choose a front image first.');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const result = await uploadScan({
        image: frontImageFile,
        backImage: backImageFile,
      });
      await router.push(`/review/${result.scanId}`);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Head>
        <title>Scan Card | Trading Card App</title>
      </Head>

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Scan Intake"
          title="Upload a card and send it through review."
          description="Scans are private to signed-in collectors now. Guests can still explore the demo binder without creating data."
          actions={
            <Link className="button-ghost" href="/binder">
              Go to binder
            </Link>
          }
        />

        {!loading && !authenticated ? (
          <section className="surface gate-card">
            <h2 className="surface-title">Sign in to create scans</h2>
            <p className="surface-copy">
              Uploads, confirmations, and saved scan jobs now belong to a real user profile. The demo collection stays browse-only.
            </p>
            <div className="action-row">
              <Link className="button" href="/login">
                Log in
              </Link>
              <Link className="button-secondary" href="/signup">
                Create account
              </Link>
            </div>
          </section>
        ) : (
          <div className="two-column">
            <section className="surface">
              <div className="section-header">
                <div>
                  <h2>Image upload</h2>
                  <p className="fine-print">Files go straight to your private scan workspace.</p>
                </div>
              </div>

              <form className="stack" onSubmit={handleSubmit}>
                <div className="upload-field">
                  <span className="fieldset-title">Front image</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setFrontImageFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="helper-text">
                    Required. Use a sharp photo with the full card visible and minimal glare.
                  </p>
                </div>

                <div className="upload-field">
                  <span className="fieldset-title">Back image</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setBackImageFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="helper-text">
                    Optional, but recommended if the back includes card number, year, or brand data.
                  </p>
                </div>

                {error ? <p className="message message--error">{error}</p> : null}

                <div className="action-row">
                  <button className="button" type="submit" disabled={busy}>
                    {busy ? 'Uploading...' : 'Upload and scan'}
                  </button>
                  <Link className="button-secondary" href="/binder">
                    Browse binder
                  </Link>
                </div>
              </form>
            </section>

            <aside className="stack">
              <section className="scan-preview">
                <div className="section-header">
                  <div>
                    <h2>Preview</h2>
                    <p className="fine-print">Quick visual check before upload.</p>
                  </div>
                </div>

                <div className="preview-grid">
                  <div className="preview-frame">
                    <h3>Front</h3>
                    <CardImage alt="Front card preview" src={frontPreview} />
                  </div>
                  <div className="preview-frame">
                    <h3>Back</h3>
                    <CardImage alt="Back card preview" src={backPreview} />
                  </div>
                </div>
              </section>

              <section className="surface">
                <h2 className="surface-title">Best results</h2>
                <p className="surface-copy">
                  Center the card, fill most of the frame, and avoid heavy shadows. The review page
                  will show candidate evidence before anything gets confirmed.
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
