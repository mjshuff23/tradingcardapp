import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CardImage } from '../components/CardImage';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../lib/auth-context';
import {
  CardListItem,
  CardQueryMode,
  CollectionStatus,
  importCardsCsv,
  listCards,
} from '../lib/api';

type Filter = CollectionStatus | 'ALL';

function formatCurrency(cents: number | null) {
  if (cents === null) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function buildSignals(card: CardListItem) {
  return [
    card.imageSource !== 'NONE' ? `Image ${card.imageSource.toLowerCase()}` : null,
    card.definition.cardSet?.sport,
    card.definition.category,
    card.definition.subcategory,
    card.definition.isVintage ? 'Vintage' : null,
    card.record.isAutographed ? 'Autographed' : null,
  ].filter(Boolean) as string[];
}

function buildMarketState(card: CardListItem) {
  const states = [];

  if (card.record.isForSale) {
    states.push(formatCurrency(card.record.askingPriceCents) ?? 'For sale');
  }

  if (card.record.isForTrade) {
    states.push('Open to trade');
  }

  if (card.collectionStatus === 'WANTED' && card.record.priority !== null) {
    states.push(`Wishlist P${card.record.priority}`);
  }

  if (card.record.gradeEstimate) {
    states.push(`Grade ${card.record.gradeEstimate}`);
  }

  return states;
}

export default function BinderPage() {
  const { authenticated, loading } = useAuth();
  const [q, setQ] = useState('');
  const [queryMode, setQueryMode] = useState<CardQueryMode>('text');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const ownedCount = cards.filter((card) => card.collectionStatus === 'OWNED').length;
  const wantedCount = cards.filter((card) => card.collectionStatus === 'WANTED').length;
  const tradeOrSaleCount = cards.filter(
    (card) => card.record.isForSale || card.record.isForTrade,
  ).length;

  const fetchCards = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await listCards({
        q: q || undefined,
        collectionStatus: filter,
        queryMode,
      });
      setCards(response.items);
      setTotal(response.pagination.total);
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
        `Imported ${result.summary.createdCount} new rows, updated ${result.summary.updatedCount}, skipped ${result.summary.skippedCount}.`,
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
          title="Search the binder like a collection, not a flat spreadsheet."
          description="Text and natural-language search now ride the richer catalog model. Guests can browse the seeded demo binder, while signed-in collectors can import and edit their own records."
          actions={
            <div className="action-row">
              <Link className="button" href={authenticated ? '/scan' : '/login'}>
                {authenticated ? 'Scan a card' : 'Log in to scan'}
              </Link>
              <StatusPill
                label={authenticated ? 'Private binder' : loading ? 'Checking session' : 'Demo binder'}
                tone={authenticated ? 'success' : 'accent'}
              />
            </div>
          }
        />

        <section className="surface">
          <form className="toolbar toolbar--binder" onSubmit={handleSearch}>
            <div className="toolbar__search">
              <label className="toolbar-label" htmlFor="binder-search">
                Search
              </label>
              <input
                id="binder-search"
                className="search-input"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={
                  queryMode === 'nl'
                    ? 'Try: Michael Jordan #466 Upper Deck 1993-94'
                    : 'Search by player, set, card number, or brand'
                }
              />
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-mode">
                Query mode
              </label>
              <select
                id="binder-mode"
                className="toolbar-select"
                value={queryMode}
                onChange={(event) => setQueryMode(event.target.value as CardQueryMode)}
              >
                <option value="text">Text</option>
                <option value="nl">Natural language</option>
              </select>
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-filter">
                Status
              </label>
              <select
                id="binder-filter"
                className="toolbar-select"
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
              >
                <option value="ALL">All statuses</option>
                <option value="OWNED">Owned</option>
                <option value="WANTED">Wanted</option>
              </select>
            </div>

            <button className="button-secondary" type="submit" disabled={busy}>
              {busy ? 'Loading...' : 'Refresh view'}
            </button>
          </form>

          <div className="stats-grid binder-summary">
            <div className="stat">
              <strong>{total}</strong>
              <span>Total matching cards</span>
            </div>
            <div className="stat">
              <strong>{ownedCount}</strong>
              <span>Owned in this view</span>
            </div>
            <div className="stat">
              <strong>{wantedCount}</strong>
              <span>Wishlist entries</span>
            </div>
            <div className="stat">
              <strong>{tradeOrSaleCount}</strong>
              <span>Trade or sale signals</span>
            </div>
          </div>

          <div className="section-header">
            <div>
              <h2>Bulk import</h2>
              <p className="fine-print">
                Signed-in collectors can import CSV rows into their own binder without losing scan-first workflows.
              </p>
            </div>

            {authenticated ? (
              <input
                id="csv-import"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleCsvImport(event.target.files?.[0] ?? null)}
                disabled={csvBusy}
              />
            ) : (
              <div className="surface-callout surface-callout--inline">
                <span>Guest mode is browse-only.</span>
                <Link className="subtle-link" href="/signup">
                  Create an account
                </Link>
              </div>
            )}
          </div>

          {csvMessage ? <p className="message">{csvMessage}</p> : null}
          {error ? <p className="message message--error">{error}</p> : null}
        </section>

        <section className="table-wrap">
          <div className="section-header">
            <div>
              <h2>Catalog view</h2>
              <p className="fine-print">
                Each row now keeps set metadata, market state, and ownership context intact instead of flattening everything into a couple strings.
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Card</th>
                  <th>Set</th>
                  <th>Signals</th>
                  <th>Market</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const setMeta = card.definition.cardSet;
                  const signals = buildSignals(card);
                  const marketState = buildMarketState(card);

                  return (
                    <tr key={card.id}>
                      <td>
                        <div className="thumbnail-slot">
                          <CardImage alt={`${card.title} thumbnail`} src={card.imageUrl} />
                        </div>
                      </td>
                      <td>
                        <div className="table-stack">
                          <Link className="table-link" href={`/cards/${card.id}`}>
                            {card.title}
                          </Link>
                          <span className="table-copy">
                            {[
                              card.definition.cardSet?.setName ?? card.definition.legacySetText,
                              card.definition.cardSet?.season ??
                                card.definition.cardSet?.yearManufactured,
                              card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Catalog metadata still filling in.'}
                          </span>
                          {card.subtitle ? <span className="table-note">{card.subtitle}</span> : null}
                          {card.record.notes ? (
                            <span className="table-note">{card.record.notes}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-stack">
                          <strong>{setMeta?.setName ?? card.definition.legacySetText ?? 'Unknown set'}</strong>
                          <span className="table-copy">
                            {[
                              setMeta?.brand,
                              setMeta?.yearManufactured,
                              setMeta?.season,
                              card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
                              setMeta?.sport,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Awaiting set metadata'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="inline-pills">
                          {signals.length ? (
                            signals.map((signal) => (
                              <StatusPill key={`${card.id}-${signal}`} label={signal} />
                            ))
                          ) : (
                            <span className="table-copy">No extra signals</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="inline-pills">
                          {marketState.length ? (
                            marketState.map((state) => (
                              <StatusPill
                                key={`${card.id}-${state}`}
                                label={state}
                                tone={state.startsWith('$') ? 'success' : 'accent'}
                              />
                            ))
                          ) : (
                            <span className="table-copy">Quiet</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="table-stack">
                          <StatusPill
                            label={card.collectionStatus}
                            tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
                          />
                          <span className="table-copy">
                            {card.record.confidence !== null
                              ? `Confidence ${card.record.confidence.toFixed(3)}`
                              : 'No validation score'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Link className="subtle-link" href={`/cards/${card.id}`}>
                          {authenticated ? 'Open editor' : 'View detail'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!cards.length ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        No cards match this view yet. Try a broader query, switch to natural language, or add new cards from the scan flow.
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
