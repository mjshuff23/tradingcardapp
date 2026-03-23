import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/scan', label: 'Scan' },
  { href: '/binder', label: 'Binder' },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand-mark" href="/">
            <span className="brand-mark__chip">TC</span>
            <span>
              <strong>Trading Card App</strong>
              <small>Scan, review, and manage your binder.</small>
            </span>
          </Link>

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
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
