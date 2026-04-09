import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  actionRowClass,
  cn,
  fieldLabelClass,
  finePrintClass,
  ghostButtonClass,
  hiddenFileInputClass,
  inputClass,
  messageClass,
  pageStackClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeaderClass,
  softSurfaceClass,
  surfaceClass,
  surfaceCopyClass,
  surfaceTitleClass,
  tableScrollClass,
  tableWrapClass,
} from '../lib/ui';

type Filter = CollectionStatus | 'ALL';
type ColumnKey =
  | 'image'
  | 'title'
  | 'player'
  | 'brand'
  | 'setName'
  | 'yearManufactured'
  | 'cardNumber'
  | 'sport'
  | 'category'
  | 'subcategory'
  | 'condition'
  | 'gradeEstimate'
  | 'market'
  | 'collectionStatus'
  | 'confidence'
  | 'updatedAt'
  | 'action'
  | 'season'
  | 'variant'
  | 'cardType'
  | 'isForTrade'
  | 'isForSale'
  | 'askingPriceCents'
  | 'priority'
  | 'createdAt'
  | 'isAutographed';

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

type BinderPreferences = {
  visibleColumns?: ColumnKey[];
  sortBy?: CardSortBy;
  sortDirection?: SortDirection;
};

type BinderColumn = {
  key: ColumnKey;
  label: string;
  sortBy?: CardSortBy;
  locked?: boolean;
  render: (card: CardListItem) => ReactNode;
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

const COLUMN_ORDER: ColumnKey[] = [
  'image',
  'title',
  'player',
  'brand',
  'setName',
  'yearManufactured',
  'cardNumber',
  'sport',
  'category',
  'subcategory',
  'condition',
  'gradeEstimate',
  'market',
  'collectionStatus',
  'confidence',
  'updatedAt',
  'action',
  'season',
  'variant',
  'cardType',
  'isForTrade',
  'isForSale',
  'askingPriceCents',
  'priority',
  'createdAt',
  'isAutographed',
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'image',
  'title',
  'player',
  'brand',
  'setName',
  'yearManufactured',
  'cardNumber',
  'sport',
  'category',
  'subcategory',
  'condition',
  'gradeEstimate',
  'market',
  'collectionStatus',
  'confidence',
  'updatedAt',
  'action',
];

const LOCKED_COLUMNS = new Set<ColumnKey>(['title', 'action']);

function sanitizeVisibleColumns(raw: unknown): ColumnKey[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_VISIBLE_COLUMNS;
  }

  const asSet = new Set<ColumnKey>();
  for (const entry of raw) {
    if (typeof entry === 'string' && COLUMN_ORDER.includes(entry as ColumnKey)) {
      asSet.add(entry as ColumnKey);
    }
  }

  for (const key of LOCKED_COLUMNS) {
    asSet.add(key);
  }

  const ordered = COLUMN_ORDER.filter((key) => asSet.has(key));
  return ordered.length ? ordered : DEFAULT_VISIBLE_COLUMNS;
}

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

function readBinderPreferences(key: string | null): BinderPreferences | null {
  if (!key || typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BinderPreferences;
  } catch {
    return null;
  }
}

