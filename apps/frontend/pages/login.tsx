import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import {
  actionRowClass,
  cn,
  fieldClass,
  fieldLabelClass,
  ghostButtonClass,
  inputClass,
  messageClass,
  pageStackClass,
  primaryButtonClass,
  surfaceClass,
} from '../lib/ui';
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

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Accounts"
          title="Sign in to your private collection."
          description="Guests can browse the demo inventory, but scans, edits, and CSV imports belong to signed-in collectors."
        />

        <section className={cn(surfaceClass, 'mx-auto w-full max-w-2xl p-6 sm:p-8')}>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className={fieldClass}>
              <label className={fieldLabelClass} htmlFor="email">
                Email
              </label>
              <input
                className={inputClass}
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className={fieldClass}>
              <label className={fieldLabelClass} htmlFor="password">
                Password
              </label>
              <input
                className={inputClass}
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {error ? <p className={messageClass('error')}>{error}</p> : null}

            <div className={actionRowClass}>
              <button className={primaryButtonClass} type="submit" disabled={busy}>
                {busy ? 'Signing in...' : 'Log in'}
              </button>
              <Link className={ghostButtonClass} href="/signup">
                Need an account?
              </Link>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
