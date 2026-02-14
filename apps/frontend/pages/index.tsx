import { useEffect, useState } from 'react';
import Link from 'next/link';

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

  const badgeColor =
    health === 'up' ? '#0f766e' : health === 'down' ? '#b91c1c' : '#6b7280';

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Trading Card App Binder</h1>
      <p>Welcome to your virtual binder MVP.</p>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '999px',
          background: '#f3f4f6',
          color: '#111827',
          fontSize: '0.9rem',
        }}
      >
        <span
          style={{
            width: '0.65rem',
            height: '0.65rem',
            borderRadius: '50%',
            background: badgeColor,
          }}
        />
        <span>{message}</span>
      </div>
      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem' }}>
        <Link href="/scan">Scan Card</Link>
        <Link href="/binder">Open Binder</Link>
      </div>
    </div>
  );
}