export default function BinderPage() {
  const { authenticated, loading, user } = useAuth();
  const [queryState, setQueryState] = useState<BinderQueryState>({
    q: '',
    queryMode: 'text',
    filter: 'ALL',
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  });
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const preferenceKey = !loading
    ? `binder-table-preferences:${authenticated && user ? user.id : 'demo'}`
    : null;

  const ownedCount = cards.filter((card) => card.collectionStatus === 'OWNED').length;
  const wantedCount = cards.filter((card) => card.collectionStatus === 'WANTED').length;
  const tradeOrSaleCount = cards.filter(
    (card) => card.record.isForSale || card.record.isForTrade,
  ).length;

  const persistPreferences = (
    nextState: Pick<BinderQueryState, 'sortBy' | 'sortDirection'>,
    nextColumns: ColumnKey[],
  ) => {
    if (!preferenceKey || typeof window === 'undefined') {
      return;
    }

    const payload: BinderPreferences = {
      visibleColumns: nextColumns,
      sortBy: nextState.sortBy,
      sortDirection: nextState.sortDirection,
    };
    window.localStorage.setItem(preferenceKey, JSON.stringify(payload));
  };

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
    if (loading || !preferenceKey) {
      return;
    }

    const stored = readBinderPreferences(preferenceKey);
    const nextState: BinderQueryState = {
      q: '',
      queryMode: 'text',
      filter: 'ALL',
      sortBy: stored?.sortBy ?? 'updatedAt',
      sortDirection: stored?.sortDirection ?? 'desc',
    };
    const nextColumns = sanitizeVisibleColumns(stored?.visibleColumns);
    setVisibleColumns(nextColumns);
    setQueryState(nextState);
    void loadCards(nextState);
  }, [loading, preferenceKey]);

  useEffect(() => {
    if (!columnPickerOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current?.contains(event.target as Node)) {
        return;
      }
      setColumnPickerOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [columnPickerOpen]);

  const syncStateAndReload = async (patch: Partial<BinderQueryState>) => {
    const nextState = {
      ...queryState,
      ...patch,
    };

    setQueryState(nextState);
    persistPreferences(nextState, visibleColumns);
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

  const toggleColumn = (key: ColumnKey) => {
    if (LOCKED_COLUMNS.has(key)) {
      return;
    }

    const exists = visibleColumns.includes(key);
    const nextColumns = exists
      ? visibleColumns.filter((columnKey) => columnKey !== key)
      : COLUMN_ORDER.filter((columnKey) =>
          columnKey === key || visibleColumns.includes(columnKey),
        );

    const sanitized = sanitizeVisibleColumns(nextColumns);
    setVisibleColumns(sanitized);
    persistPreferences(queryState, sanitized);
  };

  const columns: BinderColumn[] = useMemo(() => {
    const metricCell = (value: ReactNode, secondary?: ReactNode) => (
      <div className="flex min-w-[120px] flex-col gap-1">
        <span className="text-sm font-medium text-[var(--text)]">{value}</span>
        {secondary ? (
          <span className="text-xs leading-5 text-[var(--text-soft)]">{secondary}</span>
        ) : null}
      </div>
    );

    return [
      {
        key: 'image',
        label: 'Image',
        render: (card) => (
          <div className="w-20 min-w-[5rem]">
            <CardImage alt={`${card.title} thumbnail`} src={card.imageUrl} />
          </div>
        ),
      },
      {
        key: 'title',
        label: 'Card',
        sortBy: 'title',
        locked: true,
        render: (card) => (
          <div className="min-w-[240px]">
            <Link
              className="text-base font-semibold tracking-[-0.03em] text-[var(--text)] hover:text-[var(--accent-strong)]"
              href={`/cards/${card.id}`}
            >
              {card.title}
            </Link>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              {buildInventoryFacts(card).join(' · ') || 'Catalog metadata still filling in.'}
            </p>
            {card.record.notes ? (
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{card.record.notes}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: 'player',
        label: 'Player',
        sortBy: 'player',
        render: (card) =>
          metricCell(
            card.definition.player ?? '—',
            card.definition.player ? (
              <button
                className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]"
                type="button"
                onClick={() =>
                  void syncStateAndReload({
                    q: card.definition.player ?? '',
                    sortBy: 'player',
                    sortDirection: 'asc',
                  })
                }
              >
                Filter by player
              </button>
            ) : null,
          ),
      },
      {
        key: 'brand',
        label: 'Brand',
        sortBy: 'brand',
        render: (card) =>
          metricCell(
            card.definition.cardSet?.brand ?? '—',
            card.definition.cardSet?.brand ? (
              <button
                className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]"
                type="button"
                onClick={() =>
                  void syncStateAndReload({
                    q: card.definition.cardSet?.brand ?? '',
                    sortBy: 'brand',
                    sortDirection: 'asc',
                  })
                }
              >
                Filter by brand
              </button>
            ) : null,
          ),
      },
      {
        key: 'setName',
        label: 'Set',
        sortBy: 'setName',
        render: (card) =>
          metricCell(
            card.definition.cardSet?.setName ?? card.definition.legacySetText ?? '—',
            card.definition.cardSet?.season ?? card.definition.cardSet?.yearManufactured ?? null,
          ),
      },
      {
        key: 'yearManufactured',
        label: 'Year',
        sortBy: 'yearManufactured',
        render: (card) => metricCell(card.definition.cardSet?.yearManufactured ?? '—'),
      },
      {
        key: 'cardNumber',
        label: 'Card #',
        sortBy: 'cardNumber',
        render: (card) => metricCell(card.definition.cardNumber ? `#${card.definition.cardNumber}` : '—'),
      },
      {
        key: 'sport',
        label: 'Sport',
        sortBy: 'sport',
        render: (card) => metricCell(card.definition.cardSet?.sport ?? '—'),
      },
      {
        key: 'category',
        label: 'Category',
        sortBy: 'category',
        render: (card) => metricCell(card.definition.category ?? '—'),
      },
      {
        key: 'subcategory',
        label: 'Subcategory',
        sortBy: 'subcategory',
        render: (card) => metricCell(card.definition.subcategory ?? '—'),
      },
      {
        key: 'condition',
        label: 'Condition',
        sortBy: 'condition',
        render: (card) => metricCell(card.record.condition ?? '—'),
      },
      {
        key: 'gradeEstimate',
        label: 'Grade',
        sortBy: 'gradeEstimate',
        render: (card) => metricCell(card.record.gradeEstimate ?? '—'),
      },
      {
        key: 'market',
        label: 'Market',
        sortBy: 'askingPriceCents',
        render: (card) => {
          const marketState = buildMarketState(card);
          return (
            <div className="flex min-w-[180px] flex-wrap gap-2">
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
                <span className="text-sm text-[var(--text-soft)]">Quiet</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'collectionStatus',
        label: 'Status',
        sortBy: 'collectionStatus',
        render: (card) => (
          <div className="flex min-w-[160px] flex-col gap-2">
            <StatusPill
              label={card.collectionStatus}
              tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
              onClick={() =>
                void syncStateAndReload({
                  filter: card.collectionStatus,
                })
              }
            />
            <span className="text-xs leading-5 text-[var(--text-soft)]">
              {card.record.isAutographed ? 'Signed copy' : 'Unsigned / untracked'}
            </span>
          </div>
        ),
      },
      {
        key: 'confidence',
        label: 'Confidence',
        sortBy: 'confidence',
        render: (card) =>
          metricCell(
            card.record.confidence !== null ? card.record.confidence.toFixed(3) : '—',
          ),
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        sortBy: 'updatedAt',
        render: (card) => metricCell(formatDate(card.record.updatedAt)),
      },
      {
        key: 'action',
        label: 'Action',
        locked: true,
        render: (card) => (
          <Link
            className="inline-flex items-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            href={`/cards/${card.id}`}
          >
            {authenticated ? 'Open editor' : 'View detail'}
          </Link>
        ),
      },
      {
        key: 'season',
        label: 'Season',
        sortBy: 'season',
        render: (card) => metricCell(card.definition.cardSet?.season ?? '—'),
      },
      {
        key: 'variant',
        label: 'Variant',
        sortBy: 'title',
        render: (card) => metricCell(card.definition.variant ?? '—'),
      },
      {
        key: 'cardType',
        label: 'Card type',
        sortBy: 'cardType',
        render: (card) => metricCell(card.definition.cardType ?? '—'),
      },
      {
        key: 'isForTrade',
        label: 'Trade flag',
        sortBy: 'isForTrade',
        render: (card) => metricCell(card.record.isForTrade ? 'Open to trade' : '—'),
      },
      {
        key: 'isForSale',
        label: 'Sale flag',
        sortBy: 'isForSale',
        render: (card) => metricCell(card.record.isForSale ? 'Listed' : '—'),
      },
      {
        key: 'askingPriceCents',
        label: 'Asking price',
        sortBy: 'askingPriceCents',
        render: (card) => metricCell(formatCurrency(card.record.askingPriceCents) ?? '—'),
      },
      {
        key: 'priority',
        label: 'Priority',
        sortBy: 'priority',
        render: (card) => metricCell(card.record.priority !== null ? `P${card.record.priority}` : '—'),
      },
      {
        key: 'createdAt',
        label: 'Created',
        sortBy: 'createdAt',
        render: (card) => metricCell(formatDate(card.record.createdAt)),
      },
      {
        key: 'isAutographed',
        label: 'Autographed',
        sortBy: 'isAutographed',
        render: (card) => metricCell(card.record.isAutographed ? 'Yes' : 'No'),
      },
    ];
  }, [authenticated, queryState, visibleColumns]);

  const visibleColumnConfig = columns.filter((column) => visibleColumns.includes(column.key));

  const renderHeaderCell = (column: BinderColumn) => {
    if (!column.sortBy) {
      return (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {column.label}
        </span>
      );
    }

    return (
      <button
        className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--text)]"
        type="button"
        onClick={() => void handleSortHeader(column.sortBy!)}
      >
        <span>{column.label}</span>
        {queryState.sortBy === column.sortBy ? (
          <small className="text-[10px] text-[var(--accent-strong)]">
            {queryState.sortDirection === 'asc' ? 'Asc' : 'Desc'}
          </small>
        ) : null}
      </button>
    );
  };

  return (
    <AppShell>
      <Head>
        <title>Binder | Trading Card App</title>
      </Head>

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Inventory"
          title="Search the inventory like a collection, not a flat spreadsheet."
          description="The binder route now behaves like a real inventory surface: richer card metadata, sortable rows, a customizable desktop table, and quick filters that turn details into the next view."
          actions={
            <div className={actionRowClass}>
              <Link className={primaryButtonClass} href={authenticated ? '/scan' : '/login'}>
                {authenticated ? 'Scan a card' : 'Log in to scan'}
              </Link>
              <StatusPill
                label={
                  authenticated
                    ? 'Private inventory'
                    : loading
                      ? 'Checking session'
                      : 'Demo inventory'
                }
                tone={authenticated ? 'success' : 'accent'}
              />
            </div>
          }
        />

        <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
          <form className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.85fr))_auto]" onSubmit={handleSearch}>
            <div className="xl:col-span-1">
              <label className={fieldLabelClass} htmlFor="binder-search">
                Search
              </label>
              <input
                id="binder-search"
                className={inputClass}
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

            <div>
              <label className={fieldLabelClass} htmlFor="binder-mode">
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

            <div>
              <label className={fieldLabelClass} htmlFor="binder-filter">
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

            <div>
              <label className={fieldLabelClass} htmlFor="binder-sort">
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

            <div>
              <label className={fieldLabelClass} htmlFor="binder-direction">
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

            <div className="flex items-end">
              <button className={secondaryButtonClass} type="submit" disabled={busy}>
                {busy ? 'Loading...' : 'Refresh view'}
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total matching cards', value: total },
              { label: 'Owned in this view', value: ownedCount },
              { label: 'Wishlist entries', value: wantedCount },
              { label: 'Trade or sale signals', value: tradeOrSaleCount },
            ].map((item) => (
              <div key={item.label} className={cn(softSurfaceClass, 'p-4')}>
                <strong className="text-3xl font-semibold tracking-[-0.06em] text-[var(--text)] [font-family:var(--font-display)]">
                  {item.value}
                </strong>
                <span className={cn(finePrintClass, 'mt-2 block')}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className={cn(sectionHeaderClass, 'mt-6')}>
            <div>
              <h2 className={surfaceTitleClass}>Bulk import</h2>
              <p className={cn(finePrintClass, 'mt-2')}>
                Signed-in collectors can import CSV rows into their own inventory without losing the
                scan-first workflow.
              </p>
            </div>

            {authenticated ? (
              <label className={secondaryButtonClass}>
                <input
                  className={hiddenFileInputClass}
                  id="csv-import"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => void handleCsvImport(event.target.files?.[0] ?? null)}
                  disabled={csvBusy}
                />
                {csvBusy ? 'Importing...' : 'Import CSV'}
              </label>
            ) : (
              <div className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm text-[var(--text-soft)]">
                Guest mode is browse-only.{' '}
                <Link className="font-semibold text-[var(--accent-strong)]" href="/signup">
                  Create an account
                </Link>
              </div>
            )}
          </div>

          {csvMessage ? <p className={cn(messageClass(), 'mt-4')}>{csvMessage}</p> : null}
          {error ? <p className={cn(messageClass('error'), 'mt-4')}>{error}</p> : null}
        </section>

        <section className={tableWrapClass}>
          <div className="flex flex-col gap-4 border-b border-[var(--border)] p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className={surfaceTitleClass}>Catalog view</h2>
              <p className={cn(finePrintClass, 'mt-2 max-w-3xl')}>
                Sort across identity, market, and collection-state fields, then tap the pills inside
                each row to turn details into the next filtered view.
              </p>
            </div>

            <div className="relative hidden md:block" ref={pickerRef}>
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => setColumnPickerOpen((current) => !current)}
              >
                Customize columns
              </button>

              {columnPickerOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-[320px] rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-lg)]">
                  <p className="text-sm font-semibold text-[var(--text)]">Visible desktop columns</p>
                  <p className={cn(finePrintClass, 'mt-1')}>
                    Saved per viewer, together with your last-used sort.
                  </p>
                  <div className="mt-4 grid max-h-[320px] gap-2 overflow-auto pr-1">
                    {columns.map((column) => {
                      const checked = visibleColumns.includes(column.key);
                      return (
                        <label
                          key={column.key}
                          className={cn(
                            softSurfaceClass,
                            'flex items-center gap-3 p-3',
                            column.locked ? 'opacity-75' : 'cursor-pointer',
                          )}
                        >
                          <input
                            className="h-4 w-4 accent-[var(--accent)]"
                            type="checkbox"
                            checked={checked}
                            disabled={column.locked}
                            onChange={() => toggleColumn(column.key)}
                          />
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="text-sm text-[var(--text)]">{column.label}</span>
                            {column.locked ? (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                Required
                              </span>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={cn(tableScrollClass, 'hidden md:block')}>
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-[var(--surface-soft)]/80">
                  {visibleColumnConfig.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-[var(--border)] px-4 py-3 text-left first:pl-6 last:pr-6"
                      scope="col"
                    >
                      {renderHeaderCell(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id} className="align-top">
                    {visibleColumnConfig.map((column) => (
                      <td
                        key={`${card.id}-${column.key}`}
                        className="border-b border-[var(--border)] px-4 py-4 first:pl-6 last:pr-6"
                      >
                        {column.render(card)}
                      </td>
                    ))}
                  </tr>
                ))}

                {!cards.length ? (
                  <tr>
                    <td colSpan={visibleColumnConfig.length} className="px-6 py-8">
                      <div className={messageClass()}>
                        No cards match this view yet. Try a broader query, switch sort fields, or
                        add new cards from the scan flow.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-4 md:hidden">
            {cards.map((card) => {
              const signals = buildSignals(card);
              const marketState = buildMarketState(card);
              const facts = buildInventoryFacts(card);

              return (
                <article className={cn(softSurfaceClass, 'p-4')} key={`mobile-${card.id}`}>
                  <div className="flex gap-4">
                    <div className="w-24 shrink-0">
                      <CardImage alt={`${card.title} thumbnail`} src={card.imageUrl} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-[-0.04em] text-[var(--text)] [font-family:var(--font-display)]">
                        <Link href={`/cards/${card.id}`}>{card.title}</Link>
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                        {facts.join(' · ') || 'Metadata still filling in.'}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                        Updated {formatDate(card.record.updatedAt)}
                        {card.record.confidence !== null
                          ? ` · Confidence ${card.record.confidence.toFixed(3)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className={cn(actionRowClass, 'mt-4')}>
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
                    <div className={cn(actionRowClass, 'mt-3')}>
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
                    <div className={cn(actionRowClass, 'mt-3')}>
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className={cn(softSurfaceClass, 'p-3')}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Taxonomy
                      </p>
                      <p className="mt-2 text-sm text-[var(--text)]">
                        {[card.definition.category, card.definition.subcategory, card.definition.cardType]
                          .filter(Boolean)
                          .join(' · ') || 'Uncategorized'}
                      </p>
                    </div>
                    <div className={cn(softSurfaceClass, 'p-3')}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Record state
                      </p>
                      <p className="mt-2 text-sm text-[var(--text)]">
                        {[card.record.condition, card.record.gradeEstimate]
                          .filter(Boolean)
                          .join(' · ') || 'No condition notes'}
                      </p>
                    </div>
                  </div>

                  <div className={cn(actionRowClass, 'mt-4')}>
                    <Link className={secondaryButtonClass} href={`/cards/${card.id}`}>
                      {authenticated ? 'Open editor' : 'View detail'}
                    </Link>
                  </div>
                </article>
              );
            })}

            {!cards.length ? (
              <div className={messageClass()}>
                No cards match this view yet. Try a broader query, change the filters, or add new
                cards from the scan flow.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
