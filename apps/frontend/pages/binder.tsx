import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CardImage } from '../components/CardImage';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { ThemedSelect } from '../components/ThemedSelect';
import { useAuth } from '../lib/auth-context';
import {
  CardListItem,
  CardQueryMode,
  CardSortBy,
  CollectionStatus,
  SortDirection,
  importCardsCsv,
  listCards,
} from '../lib/api';

type Filter = CollectionStatus | 'ALL';

type BinderQueryState = {
  q: string;
  queryMode: CardQueryMode;
  filter: Filter;
  sortBy: CardSortBy;
  sortDirection: SortDirection;
};

type InteractivePill = {
  label: string;
  patch: Partial<BinderQueryState>;
  tone?: 'neutral' | 'success' | 'accent' | 'danger';
};

const SORT_OPTIONS: Array<{ value: CardSortBy; label: string }> = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Card title' },
  { value: 'player', label: 'Player' },
  { value: 'brand', label: 'Brand' },
  { value: 'setName', label: 'Set name' },
  { value: 'yearManufactured', label: 'Year' },
  { value: 'season', label: 'Season' },
  { value: 'cardNumber', label: 'Card number' },
  { value: 'sport', label: 'Sport' },
  { value: 'category', label: 'Category' },
  { value: 'subcategory', label: 'Subcategory' },
  { value: 'cardType', label: 'Card type' },
  { value: 'collectionStatus', label: 'Collection status' },
  { value: 'condition', label: 'Condition' },
  { value: 'gradeEstimate', label: 'Grade estimate' },
  { value: 'isAutographed', label: 'Signed copy' },
  { value: 'isForTrade', label: 'Trade flag' },
  { value: 'isForSale', label: 'Sale flag' },
  { value: 'askingPriceCents', label: 'Asking price' },
  { value: 'priority', label: 'Wishlist priority' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'createdAt', label: 'Created date' },
];

