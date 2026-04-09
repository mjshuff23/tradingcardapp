import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
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

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Profile"
          title={authenticated && user ? `${user.username}'s profile` : 'Profile settings'}
          description="Upload a profile photo now, with the storage path already ready for S3-backed collector media."
          actions={
            <div className="action-row">
              <Link className="button-ghost" href="/binder">
                Back to binder
              </Link>
            </div>
          }
        />

        {!loading && !authenticated ? (
          <section className="surface gate-card">
            <h2 className="surface-title">Sign in to manage your profile</h2>
            <p className="surface-copy">
              Profile images live with your private account, so demo mode stays read-only.
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
        ) : null}

        {message ? <p className="message message--success">{message}</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}

        {authenticated && user ? (
          <section className="surface profile-shell">
            <div className="profile-avatar">
              {user.pfpUrl ? <img src={user.pfpUrl} alt={`${user.username} profile`} /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}
            </div>

            <div className="stack">
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Username</strong>
                  <span>{user.username}</span>
                </div>
                <div className="detail-item">
                  <strong>Email</strong>
                  <span>{user.email}</span>
                </div>
              </div>

              <div className="action-row">
                <label className="button-secondary button-file">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                    disabled={busy}
                  />
                  {busy ? 'Working...' : 'Upload profile photo'}
                </label>
                <button className="button-ghost" type="button" onClick={() => void handleClear()} disabled={busy || !user.pfpUrl}>
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
