import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CollectionStatus, importCardsCsv, listCards } from '../lib/api';

type Filter = CollectionStatus | 'ALL';

export default function BinderPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [cards, setCards] = useState<Array<{
    id: number;
    name: string;
    set: string | null;
    year: number | null;
    player: string | null;
    collectionStatus: CollectionStatus;
    confidence: number | null;
  }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const fetchCards = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await listCards({ q: q || undefined, collectionStatus: filter });
      setCards(response.items);
    } catch (fetchError) {
      setError((fetchError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchCards();
  };

  const handleCsvImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    setCsvBusy(true);
    setCsvMessage(null);

    try {
      const result = await importCardsCsv(file);
      setCsvMessage(
        `Imported: +${result.summary.createdCount} created, ${result.summary.updatedCount} updated, ${result.summary.skippedCount} skipped`,
      );
      await fetchCards();
    } catch (importError) {
      setCsvMessage((importError as Error).message);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Binder</h1>
      <p>Search and manage your scanned/added cards.</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by player, card, set"
        />

        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="ALL">All</option>
          <option value="OWNED">Owned</option>
          <option value="WANTED">Wanted</option>
        </select>

        <button type="submit" disabled={busy}>
          {busy ? 'Loading...' : 'Search'}
        </button>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <label htmlFor="csv-import">CSV import: </label>
        <input
          id="csv-import"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void handleCsvImport(event.target.files?.[0] ?? null)}
          disabled={csvBusy}
        />
      </div>

      {csvMessage ? <p>{csvMessage}</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Card</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Set</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                {card.year ? `${card.year} ` : ''}
                {card.player ? `${card.player} - ` : ''}
                {card.name}
              </td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{card.set ?? '-'}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{card.collectionStatus}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
                {card.confidence ? card.confidence.toFixed(3) : 'n/a'}
              </td>
            </tr>
          ))}
          {!cards.length ? (
            <tr>
              <td colSpan={4} style={{ padding: '0.75rem' }}>
                No cards yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p style={{ marginTop: '1rem' }}>
        <Link href="/scan">Scan a card</Link>
      </p>
    </main>
  );
}
