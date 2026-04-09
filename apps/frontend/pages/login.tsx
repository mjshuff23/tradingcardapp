import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, loading, login } = useAuth();
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
      await login({ email, password });
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
        <title>Log In | Trading Card App</title>
      </Head>

      <div className="auth-shell fade-up">
        <PageHeader
          eyebrow="Accounts"
          title="Sign in to your private collection."
          description="Guests can browse the demo binder, but scans, edits, and CSV imports now belong to signed-in collectors."
        />

        <section className="surface auth-card">
          <form className="stack" onSubmit={handleSubmit}>
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
                {busy ? 'Signing in...' : 'Log in'}
              </button>
              <Link className="button-ghost" href="/signup">
                Need an account?
              </Link>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