function formatCurrency(cents: number | null) {
  if (cents === null) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function buildSignals(card: CardListItem): InteractivePill[] {
  return [
    card.definition.player
      ? {
          label: `Player: ${card.definition.player}`,
          patch: {
            q: card.definition.player,
            sortBy: 'player',
            sortDirection: 'asc',
          },
        }
      : null,
    card.definition.cardSet?.sport
      ? {
          label: card.definition.cardSet.sport,
          patch: {
            q: card.definition.cardSet.sport,
            sortBy: 'sport',
            sortDirection: 'asc',
          },
        }
      : null,
    card.definition.category
      ? {
          label: card.definition.category,
          patch: {
            q: card.definition.category,
            sortBy: 'category',
            sortDirection: 'asc',
          },
        }
      : null,
    card.definition.subcategory
      ? {
          label: card.definition.subcategory,
          patch: {
            q: card.definition.subcategory,
            sortBy: 'subcategory',
            sortDirection: 'asc',
          },
        }
      : null,
    card.definition.cardType
      ? {
          label: card.definition.cardType,
          patch: {
            q: card.definition.cardType,
            sortBy: 'cardType',
            sortDirection: 'asc',
          },
        }
      : null,
    card.definition.isVintage
      ? {
          label: 'Vintage',
          patch: {
            sortBy: 'yearManufactured',
            sortDirection: 'asc',
          },
        }
      : null,
    card.record.isAutographed
      ? {
          label: 'Autographed copy',
          patch: {
            sortBy: 'isAutographed',
            sortDirection: 'desc',
          },
        }
      : null,
  ].filter(Boolean) as InteractivePill[];
}

function buildMarketState(card: CardListItem): InteractivePill[] {
  const states: InteractivePill[] = [];

  if (card.record.isForSale) {
    states.push({
      label: formatCurrency(card.record.askingPriceCents) ?? 'For sale',
      tone: 'success',
      patch: {
        sortBy: 'askingPriceCents',
        sortDirection: 'desc',
      },
    });
  }

  if (card.record.isForTrade) {
    states.push({
      label: 'Open to trade',
      tone: 'accent',
      patch: {
        sortBy: 'isForTrade',
        sortDirection: 'desc',
      },
    });
  }

  if (card.collectionStatus === 'WANTED' && card.record.priority !== null) {
    states.push({
      label: `Wishlist P${card.record.priority}`,
      tone: 'accent',
      patch: {
        filter: 'WANTED',
        sortBy: 'priority',
        sortDirection: 'asc',
      },
    });
  }

  if (card.record.gradeEstimate) {
    states.push({
      label: `Grade ${card.record.gradeEstimate}`,
      patch: {
        sortBy: 'gradeEstimate',
        sortDirection: 'asc',
      },
    });
  }

  return states;
}

function buildInventoryFacts(card: CardListItem) {
  return [
    card.definition.cardSet?.setName ?? card.definition.legacySetText,
    card.definition.cardSet?.brand,
    card.definition.cardSet?.season ?? card.definition.cardSet?.yearManufactured,
    card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
    card.definition.variant,
  ].filter(Boolean);
}

function defaultDirectionFor(field: CardSortBy): SortDirection {
  return field === 'updatedAt' || field === 'createdAt' ? 'desc' : 'asc';
}

export default function BinderPage() {
  const { authenticated, loading } = useAuth();
  const [queryState, setQueryState] = useState<BinderQueryState>({
    q: '',
    queryMode: 'text',
    filter: 'ALL',
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  });
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

  const loadCards = async (nextState: BinderQueryState) => {
    setBusy(true);
    setError(null);

    try {
      const response = await listCards({
        q: nextState.q || undefined,
        collectionStatus: nextState.filter,
        queryMode: nextState.queryMode,
        sortBy: nextState.sortBy,
        sortDirection: nextState.sortDirection,
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
    void loadCards(queryState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncStateAndReload = async (patch: Partial<BinderQueryState>) => {
    const nextState = {
      ...queryState,
      ...patch,
    };

    setQueryState(nextState);
    await loadCards(nextState);
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadCards(queryState);
  };

  const handleSortHeader = async (field: CardSortBy) => {
    const nextDirection =
      queryState.sortBy === field
        ? queryState.sortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : defaultDirectionFor(field);

    await syncStateAndReload({
      sortBy: field,
      sortDirection: nextDirection,
    });
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
      await loadCards(queryState);
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
          eyebrow="Inventory"
          title="Search the inventory like a collection, not a flat spreadsheet."
          description="The binder route now behaves like a real inventory surface: richer card metadata, sortable rows, and fast filters that turn a detail into the next view."
          actions={
            <div className="action-row">
              <Link className="button" href={authenticated ? '/scan' : '/login'}>
                {authenticated ? 'Scan a card' : 'Log in to scan'}
              </Link>
              <StatusPill
                label={authenticated ? 'Private inventory' : loading ? 'Checking session' : 'Demo inventory'}
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
                value={queryState.q}
                onChange={(event) =>
                  setQueryState((current) => ({ ...current, q: event.target.value }))
                }
                placeholder={
                  queryState.queryMode === 'nl'
                    ? 'Try: Michael Jordan #466 Upper Deck 1993-94'
                    : 'Search by player, set, card number, or brand'
                }
              />
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-mode">
                Query mode
              </label>
              <ThemedSelect
                value={queryState.queryMode}
                onChange={(nextValue) =>
                  void syncStateAndReload({ queryMode: nextValue as CardQueryMode })
                }
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'nl', label: 'Natural language' },
                ]}
              />
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-filter">
                Status
              </label>
              <ThemedSelect
                value={queryState.filter}
                onChange={(nextValue) =>
                  void syncStateAndReload({ filter: nextValue as Filter })
                }
                options={[
                  { value: 'ALL', label: 'All statuses' },
                  { value: 'OWNED', label: 'Owned' },
                  { value: 'WANTED', label: 'Wanted' },
                ]}
              />
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-sort">
                Sort by
              </label>
              <ThemedSelect
                value={queryState.sortBy}
                onChange={(nextValue) =>
                  void syncStateAndReload({
                    sortBy: nextValue as CardSortBy,
                    sortDirection: defaultDirectionFor(nextValue as CardSortBy),
                  })
                }
                options={SORT_OPTIONS}
              />
            </div>

            <div className="toolbar__group">
              <label className="toolbar-label" htmlFor="binder-direction">
                Direction
              </label>
              <ThemedSelect
                value={queryState.sortDirection}
                onChange={(nextValue) =>
                  void syncStateAndReload({ sortDirection: nextValue as SortDirection })
                }
                options={[
                  { value: 'asc', label: 'Ascending' },
                  { value: 'desc', label: 'Descending' },
                ]}
              />
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
                Signed-in collectors can import CSV rows into their own inventory without losing the scan-first workflow.
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
                Sort across identity, market, and collection-state fields, then tap the pills inside each row to turn details into the next filtered view.
              </p>
            </div>
          </div>

          <div className="table-scroll binder-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>
                    <button
                      className="table-sort-button"
                      type="button"
                      onClick={() => void handleSortHeader('title')}
                    >
                      <span>Card</span>
                      {queryState.sortBy === 'title' ? (
                        <small>{queryState.sortDirection === 'asc' ? '▲' : '▼'}</small>
                      ) : null}
                    </button>
                  </th>
                  <th>
                    <button
                      className="table-sort-button"
                      type="button"
                      onClick={() => void handleSortHeader('setName')}
                    >
                      <span>Set</span>
                      {queryState.sortBy === 'setName' ? (
                        <small>{queryState.sortDirection === 'asc' ? '▲' : '▼'}</small>
                      ) : null}
                    </button>
                  </th>
                  <th>Traits</th>
                  <th>
                    <button
                      className="table-sort-button"
                      type="button"
                      onClick={() => void handleSortHeader('askingPriceCents')}
                    >
                      <span>Market</span>
                      {queryState.sortBy === 'askingPriceCents' ? (
                        <small>{queryState.sortDirection === 'asc' ? '▲' : '▼'}</small>
                      ) : null}
                    </button>
                  </th>
                  <th>
                    <button
                      className="table-sort-button"
                      type="button"
                      onClick={() => void handleSortHeader('collectionStatus')}
                    >
                      <span>Status</span>
                      {queryState.sortBy === 'collectionStatus' ? (
                        <small>{queryState.sortDirection === 'asc' ? '▲' : '▼'}</small>
                      ) : null}
                    </button>
                  </th>
                  <th>
                    <button
                      className="table-sort-button"
                      type="button"
                      onClick={() => void handleSortHeader('updatedAt')}
                    >
                      <span>Updated</span>
                      {queryState.sortBy === 'updatedAt' ? (
                        <small>{queryState.sortDirection === 'asc' ? '▲' : '▼'}</small>
                      ) : null}
                    </button>
                  </th>
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
                            {buildInventoryFacts(card).join(' · ') ||
                              'Catalog metadata still filling in.'}
                          </span>
                          {card.record.notes ? (
                            <span className="table-note">{card.record.notes}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-stack">
                          <StatusPill
                            label={setMeta?.brand ?? 'Unknown brand'}
                            onClick={() =>
                              void syncStateAndReload({
                                q: [setMeta?.brand, setMeta?.setName].filter(Boolean).join(' '),
                              })
                            }
                          />
                          <span className="table-copy">
                            {[
                              setMeta?.setName ?? card.definition.legacySetText,
                              setMeta?.season ?? setMeta?.yearManufactured,
                              setMeta?.sport,
                              card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
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
                              <StatusPill
                                key={`${card.id}-${signal.label}`}
                                label={signal.label}
                                tone={signal.tone}
                                onClick={() => void syncStateAndReload(signal.patch)}
                              />
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
                                key={`${card.id}-${state.label}`}
                                label={state.label}
                                tone={state.tone}
                                onClick={() => void syncStateAndReload(state.patch)}
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
                            onClick={() =>
                              void syncStateAndReload({
                                filter: card.collectionStatus,
                              })
                            }
                          />
                          <span className="table-copy">
                            {card.record.confidence !== null
                              ? `Confidence ${card.record.confidence.toFixed(3)}`
                              : 'No validation score'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="table-stack">
                          <strong>{formatDate(card.record.updatedAt)}</strong>
                          <span className="table-copy">
                            {card.record.condition ?? card.record.gradeEstimate ?? 'No condition notes'}
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
                    <td colSpan={8}>
                      <div className="empty-state">
                        No cards match this view yet. Try a broader query, switch sort fields, or add new cards from the scan flow.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="binder-cards">
            {cards.map((card) => {
              const signals = buildSignals(card);
              const marketState = buildMarketState(card);
              const facts = buildInventoryFacts(card);

              return (
                <article className="inventory-card" key={`mobile-${card.id}`}>
                  <div className="inventory-card__top">
                    <div className="thumbnail-slot">
                      <CardImage alt={`${card.title} thumbnail`} src={card.imageUrl} />
                    </div>
                    <div className="inventory-card__meta">
                      <h3>
                        <Link className="table-link" href={`/cards/${card.id}`}>
                          {card.title}
                        </Link>
                      </h3>
                      <div className="inventory-card__facts">
                        <span>{facts.join(' · ') || 'Metadata still filling in.'}</span>
                        <span>
                          Updated {formatDate(card.record.updatedAt)}
                          {card.record.confidence !== null
                            ? ` · Confidence ${card.record.confidence.toFixed(3)}`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="inline-pills">
                    <StatusPill
                      label={card.collectionStatus}
                      tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
                      onClick={() =>
                        void syncStateAndReload({
                          filter: card.collectionStatus,
                        })
                      }
                    />
                    {card.definition.player ? (
                      <StatusPill
                        label={card.definition.player}
                        onClick={() =>
                          void syncStateAndReload({
                            q: card.definition.player ?? '',
                            sortBy: 'player',
                            sortDirection: 'asc',
                          })
                        }
                      />
                    ) : null}
                    {card.definition.cardSet?.brand ? (
                      <StatusPill
                        label={`${card.definition.cardSet.brand}${card.definition.cardSet.setName ? ` · ${card.definition.cardSet.setName}` : ''}`}
                        onClick={() =>
                          void syncStateAndReload({
                            q: [card.definition.cardSet?.brand, card.definition.cardSet?.setName]
                              .filter(Boolean)
                              .join(' '),
                          })
                        }
                      />
                    ) : null}
                  </div>

                  {signals.length ? (
                    <div className="inline-pills">
                      {signals.map((signal) => (
                        <StatusPill
                          key={`signal-${card.id}-${signal.label}`}
                          label={signal.label}
                          tone={signal.tone}
                          onClick={() => void syncStateAndReload(signal.patch)}
                        />
                      ))}
                    </div>
                  ) : null}

                  {marketState.length ? (
                    <div className="inline-pills">
                      {marketState.map((state) => (
                        <StatusPill
                          key={`market-${card.id}-${state.label}`}
                          label={state.label}
                          tone={state.tone}
                          onClick={() => void syncStateAndReload(state.patch)}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="action-row">
                    <Link className="button-secondary" href={`/cards/${card.id}`}>
                      {authenticated ? 'Open editor' : 'View detail'}
                    </Link>
                  </div>
                </article>
              );
            })}

            {!cards.length ? (
              <div className="empty-state">
                No cards match this view yet. Try a broader query, change sort order, or add new cards from the scan flow.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
