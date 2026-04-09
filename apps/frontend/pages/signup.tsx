import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../lib/auth-context';

export default function SignupPage() {
  const router = useRouter();
  const { authenticated, loading, signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && authenticated) {
      void router.replace('/binder');
    }
  }, [authenticated, loading, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await signup({ username, email, password });
      await router.push('/binder');
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Head>
        <title>Sign Up | Trading Card App</title>
      </Head>

      <div className="auth-shell fade-up">
        <PageHeader
          eyebrow="Accounts"
          title="Create your own collector profile."
          description="This first pass is lightweight email/password auth with a profile placeholder ready for future S3-backed avatars."
        />

        <section className="surface auth-card">
          <form className="stack" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={24}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {error ? <p className="message message--error">{error}</p> : null}

            <div className="action-row">
              <button className="button" type="submit" disabled={busy}>
                {busy ? 'Creating account...' : 'Create account'}
              </button>
              <Link className="button-ghost" href="/login">
                Already have one?
              </Link>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
