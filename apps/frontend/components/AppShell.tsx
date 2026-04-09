import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import {
  cn,
  compactGhostButtonClass,
  ghostButtonClass,
  pageShellClass,
  primaryButtonClass,
  shellClass,
} from '../lib/ui';
import { StatusPill } from './StatusPill';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/scan', label: 'Scan' },
  { href: '/binder', label: 'Binder' },
];

type AppShellProps = {
  children: ReactNode;
};

function initialsFor(name: string) {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { authenticated, loading, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-2xl max-[760px]:static">
        <div className={cn(shellClass, 'grid gap-3 py-4')}>
          <div className="flex items-start justify-between gap-4 max-[760px]:flex-col">
            <Link className="flex min-w-0 items-center gap-3" href="/">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,var(--accent),var(--secondary))] text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[var(--shadow-sm)] [font-family:var(--font-display)]">
                TC
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-base font-semibold tracking-[-0.03em] text-[var(--text)] [font-family:var(--font-display)]">
                  Trading Card App
                </strong>
                <small className="mt-1 block truncate text-sm text-[var(--muted)] max-[760px]:max-w-[240px]">
                  {authenticated
                    ? 'Signed-in collection workspace.'
                    : 'Demo binder with private accounts ready.'}
                </small>
              </span>
            </Link>

            <div className="flex w-full flex-wrap items-center justify-end gap-3 max-[760px]:justify-between">
              <button
                className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm font-medium text-[var(--text)] outline-none hover:bg-[var(--surface-strong)] focus:shadow-[var(--ring)]"
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>

              {loading ? (
                <StatusPill label="Checking session" />
              ) : authenticated && user ? (
                <div className="flex min-w-0 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 shadow-[var(--shadow-sm)] max-[760px]:w-full max-[760px]:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-soft)] text-sm font-semibold text-[var(--text)]"
                      aria-hidden="true"
                    >
                      {user.pfpUrl ? (
                        <img className="h-full w-full object-cover" src={user.pfpUrl} alt="" />
                      ) : (
                        <span>{initialsFor(user.username)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-[var(--text)]">
                        {user.username}
                      </strong>
                      <span className="block truncate text-xs text-[var(--muted)] max-[760px]:hidden">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link className={compactGhostButtonClass} href="/profile">
                      Profile
                    </Link>
                    <button
                      className={compactGhostButtonClass}
                      type="button"
                      onClick={() => void logout()}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 max-[760px]:w-full max-[760px]:justify-between">
                  <StatusPill label="Demo collection" tone="accent" />
                  <Link className={ghostButtonClass} href="/login">
                    Log in
                  </Link>
                  <Link className={primaryButtonClass} href="/signup">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
            <nav aria-label="Primary" className="flex min-w-max items-center gap-2">
              {navItems.map((item) => {
                const isActive =
                  router.pathname === item.href ||
                  (item.href !== '/' && router.pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      'inline-flex items-center rounded-full border px-4 py-2.5 text-sm font-medium outline-none',
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                        : 'border-[var(--border)] bg-[var(--surface-soft)]/75 text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]',
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className={cn(shellClass, pageShellClass)}>{children}</main>
    </div>
  );
}
