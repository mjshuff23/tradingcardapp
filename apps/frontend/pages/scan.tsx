import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useState } from 'react';
import { uploadScan } from '../lib/api';

export default function ScanPage() {
  const router = useRouter();
  const [frontImageFile, setFrontImageFile] = useState<File | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Scan Card</h1>
      <p>Use camera capture on phone or upload a photo from desktop.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <label>
          Front image (required)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setFrontImageFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label>
          Back image (optional, recommended)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setBackImageFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Uploading...' : 'Upload and Scan'}
        </button>
      </form>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/binder">Go to binder</Link>
      </p>
    </main>
  );
}
