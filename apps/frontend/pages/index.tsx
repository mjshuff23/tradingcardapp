import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../lib/auth-context';

type HealthState = 'checking' | 'up' | 'down';

export default function Home() {
  const { authenticated, loading, user } = useAuth();
  const [health, setHealth] = useState<HealthState>('checking');
  const [message, setMessage] = useState('Checking API...');

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setHealth('up');
        setMessage('API connected');
      } catch {
        setHealth('down');
        setMessage('API unreachable');
      }
    };

    void checkHealth();
  }, []);

  const healthTone = health === 'up' ? 'success' : health === 'down' ? 'danger' : 'neutral';
  const accountLabel = loading
    ? 'Loading session'
    : authenticated && user
      ? `Signed in as ${user.username}`
      : 'Browsing demo binder';

  return (
    <AppShell>
      <Head>
        <title>Trading Card App</title>
      </Head>

      <section className="hero fade-up">
        <div className="hero__panel hero__panel--primary">
          <p className="eyebrow">Collection Workspace</p>
          <h1>Scans, profiles, and a cleaner card contract for the whole app.</h1>
          <p className="hero__lede">
            The stack now treats your binder like a real product surface: richer card metadata,
            private collector accounts, a darker default theme, and a demo collection for guests.
          </p>

          <div className="hero__actions">
            <Link className="button" href={authenticated ? '/scan' : '/login'}>
              {authenticated ? 'Start a scan' : 'Log in to scan'}
            </Link>
            <Link className="button-secondary" href="/binder">
              Open binder
            </Link>
            <StatusPill label={accountLabel} tone={authenticated ? 'success' : 'accent'} />
            <StatusPill label={message} tone={healthTone} />
          </div>

          <div className="metric-grid">
            <div className="metric">
              <strong>01</strong>
              <span>Guest collectors can browse the seeded demo binder immediately.</span>
            </div>
            <div className="metric">
              <strong>02</strong>
              <span>Signed-in users get their own scans, imports, and collection edits.</span>
            </div>
            <div className="metric">
              <strong>03</strong>
              <span>Richer catalog fields now flow from Prisma through the API into the UI.</span>
            </div>
          </div>
        </div>

        <aside className="hero__panel">
          <p className="eyebrow">What Changed</p>
          <div className="feature-grid feature-grid--compact">
            <div className="feature">
              <h3 className="surface-title">Demo + accounts</h3>
              <p>Guests stay read-only. Sign in to own scans, imports, and card updates.</p>
            </div>
            <div className="feature">
              <h3 className="surface-title">Expanded metadata</h3>
              <p>Set, category, market status, autograph flags, and wishlist priority now show up end to end.</p>
            </div>
            <div className="feature">
              <h3 className="surface-title">Smarter search</h3>
              <p>Binder search supports classic text lookup plus a deterministic natural-language mode.</p>
            </div>
          </div>

          <div className="surface surface-offset">
            <h2 className="surface-title">Current mode</h2>
            <p className="surface-copy">
              {authenticated && user
                ? `You are working in your private collector profile as ${user.username}.`
                : 'You are viewing the seeded demo binder. Log in or sign up to create your own profile and collection.'}
            </p>
          </div>
        </aside>
      </section>

      <section className="surface fade-up">
        <div className="section-header">
          <div>
            <h2 className="surface-title">Workflow</h2>
            <p className="surface-copy">
              This pass prioritizes realistic product behaviors instead of placeholder screens.
            </p>
          </div>
          <div className="action-row">
            {!authenticated ? (
              <Link className="button-ghost" href="/signup">
                Create an account
              </Link>
            ) : null}
            <Link className="button-ghost" href="/binder">
              Browse collection
            </Link>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <strong>Private actions</strong>
            <span>Scan uploads, confirmations, CSV import, and card edits now require a signed-in collector.</span>
          </div>
          <div className="detail-item">
            <strong>Demo continuity</strong>
            <span>The guest experience still works, but it is clearly labeled as a seeded demo collection.</span>
          </div>
          <div className="detail-item">
            <strong>Theme system</strong>
            <span>Dark mode is the default with a persistent toggle in the shared app shell.</span>
          </div>
          <div className="detail-item">
            <strong>Future storage</strong>
            <span>The backend is now prepared for split profile/card buckets while keeping local Garage support.</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
