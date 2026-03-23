import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CardImage } from '../components/CardImage';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { CardRecord, CollectionStatus, importCardsCsv, listCards } from '../lib/api';

type Filter = CollectionStatus | 'ALL';
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BinderPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const ownedCount = cards.filter((card) => card.collectionStatus === 'OWNED').length;
  const wantedCount = cards.filter((card) => card.collectionStatus === 'WANTED').length;

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
    <AppShell>
      <Head>
        <title>Binder | Trading Card App</title>
      </Head>

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Binder"
          title="Search, filter, and maintain the collection."
          description="This stays close to the product workflow: catalog browsing first, metadata cleanup second, imports when you need bulk updates."
          actions={
            <Link className="button" href="/scan">
              Scan a card
            </Link>
          }
        />

        <section className="surface">
          <form className="toolbar" onSubmit={handleSearch}>
            <input
              className="search-input"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search by player, card, or set"
            />

            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
              <option value="ALL">All statuses</option>
              <option value="OWNED">Owned</option>
              <option value="WANTED">Wanted</option>
            </select>

            <button className="button-secondary" type="submit" disabled={busy}>
              {busy ? 'Loading...' : 'Search'}
            </button>
          </form>

          <div className="stats-grid">
            <div className="stat">
              <strong>{cards.length}</strong>
              <span>Cards in view</span>
            </div>
            <div className="stat">
              <strong>{ownedCount}</strong>
              <span>Owned</span>
            </div>
            <div className="stat">
              <strong>{wantedCount}</strong>
              <span>Wanted</span>
            </div>
          </div>

          <div className="section-header">
            <div>
              <h2>CSV import</h2>
              <p className="fine-print">Bring in existing collection records without losing the scan flow.</p>
            </div>
            <input
              id="csv-import"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleCsvImport(event.target.files?.[0] ?? null)}
              disabled={csvBusy}
            />
          </div>

          {csvMessage ? <p className="message">{csvMessage}</p> : null}
          {error ? <p className="message message--error">{error}</p> : null}
        </section>

        <section className="table-wrap">
          <div className="section-header">
            <div>
              <h2>Catalog</h2>
              <p className="fine-print">Direct access to detail editing for each saved card.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Card</th>
                  <th>Set</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td>
                      <div className="thumbnail-slot">
                        <CardImage
                          alt={`${card.name} thumbnail`}
                          src={`${API_ORIGIN}/api/v1/cards/${card.id}/image`}
                        />
                      </div>
                    </td>
                    <td>
                      <Link className="table-link" href={`/cards/${card.id}`}>
                        {card.year ? `${card.year} ` : ''}
                        {card.player ? `${card.player} - ` : ''}
                        {card.name}
                      </Link>
                    </td>
                    <td>{card.set ?? '-'}</td>
                    <td>
                      <StatusPill
                        label={card.collectionStatus}
                        tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
                      />
                    </td>
                    <td>{card.confidence !== null ? card.confidence.toFixed(3) : 'n/a'}</td>
                    <td>
                      <Link className="subtle-link" href={`/cards/${card.id}`}>
                        Edit details
                      </Link>
                    </td>
                  </tr>
                ))}
                {!cards.length ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        No cards match this filter yet. Try another search or add one from the scan
                        page.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
