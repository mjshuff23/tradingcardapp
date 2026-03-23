import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { StatusPill } from '../components/StatusPill';

type HealthState = 'checking' | 'up' | 'down';

export default function Home() {
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
      } catch (error) {
        setHealth('down');
        setMessage('API unreachable');
      }
    };

    void checkHealth();
  }, []);

  const healthTone = health === 'up' ? 'success' : health === 'down' ? 'danger' : 'neutral';
  const healthLabel =
    health === 'up' ? 'API connected' : health === 'down' ? 'API unreachable' : 'Checking API';

  return (
    <AppShell>
      <Head>
        <title>Trading Card App</title>
      </Head>

      <section className="hero fade-up">
        <div className="hero__panel">
          <p className="eyebrow">Collection Workspace</p>
          <h1>Trading cards, scanned into a clean digital binder.</h1>
          <p className="hero__lede">
            Upload a front and back photo, review OCR-backed matches, and keep the catalog tidy
            enough to show off in a portfolio without touching the backend logic.
          </p>

          <div className="hero__actions">
            <Link className="button" href="/scan">
              Start a scan
            </Link>
            <Link className="button-secondary" href="/binder">
              Open binder
            </Link>
            <StatusPill label={healthLabel} tone={healthTone} />
          </div>

          <div className="metric-grid">
            <div className="metric">
              <strong>01</strong>
              <span>Capture card images from mobile or desktop in a single scan flow.</span>
            </div>
            <div className="metric">
              <strong>02</strong>
              <span>Review candidates before anything lands in the catalog.</span>
            </div>
            <div className="metric">
              <strong>03</strong>
              <span>Edit, filter, and import collection data without leaving the app.</span>
            </div>
          </div>
        </div>

        <aside className="hero__panel">
          <p className="eyebrow">Workflow</p>
          <div className="feature-grid feature-grid--compact">
            <div className="feature">
              <h3 className="surface-title">Scan intake</h3>
              <p>Phone-friendly upload fields, optional back image, and clear empty states.</p>
            </div>
            <div className="feature">
              <h3 className="surface-title">Candidate review</h3>
              <p>Confidence scoring, source links, and a direct confirm action.</p>
            </div>
            <div className="feature">
              <h3 className="surface-title">Binder upkeep</h3>
              <p>Search, filter, CSV import, and metadata edits for each saved card.</p>
            </div>
          </div>

          <div className="surface surface-offset">
            <h2 className="surface-title">Current backend status</h2>
            <p className="surface-copy">{message}. The frontend is wired to the same API checks used by the MVP.</p>
          </div>
        </aside>
      </section>

      <section className="surface fade-up">
        <div className="section-header">
          <div>
            <h2 className="surface-title">Built for the actual product flow</h2>
            <p className="surface-copy">
              The UI now reads like a real app surface instead of disconnected test pages.
            </p>
          </div>
          <div className="action-row">
            <Link className="button-ghost" href="/scan">
              Open scanning flow
            </Link>
            <Link className="button-ghost" href="/binder">
              Browse collection
            </Link>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <strong>Navigation</strong>
            <span>Shared app shell with clear entry points for scanning and collection management.</span>
          </div>
          <div className="detail-item">
            <strong>Responsive layout</strong>
            <span>Desktop-friendly tables where useful and stacked layouts where scanning needs focus.</span>
          </div>
          <div className="detail-item">
            <strong>Visual language</strong>
            <span>Archive-style palette, stronger typography, restrained surfaces, and cleaner hierarchy.</span>
          </div>
          <div className="detail-item">
            <strong>Portfolio readiness</strong>
            <span>Enough polish to host the app as a case-study project without rebuilding the stack.</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
