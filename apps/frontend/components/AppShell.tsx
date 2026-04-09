import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';

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
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand-mark" href="/">
            <span className="brand-mark__chip">TC</span>
            <span>
              <strong>Trading Card App</strong>
              <small>
                {authenticated ? 'Signed-in collection workspace.' : 'Demo binder with private accounts ready.'}
              </small>
            </span>
          </Link>

          <div className="site-header__controls">
            <nav className="site-nav" aria-label="Primary">
              {navItems.map((item) => {
                const isActive =
                  router.pathname === item.href ||
                  (item.href !== '/' && router.pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    className={`site-nav__link${isActive ? ' is-active' : ''}`}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme">
              <span>{theme === 'dark' ? '🌑' : '☀️'}</span>
            </button>

            {loading ? (
              <span className="status-pill status-pill--neutral">Checking session</span>
            ) : authenticated && user ? (
              <div className="session-chip">
                <div className="avatar-shell" aria-hidden="true">
                  {user.pfpUrl ? <img src={user.pfpUrl} alt="" /> : <span>{initialsFor(user.username)}</span>}
                </div>
                <div className="session-chip__copy">
                  <strong>{user.username}</strong>
                  <span>{user.email}</span>
                </div>
                <Link className="button-ghost button-ghost--compact" href="/profile">
                  Profile
                </Link>
                <button className="button-ghost button-ghost--compact" type="button" onClick={() => void logout()}>
                  Log out
                </button>
              </div>
            ) : (
              <div className="session-actions">
                <span className="status-pill status-pill--accent">Demo collection</span>
                <Link className="button-ghost button-ghost--compact" href="/login">
                  Log in
                </Link>
                <Link className="button button--compact" href="/signup">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
