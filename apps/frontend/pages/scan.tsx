import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CardImage } from '../components/CardImage';
import { PageHeader } from '../components/PageHeader';
import {
  actionRowClass,
  cn,
  fieldClass,
  fieldLabelClass,
  finePrintClass,
  ghostButtonClass,
  hiddenFileInputClass,
  messageClass,
  pageStackClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeaderClass,
  softSurfaceClass,
  surfaceClass,
  surfaceCopyClass,
  surfaceTitleClass,
} from '../lib/ui';
import { useAuth } from '../lib/auth-context';
import { uploadScan } from '../lib/api';

type UploadChoiceFieldProps = {
  label: string;
  required?: boolean;
  helperText: string;
  file: File | null;
  onChange: (file: File | null) => void;
};

function UploadChoiceField({
  label,
  required = false,
  helperText,
  file,
  onChange,
}: UploadChoiceFieldProps) {
  return (
    <div className={cn(fieldClass, softSurfaceClass, 'p-5')}>
      <div>
        <span className={fieldLabelClass}>{label}</span>
        {file ? (
          <p className="mt-2 text-sm font-medium text-[var(--text)]">{file.name}</p>
        ) : null}
      </div>
      <p className={finePrintClass}>{helperText}</p>
      <div className={actionRowClass}>
        <label className={secondaryButtonClass}>
          <input
            className={hiddenFileInputClass}
            type="file"
            accept="image/*"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
          Choose photo/files
        </label>
        <label className={ghostButtonClass}>
          <input
            className={hiddenFileInputClass}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
          Use camera
        </label>
        {required ? (
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Required
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Optional
          </span>
        )}
      </div>
    </div>
  );
}

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

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Scan Intake"
          title="Upload a card and send it through review."
          description="Scans are private to signed-in collectors now. Guests can still explore the demo inventory without creating data."
          actions={
            <Link className={ghostButtonClass} href="/binder">
              Go to inventory
            </Link>
          }
        />

        {!loading && !authenticated ? (
          <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
            <h2 className={surfaceTitleClass}>Sign in to create scans</h2>
            <p className={cn(surfaceCopyClass, 'mt-3')}>
              Uploads, confirmations, and saved scan jobs belong to a real user profile. The demo
              collection stays browse-only.
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
              <div className={sectionHeaderClass}>
                <div>
                  <h2 className={surfaceTitleClass}>Image upload</h2>
                  <p className={cn(finePrintClass, 'mt-2')}>
                    Files go straight to your private scan workspace. On mobile, you can now either
                    open your library or jump directly into the camera.
                  </p>
                </div>
              </div>

              <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
                <UploadChoiceField
                  label="Front image"
                  required
                  helperText="Use a sharp photo with the full card visible and minimal glare."
                  file={frontImageFile}
                  onChange={setFrontImageFile}
                />

                <UploadChoiceField
                  label="Back image"
                  helperText="Optional, but recommended if the back includes card number, year, or brand data."
                  file={backImageFile}
                  onChange={setBackImageFile}
                />

                {error ? <p className={messageClass('error')}>{error}</p> : null}

                <div className={actionRowClass}>
                  <button className={primaryButtonClass} type="submit" disabled={busy}>
                    {busy ? 'Uploading...' : 'Upload and scan'}
                  </button>
                  <Link className={secondaryButtonClass} href="/binder">
                    Browse inventory
                  </Link>
                </div>
              </form>
            </section>

            <aside className="flex flex-col gap-6">
              <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                <div className={sectionHeaderClass}>
                  <div>
                    <h2 className={surfaceTitleClass}>Preview</h2>
                    <p className={cn(finePrintClass, 'mt-2')}>
                      Quick visual check before upload.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className={cn(softSurfaceClass, 'p-4')}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Front
                    </h3>
                    <CardImage alt="Front card preview" src={frontPreview} />
                  </div>
                  <div className={cn(softSurfaceClass, 'p-4')}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Back
                    </h3>
                    <CardImage alt="Back card preview" src={backPreview} />
                  </div>
                </div>
              </section>

              <section className={cn(softSurfaceClass, 'p-6')}>
                <h2 className={surfaceTitleClass}>Best results</h2>
                <p className={cn(surfaceCopyClass, 'mt-3')}>
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
