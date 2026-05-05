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

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Accounts"
          title="Create your own collector profile."
          description="This first pass is lightweight email/password auth with a profile placeholder ready for future S3-backed avatars."
        />

        <section className={cn(surfaceClass, 'mx-auto w-full max-w-2xl p-6 sm:p-8')}>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className={fieldClass}>
              <label className={fieldLabelClass} htmlFor="username">
                Username
              </label>
              <input
                className={inputClass}
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_-]+"
                title="Username must contain only letters, numbers, underscores, and hyphens"
                required
              />
            </div>

            <div className={fieldClass}>
              <label className={fieldLabelClass} htmlFor="email">
                Email
              </label>
              <input
                className={inputClass}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className={fieldClass}>
              <label className={fieldLabelClass} htmlFor="password">
                Password (at least 12 chars with uppercase, lowercase, number, and symbol)
              </label>
              <input
                className={inputClass}
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?&quot;:{}|<>_\-+=[\]\\/'`;~]).+$"
                title="Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one symbol"
                required
              />
            </div>

            {error ? <p className={messageClass('error')}>{error}</p> : null}

            <div className={actionRowClass}>
              <button className={primaryButtonClass} type="submit" disabled={busy}>
                {busy ? 'Creating account...' : 'Create account'}
              </button>
              <Link className={ghostButtonClass} href="/login">
                Already have one?
              </Link>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
