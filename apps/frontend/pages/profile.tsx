import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import {
  actionRowClass,
  cn,
  detailGridClass,
  detailItemClass,
  finePrintClass,
  ghostButtonClass,
  hiddenFileInputClass,
  messageClass,
  pageStackClass,
  primaryButtonClass,
  secondaryButtonClass,
  surfaceClass,
  surfaceCopyClass,
  surfaceTitleClass,
} from '../lib/ui';
import { useAuth } from '../lib/auth-context';
import { clearProfileImage, uploadProfileImage } from '../lib/api';

export default function ProfilePage() {
  const { authenticated, loading, refresh, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await uploadProfileImage(file);
      await refresh();
      setMessage('Profile photo updated.');
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await clearProfileImage();
      await refresh();
      setMessage('Profile photo cleared.');
    } catch (clearError) {
      setError((clearError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Head>
        <title>Profile | Trading Card App</title>
      </Head>

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Profile"
          title={authenticated && user ? `${user.username}'s profile` : 'Profile settings'}
          description="Upload a profile photo now, with the storage path already ready for S3-backed collector media."
          actions={
            <div className={actionRowClass}>
              <Link className={ghostButtonClass} href="/binder">
                Back to inventory
              </Link>
            </div>
          }
        />

        {!loading && !authenticated ? (
          <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
            <h2 className={surfaceTitleClass}>Sign in to manage your profile</h2>
            <p className={cn(surfaceCopyClass, 'mt-3')}>
              Profile images live with your private account, so demo mode stays read-only.
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
        ) : null}

        {message ? <p className={messageClass('success')}>{message}</p> : null}
        {error ? <p className={messageClass('error')}>{error}</p> : null}

        {authenticated && user ? (
          <section
            className={cn(
              surfaceClass,
              'grid gap-6 p-6 sm:p-8 lg:grid-cols-[220px_minmax(0,1fr)]',
            )}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-[32px] border border-[var(--border-strong)] bg-[var(--surface-soft)] text-5xl font-semibold text-[var(--text)] shadow-[var(--shadow-sm)]">
                {user.pfpUrl ? (
                  <img className="h-full w-full object-cover" src={user.pfpUrl} alt={`${user.username} profile`} />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <p className={cn(finePrintClass, 'text-center')}>
                Keep your collector identity visible across scans, cards, and future binder sharing.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className={detailGridClass}>
                <div className={detailItemClass}>
                  <strong className="block text-base font-semibold text-[var(--text)]">
                    Username
                  </strong>
                  <span className={cn(finePrintClass, 'mt-2 block')}>{user.username}</span>
                </div>
                <div className={detailItemClass}>
                  <strong className="block text-base font-semibold text-[var(--text)]">
                    Email
                  </strong>
                  <span className={cn(finePrintClass, 'mt-2 block')}>{user.email}</span>
                </div>
              </div>

              <div className={actionRowClass}>
                <label className={secondaryButtonClass}>
                  <input
                    className={hiddenFileInputClass}
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                    disabled={busy}
                  />
                  {busy ? 'Working...' : 'Upload profile photo'}
                </label>
                <button
                  className={ghostButtonClass}
                  type="button"
                  onClick={() => void handleClear()}
                  disabled={busy || !user.pfpUrl}
                >
                  Clear photo
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
