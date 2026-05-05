import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { StatusPill } from '../components/StatusPill';
import {
  actionRowClass,
  cn,
  detailGridClass,
  detailItemClass,
  finePrintClass,
  ghostButtonClass,
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
      : 'Browsing demo inventory';

  return (
    <AppShell>
      <Head>
        <title>Trading Card App</title>
      </Head>

      <div className={pageStackClass}>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div
            className={cn(
              surfaceClass,
              'relative overflow-hidden p-8 sm:p-10 lg:p-12',
              'before:absolute before:-left-24 before:top-16 before:h-56 before:w-56 before:rounded-full before:bg-[var(--accent-soft)] before:blur-3xl before:content-[\'\']',
              'after:absolute after:right-0 after:top-0 after:h-64 after:w-64 after:rounded-full after:bg-[var(--secondary-soft)] after:blur-3xl after:content-[\'\']',
            )}
          >
            <div className="relative z-10 flex flex-col gap-8">
              <div className="max-w-3xl">
                <p className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Collection Workspace
                </p>
                <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.08em] text-[var(--text)] [font-family:var(--font-display)] sm:text-6xl lg:text-7xl">
                  Scans, profiles, and a cleaner card contract for the whole app.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-soft)] sm:text-lg">
                  The stack now treats your binder like a real product surface: richer card
                  metadata, private collector accounts, web-enriched review flows, and a seeded
                  demo collection for guests.
                </p>
              </div>

              <div className={actionRowClass}>
                <Link className={primaryButtonClass} href={authenticated ? '/scan' : '/login'}>
                  {authenticated ? 'Start a scan' : 'Log in to scan'}
                </Link>
                <Link className={secondaryButtonClass} href="/binder">
                  Open inventory
                </Link>
                <StatusPill label={accountLabel} tone={authenticated ? 'success' : 'accent'} />
                <StatusPill label={message} tone={healthTone} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    step: '01',
                    copy: 'Guest collectors can browse the seeded demo inventory immediately.',
                  },
                  {
                    step: '02',
                    copy: 'Signed-in users get their own scans, imports, profile media, and card edits.',
                  },
                  {
                    step: '03',
                    copy: 'Richer catalog fields and web metadata suggestions now flow all the way into the UI.',
                  },
                ].map((item) => (
                  <div key={item.step} className={cn(softSurfaceClass, 'p-5')}>
                    <strong className="text-3xl font-semibold tracking-[-0.06em] text-[var(--text)] [font-family:var(--font-display)]">
                      {item.step}
                    </strong>
                    <p className={cn(surfaceCopyClass, 'mt-3')}>{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <section className={cn(surfaceClass, 'p-7 sm:p-8')}>
              <p className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                What Changed
              </p>
              <div className="grid gap-4">
                {[
                  {
                    title: 'Demo + accounts',
                    copy: 'Guests stay read-only. Sign in to own scans, imports, and card updates.',
                  },
                  {
                    title: 'Expanded metadata',
                    copy: 'Set, category, market status, autograph flags, and wishlist priority now show up end to end.',
                  },
                  {
                    title: 'Smarter search',
                    copy: 'Inventory search supports text, natural-language mode, and richer sort surfaces.',
                  },
                ].map((item) => (
                  <div key={item.title} className={cn(softSurfaceClass, 'p-5')}>
                    <h3 className={surfaceTitleClass}>{item.title}</h3>
                    <p className={cn(surfaceCopyClass, 'mt-2')}>{item.copy}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={cn(softSurfaceClass, 'p-7 sm:p-8')}>
              <h2 className={surfaceTitleClass}>Current mode</h2>
              <p className={cn(surfaceCopyClass, 'mt-3')}>
                {authenticated && user
                  ? `You are working in your private collector profile as ${user.username}.`
                  : 'You are viewing the seeded demo inventory. Log in or sign up to create your own profile and collection.'}
              </p>
            </section>
          </aside>
        </section>

        <section className={cn(surfaceClass, 'p-7 sm:p-8')}>
          <div className={sectionHeaderClass}>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text)] [font-family:var(--font-display)] sm:text-3xl">
                Workflow
              </h2>
              <p className={cn(surfaceCopyClass, 'mt-3')}>
                This pass prioritizes realistic product behaviors instead of placeholder screens.
              </p>
            </div>
            <div className={actionRowClass}>
              {!authenticated ? (
                <Link className={ghostButtonClass} href="/signup">
                  Create an account
                </Link>
              ) : null}
              <Link className={ghostButtonClass} href="/binder">
                Browse inventory
              </Link>
            </div>
          </div>

          <div className={cn(detailGridClass, 'mt-6 lg:grid-cols-2')}>
            {[
              {
                title: 'Private actions',
                copy: 'Scan uploads, confirmations, CSV import, and card edits now require a signed-in collector.',
              },
              {
                title: 'Demo continuity',
                copy: 'The guest experience still works, but it is clearly labeled as a seeded demo collection.',
              },
              {
                title: 'Theme system',
                copy: 'Dark mode stays the default, while light mode is warmer and less blinding than before.',
              },
              {
                title: 'Future storage',
                copy: 'The backend is already prepared for split profile/card buckets while keeping local Garage support.',
              },
            ].map((item) => (
              <div key={item.title} className={detailItemClass}>
                <strong className="block text-base font-semibold text-[var(--text)]">
                  {item.title}
                </strong>
                <span className={cn(finePrintClass, 'mt-2 block')}>{item.copy}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
