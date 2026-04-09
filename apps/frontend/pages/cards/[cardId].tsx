import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CardImage } from '../../components/CardImage';
import { PageHeader } from '../../components/PageHeader';
import { StatusPill } from '../../components/StatusPill';
import { useAuth } from '../../lib/auth-context';
import {
  CardDetail,
  CollectionStatus,
  clearCardImage,
  getCard,
  normalizeCardTitle,
  uploadCardImage,
  updateCard,
} from '../../lib/api';

type FormState = {
  name: string;
  brand: string;
  setName: string;
  legacySetText: string;
  season: string;
  cardNumber: string;
  yearManufactured: string;
  player: string;
  variant: string;
  sport: string;
  category: string;
  subcategory: string;
  originalOrReprint: string;
  parallelOrVariety: string;
  setType: string;
  insertSetName: string;
  cardType: string;
  hasAutographVariant: boolean;
  isVintage: boolean;
  collectionStatus: CollectionStatus;
  condition: string;
  isAutographed: boolean;
  autographFormat: string;
  isForTrade: boolean;
  isForSale: boolean;
  askingPriceCents: string;
  priority: string;
  notes: string;
  gradeEstimate: string;
};

function toFormState(card: CardDetail): FormState {
  return {
    name: card.definition.name ?? '',
    brand: card.definition.cardSet?.brand ?? '',
    setName: card.definition.cardSet?.setName ?? '',
    legacySetText: card.definition.legacySetText ?? '',
    season: card.definition.cardSet?.season ?? '',
    cardNumber: card.definition.cardNumber ?? '',
    yearManufactured: card.definition.cardSet?.yearManufactured
      ? String(card.definition.cardSet.yearManufactured)
      : '',
    player: card.definition.player ?? '',
    variant: card.definition.variant ?? '',
    sport: card.definition.cardSet?.sport ?? '',
    category: card.definition.category ?? '',
    subcategory: card.definition.subcategory ?? '',
    originalOrReprint: card.definition.originalOrReprint ?? '',
    parallelOrVariety: card.definition.parallelOrVariety ?? '',
    setType: card.definition.setType ?? '',
    insertSetName: card.definition.insertSetName ?? '',
    cardType: card.definition.cardType ?? '',
    hasAutographVariant: card.definition.hasAutographVariant,
    isVintage: card.definition.isVintage,
    collectionStatus: card.collectionStatus,
    condition: card.record.condition ?? '',
    isAutographed: card.record.isAutographed,
    autographFormat: card.record.autographFormat ?? '',
    isForTrade: card.record.isForTrade,
    isForSale: card.record.isForSale,
    askingPriceCents:
      card.record.askingPriceCents !== null ? String(card.record.askingPriceCents) : '',
    priority: card.record.priority !== null ? String(card.record.priority) : '',
    notes: card.record.notes ?? '',
    gradeEstimate: card.record.gradeEstimate ?? '',
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCurrency(cents: number | null) {
  if (cents === null) {
    return 'Not listed';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function joinFields(values: Array<string | number | null | undefined>) {
  return values.filter(Boolean).join(' · ');
}

export default function CardDetailPage() {
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuth();
  const cardId = useMemo(() => {
    const raw = router.query.cardId;
    if (!raw) {
      return null;
    }
    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.cardId]);

  const [card, setCard] = useState<CardDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [imageBusyKind, setImageBusyKind] = useState<'front' | 'back' | 'canonical' | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardId || Number.isNaN(cardId)) {
      return;
    }

    let stopped = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await getCard(cardId);
        if (stopped) {
          return;
        }
        setCard(payload);
        setForm(toFormState(payload));
      } catch (loadError) {
        if (!stopped) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      stopped = true;
    };
  }, [cardId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cardId || !form || !authenticated) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const updated = await updateCard(cardId, {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        setName: form.setName.trim() || null,
        legacySetText: form.legacySetText.trim() || null,
        season: form.season.trim() || null,
        cardNumber: form.cardNumber.trim() || null,
        yearManufactured: parseOptionalNumber(form.yearManufactured),
        player: form.player.trim() || null,
        variant: form.variant.trim() || null,
        sport: form.sport.trim() || null,
        category: form.category.trim() || null,
        subcategory: form.subcategory.trim() || null,
        originalOrReprint: form.originalOrReprint.trim() || null,
        parallelOrVariety: form.parallelOrVariety.trim() || null,
        setType: form.setType.trim() || null,
        insertSetName: form.insertSetName.trim() || null,
        cardType: form.cardType.trim() || null,
        hasAutographVariant: form.hasAutographVariant,
        isVintage: form.isVintage,
        collectionStatus: form.collectionStatus,
        condition: form.condition.trim() || null,
        isAutographed: form.isAutographed,
        autographFormat: form.autographFormat.trim() || null,
        isForTrade: form.isForTrade,
        isForSale: form.isForSale,
        askingPriceCents: parseOptionalNumber(form.askingPriceCents),
        priority: parseOptionalNumber(form.priority),
        notes: form.notes.trim() || null,
        gradeEstimate: form.gradeEstimate.trim() || null,
      });

      setCard(updated);
      setForm(toFormState(updated));
      setMessage('Card updated.');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCleanup = async () => {
    if (!form) {
      return;
    }

    setCleanupBusy(true);
    setMessage(null);
    setError(null);

    try {
      const normalized = await normalizeCardTitle({
        rawTitle: [
          form.yearManufactured,
          form.player,
          form.name,
          form.brand,
          form.setName || form.legacySetText,
          form.cardNumber ? `#${form.cardNumber}` : '',
          form.variant,
        ]
          .filter(Boolean)
          .join(' '),
        fields: {
          name: form.name || null,
          player: form.player || null,
          brand: form.brand || null,
          setName: form.setName || form.legacySetText || null,
          yearManufactured: parseOptionalNumber(form.yearManufactured),
          season: form.season || null,
          cardNumber: form.cardNumber || null,
          sport: form.sport || null,
          variant: form.variant || null,
          category: form.category || null,
          subcategory: form.subcategory || null,
          hasAutographVariant: form.hasAutographVariant,
          isVintage: form.isVintage,
        },
      });

      setForm((current) =>
        current
          ? {
              ...current,
              name: normalized.fields.name ?? current.name,
              player: normalized.fields.player ?? current.player,
              brand: normalized.fields.brand ?? current.brand,
              setName: normalized.fields.setName ?? current.setName,
              legacySetText: normalized.fields.setName ?? current.legacySetText,
              yearManufactured:
                normalized.fields.yearManufactured !== undefined &&
                normalized.fields.yearManufactured !== null
                  ? String(normalized.fields.yearManufactured)
                  : current.yearManufactured,
              season: normalized.fields.season ?? current.season,
              cardNumber: normalized.fields.cardNumber ?? current.cardNumber,
              variant: normalized.fields.variant ?? current.variant,
              sport: normalized.fields.sport ?? current.sport,
              category: normalized.fields.category ?? current.category,
              subcategory: normalized.fields.subcategory ?? current.subcategory,
              hasAutographVariant:
                normalized.fields.hasAutographVariant ?? current.hasAutographVariant,
              isVintage: normalized.fields.isVintage ?? current.isVintage,
            }
          : current,
      );
      setMessage(
        normalized.usedAi
          ? `AI cleanup applied at ${normalized.confidence.toFixed(3)} confidence.`
          : `Cleanup suggestions applied at ${normalized.confidence.toFixed(3)} confidence.`,
      );
    } catch (cleanupError) {
      setError((cleanupError as Error).message);
    } finally {
      setCleanupBusy(false);
    }
  };

  const handleUploadImage = async (kind: 'front' | 'back' | 'canonical', file: File | null) => {
    if (!cardId || !file || !authenticated) {
      return;
    }

    setImageBusyKind(kind);
    setMessage(null);
    setError(null);

    try {
      const updated = await uploadCardImage(cardId, kind, file);
      setCard(updated);
      setForm(toFormState(updated));
      setMessage(`${kind === 'canonical' ? 'Canonical' : `${kind} image`} updated.`);
    } catch (imageError) {
      setError((imageError as Error).message);
    } finally {
      setImageBusyKind(null);
    }
  };

  const handleClearImage = async (kind: 'front' | 'back' | 'canonical') => {
    if (!cardId || !authenticated) {
      return;
    }

    setImageBusyKind(kind);
    setMessage(null);
    setError(null);

    try {
      const updated = await clearCardImage(cardId, kind);
      setCard(updated);
      setForm(toFormState(updated));
      setMessage(`${kind === 'canonical' ? 'Canonical' : `${kind} image`} cleared.`);
    } catch (imageError) {
      setError((imageError as Error).message);
    } finally {
      setImageBusyKind(null);
    }
  };

  return (
    <AppShell>
      <Head>
        <title>
          {card?.definition.name
            ? `${card.definition.name} | Trading Card App`
            : 'Card Detail | Trading Card App'}
        </title>
      </Head>

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Card Detail"
          title={card?.title ?? 'Reviewing card detail'}
          description="Identity, set metadata, market state, and provenance all stay visible here so edits match the real catalog model."
          actions={
            <div className="action-row">
              <Link className="button-ghost" href="/binder">
                Back to binder
              </Link>
              {!authLoading && !authenticated ? (
                <Link className="button" href="/login">
                  Log in to edit
                </Link>
              ) : null}
            </div>
          }
        />

        {loading ? <p className="message">Loading card...</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}
        {message ? <p className="message message--success">{message}</p> : null}

        {card && form ? (
          <div className="detail-shell">
            <aside className="detail-sidebar">
              <section className="surface detail-hero">
                <CardImage alt={card.title} src={card.imageUrl} />

                <div className="pill-row">
                  <StatusPill
                    label={card.collectionStatus}
                    tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
                  />
                  <StatusPill
                    label={
                      card.record.confidence !== null
                        ? `Confidence ${card.record.confidence.toFixed(3)}`
                        : 'No confidence'
                    }
                  />
                  <StatusPill label={`Image ${card.imageSource.toLowerCase()}`} />
                </div>

                <div className="detail-grid detail-grid-spaced">
                  <div className="detail-item">
                    <strong>Set line</strong>
                    <span>
                      {joinFields([
                        card.definition.cardSet?.brand,
                        card.definition.cardSet?.setName ?? card.definition.legacySetText,
                        card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
                      ]) || 'No set line yet'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Catalog type</strong>
                    <span>
                      {joinFields([
                        card.definition.category,
                        card.definition.subcategory,
                        card.definition.cardType,
                      ]) || 'Uncategorized'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Market state</strong>
                    <span>
                      {joinFields([
                        card.record.isForSale
                          ? formatCurrency(card.record.askingPriceCents)
                          : null,
                        card.record.isForTrade ? 'Trading' : null,
                        card.collectionStatus === 'WANTED' && card.record.priority !== null
                          ? `Priority ${card.record.priority}`
                          : null,
                      ]) || 'Not listed'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Provenance</strong>
                    <span>
                      {card.record.scanJobId
                        ? `From scan ${card.record.scanJobId}`
                        : 'Imported or edited manually'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Image fallback</strong>
                    <span>
                      {card.personalImageUrl
                        ? 'Personal image available'
                        : card.canonicalImageUrl
                          ? 'Using canonical fallback'
                          : card.imageUrl
                            ? 'Using legacy remote image'
                            : 'No image source yet'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="surface">
                <div className="section-header">
                  <div>
                    <h2>Readout</h2>
                    <p className="fine-print">Current persisted values from the catalog contract.</p>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Season + sport</strong>
                    <span>
                      {joinFields([
                        card.definition.cardSet?.season,
                        card.definition.cardSet?.sport,
                      ]) || 'Unknown'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Original or reprint</strong>
                    <span>{card.definition.originalOrReprint ?? 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Parallel / variety</strong>
                    <span>{card.definition.parallelOrVariety ?? 'None logged'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Autograph state</strong>
                    <span>
                      {joinFields([
                        card.record.isAutographed ? 'Signed' : null,
                        card.record.autographFormat,
                        card.definition.hasAutographVariant ? 'Auto variant exists' : null,
                      ]) || 'Not marked'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Condition + grade</strong>
                    <span>
                      {joinFields([card.record.condition, card.record.gradeEstimate]) || 'Unscored'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Last updated</strong>
                    <span>{formatDate(card.record.updatedAt)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Canonical image</strong>
                    <span>{card.canonicalImageUrl ? 'Available as shared fallback' : 'Not set yet'}</span>
                  </div>
                </div>
              </section>
            </aside>

            <section className="stack">
              {!authenticated ? (
                <section className="surface gate-card">
                  <h2 className="surface-title">Viewing the demo card in read-only mode</h2>
                  <p className="surface-copy">
                    Guests can inspect the richer card detail surface, but edits, trade flags, wishlist priority, and future profile activity belong to signed-in collectors.
                  </p>
                  <div className="action-row">
                    <Link className="button" href="/login">
                      Log in
                    </Link>
                    <Link className="button-secondary" href="/signup">
                      Create account
                    </Link>
                  </div>
                </section>
              ) : null}

              <form className="stack" onSubmit={handleSubmit}>
                <section className="surface">
                  <div className="section-header">
                    <div>
                      <h2>Images</h2>
                      <p className="fine-print">Personal front/back images live on your card record. Canonical images become the shared fallback for this card definition.</p>
                    </div>
                  </div>

                  <div className="preview-grid">
                    <div className="preview-frame">
                      <h3>Front / primary</h3>
                      <CardImage alt={`${card.title} front`} src={card.frontImageUrl ?? card.imageUrl} />
                      {authenticated ? (
                        <div className="action-row">
                          <label className="button-secondary button-file">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleUploadImage('front', event.target.files?.[0] ?? null)}
                              disabled={imageBusyKind !== null}
                            />
                            {imageBusyKind === 'front' ? 'Uploading...' : 'Upload front'}
                          </label>
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() => void handleClearImage('front')}
                            disabled={imageBusyKind !== null || !card.personalImageUrl}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="preview-frame">
                      <h3>Back</h3>
                      <CardImage alt={`${card.title} back`} src={card.backImageUrl} />
                      {authenticated ? (
                        <div className="action-row">
                          <label className="button-secondary button-file">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleUploadImage('back', event.target.files?.[0] ?? null)}
                              disabled={imageBusyKind !== null}
                            />
                            {imageBusyKind === 'back' ? 'Uploading...' : 'Upload back'}
                          </label>
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() => void handleClearImage('back')}
                            disabled={imageBusyKind !== null || !card.backImageUrl}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="preview-frame">
                      <h3>Canonical fallback</h3>
                      <CardImage alt={`${card.title} canonical`} src={card.canonicalImageUrl} />
                      {authenticated ? (
                        <div className="action-row">
                          <label className="button-secondary button-file">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                void handleUploadImage('canonical', event.target.files?.[0] ?? null)
                              }
                              disabled={imageBusyKind !== null}
                            />
                            {imageBusyKind === 'canonical' ? 'Uploading...' : 'Upload canonical'}
                          </label>
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() => void handleClearImage('canonical')}
                            disabled={imageBusyKind !== null || !card.canonicalImageUrl}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="surface">
                  <div className="section-header">
                    <div>
                      <h2>Identity</h2>
                      <p className="fine-print">The public-facing card identity and search hooks.</p>
                    </div>
                    {authenticated ? (
                      <button className="button-secondary" type="button" onClick={() => void handleCleanup()} disabled={cleanupBusy}>
                        {cleanupBusy ? 'Cleaning...' : 'Suggest cleanup'}
                      </button>
                    ) : null}
                  </div>

                  <div className="field-grid field-grid--three">
                    <div className="field">
                      <label htmlFor="name">Card name</label>
                      <input
                        id="name"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        disabled={!authenticated}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="player">Player</label>
                      <input
                        id="player"
                        value={form.player}
                        onChange={(event) => setForm({ ...form, player: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="variant">Variant</label>
                      <input
                        id="variant"
                        value={form.variant}
                        onChange={(event) => setForm({ ...form, variant: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="category">Category</label>
                      <input
                        id="category"
                        value={form.category}
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="subcategory">Subcategory</label>
                      <input
                        id="subcategory"
                        value={form.subcategory}
                        onChange={(event) => setForm({ ...form, subcategory: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="cardType">Card type</label>
                      <input
                        id="cardType"
                        value={form.cardType}
                        onChange={(event) => setForm({ ...form, cardType: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>
                  </div>
                </section>

                <section className="surface">
                  <div className="section-header">
                    <div>
                      <h2>Set metadata</h2>
                      <p className="fine-print">Brand, season, numbering, and release context.</p>
                    </div>
                  </div>

                  <div className="field-grid field-grid--three">
                    <div className="field">
                      <label htmlFor="brand">Brand</label>
                      <input
                        id="brand"
                        value={form.brand}
                        onChange={(event) => setForm({ ...form, brand: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="setName">Set name</label>
                      <input
                        id="setName"
                        value={form.setName}
                        onChange={(event) => setForm({ ...form, setName: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="legacySetText">Legacy set text</label>
                      <input
                        id="legacySetText"
                        value={form.legacySetText}
                        onChange={(event) => setForm({ ...form, legacySetText: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="season">Season</label>
                      <input
                        id="season"
                        value={form.season}
                        onChange={(event) => setForm({ ...form, season: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="sport">Sport</label>
                      <input
                        id="sport"
                        value={form.sport}
                        onChange={(event) => setForm({ ...form, sport: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="cardNumber">Card number</label>
                      <input
                        id="cardNumber"
                        value={form.cardNumber}
                        onChange={(event) => setForm({ ...form, cardNumber: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="yearManufactured">Year manufactured</label>
                      <input
                        id="yearManufactured"
                        inputMode="numeric"
                        value={form.yearManufactured}
                        onChange={(event) =>
                          setForm({ ...form, yearManufactured: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="setType">Set type</label>
                      <input
                        id="setType"
                        value={form.setType}
                        onChange={(event) => setForm({ ...form, setType: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="insertSetName">Insert set name</label>
                      <input
                        id="insertSetName"
                        value={form.insertSetName}
                        onChange={(event) =>
                          setForm({ ...form, insertSetName: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="parallelOrVariety">Parallel / variety</label>
                      <input
                        id="parallelOrVariety"
                        value={form.parallelOrVariety}
                        onChange={(event) =>
                          setForm({ ...form, parallelOrVariety: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="originalOrReprint">Original or reprint</label>
                      <input
                        id="originalOrReprint"
                        value={form.originalOrReprint}
                        onChange={(event) =>
                          setForm({ ...form, originalOrReprint: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>
                  </div>
                </section>

                <section className="surface">
                  <div className="section-header">
                    <div>
                      <h2>Ownership + market state</h2>
                      <p className="fine-print">Collection status, condition, grading, and disposition.</p>
                    </div>
                  </div>

                  <div className="field-grid field-grid--three">
                    <div className="field">
                      <label htmlFor="status">Status</label>
                      <select
                        id="status"
                        value={form.collectionStatus}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            collectionStatus: event.target.value as CollectionStatus,
                          })
                        }
                        disabled={!authenticated}
                      >
                        <option value="OWNED">Owned</option>
                        <option value="WANTED">Wanted</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="condition">Condition</label>
                      <input
                        id="condition"
                        value={form.condition}
                        onChange={(event) => setForm({ ...form, condition: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="gradeEstimate">Grade estimate</label>
                      <input
                        id="gradeEstimate"
                        value={form.gradeEstimate}
                        onChange={(event) =>
                          setForm({ ...form, gradeEstimate: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="askingPriceCents">Asking price (cents)</label>
                      <input
                        id="askingPriceCents"
                        inputMode="numeric"
                        value={form.askingPriceCents}
                        onChange={(event) =>
                          setForm({ ...form, askingPriceCents: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="priority">Wishlist priority</label>
                      <input
                        id="priority"
                        inputMode="numeric"
                        value={form.priority}
                        onChange={(event) => setForm({ ...form, priority: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="autographFormat">Autograph format</label>
                      <input
                        id="autographFormat"
                        value={form.autographFormat}
                        onChange={(event) =>
                          setForm({ ...form, autographFormat: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>
                  </div>

                  <div className="toggle-grid">
                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={form.isAutographed}
                        onChange={(event) =>
                          setForm({ ...form, isAutographed: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span>Autographed copy</span>
                    </label>

                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={form.hasAutographVariant}
                        onChange={(event) =>
                          setForm({ ...form, hasAutographVariant: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span>Auto variant exists</span>
                    </label>

                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={form.isVintage}
                        onChange={(event) =>
                          setForm({ ...form, isVintage: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span>Vintage flag</span>
                    </label>

                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={form.isForTrade}
                        onChange={(event) =>
                          setForm({ ...form, isForTrade: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span>Available for trade</span>
                    </label>

                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={form.isForSale}
                        onChange={(event) =>
                          setForm({ ...form, isForSale: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span>Available for sale</span>
                    </label>
                  </div>
                </section>

                <section className="surface">
                  <div className="section-header">
                    <div>
                      <h2>Notes + provenance</h2>
                      <p className="fine-print">Collector notes and how this record entered the system.</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-item">
                      <strong>Created</strong>
                      <span>{formatDate(card.record.createdAt)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Updated</strong>
                      <span>{formatDate(card.record.updatedAt)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Scan job</strong>
                      <span>{card.record.scanJobId ?? 'None linked'}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Current asking price</strong>
                      <span>{formatCurrency(card.record.askingPriceCents)}</span>
                    </div>
                  </div>

                  <div className="field field--textarea">
                    <label htmlFor="notes">Collector notes</label>
                    <textarea
                      id="notes"
                      rows={5}
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      disabled={!authenticated}
                    />
                  </div>
                </section>

                <div className="action-row">
                  <button className="button" type="submit" disabled={busy || !authenticated}>
                    {busy ? 'Saving...' : 'Save changes'}
                  </button>
                  <Link className="button-secondary" href="/binder">
                    Return to binder
                  </Link>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
