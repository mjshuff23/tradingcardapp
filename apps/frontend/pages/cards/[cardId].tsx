import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CardImage } from '../../components/CardImage';
import { PageHeader } from '../../components/PageHeader';
import { StatusPill } from '../../components/StatusPill';
import { SuggestionPreview } from '../../components/SuggestionPreview';
import { ThemedSelect, ThemedSelectOption } from '../../components/ThemedSelect';
import { useAuth } from '../../lib/auth-context';
import {
  actionRowClass,
  checkboxInputClass,
  checkboxRowClass,
  cn,
  detailGridClass,
  detailItemClass,
  detailLabelClass,
  detailValueClass,
  fieldClass,
  fieldGridClass,
  fieldLabelClass,
  fileButtonClass,
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
  textareaClass,
} from '../../lib/ui';
import {
  CardDetail,
  CardTaxonomy,
  CollectionStatus,
  clearCardImage,
  getCard,
  getCardTaxonomy,
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

const NORMALIZATION_FIELD_LABELS: Record<string, string> = {
  name: 'Card name',
  player: 'Player',
  brand: 'Brand',
  setName: 'Set name',
  yearManufactured: 'Year',
  season: 'Season',
  cardNumber: 'Card number',
  sport: 'Sport',
  variant: 'Variant',
  category: 'Category',
  subcategory: 'Subcategory',
  hasAutographVariant: 'Auto variant exists',
  isVintage: 'Vintage flag',
};

function applyNormalizationToForm(form: FormState, normalized: Awaited<ReturnType<typeof normalizeCardTitle>>): FormState {
  return {
    ...form,
    name: normalized.fields.name ?? form.name,
    player: normalized.fields.player ?? form.player,
    brand: normalized.fields.brand ?? form.brand,
    setName: normalized.fields.setName ?? form.setName,
    legacySetText: normalized.fields.setName ?? form.legacySetText,
    season: normalized.fields.season ?? form.season,
    cardNumber: normalized.fields.cardNumber ?? form.cardNumber,
    yearManufactured:
      normalized.fields.yearManufactured !== undefined &&
      normalized.fields.yearManufactured !== null
        ? String(normalized.fields.yearManufactured)
        : form.yearManufactured,
    variant: normalized.fields.variant ?? form.variant,
    sport: normalized.fields.sport ?? form.sport,
    category: normalized.fields.category ?? form.category,
    subcategory: normalized.fields.subcategory ?? form.subcategory,
    hasAutographVariant:
      normalized.fields.hasAutographVariant ?? form.hasAutographVariant,
    isVintage: normalized.fields.isVintage ?? form.isVintage,
  };
}

function buildSuggestionItems(
  form: FormState,
  normalized: Awaited<ReturnType<typeof normalizeCardTitle>> | null,
) {
  if (!normalized) {
    return [];
  }

  const currentValues: Record<string, string> = {
    name: form.name || 'Empty',
    player: form.player || 'Empty',
    brand: form.brand || 'Empty',
    setName: form.setName || 'Empty',
    yearManufactured: form.yearManufactured || 'Empty',
    season: form.season || 'Empty',
    cardNumber: form.cardNumber || 'Empty',
    sport: form.sport || 'Empty',
    variant: form.variant || 'Empty',
    category: form.category || 'Empty',
    subcategory: form.subcategory || 'Empty',
    hasAutographVariant: form.hasAutographVariant ? 'Yes' : 'No',
    isVintage: form.isVintage ? 'Yes' : 'No',
  };

  return normalized.changedFields.map((field) => {
    const suggestedValue = normalized.fields[field as keyof typeof normalized.fields];
    return {
      field: NORMALIZATION_FIELD_LABELS[field] ?? field,
      previous: currentValues[field] ?? 'Empty',
      next:
        typeof suggestedValue === 'boolean'
          ? suggestedValue
            ? 'Yes'
            : 'No'
          : suggestedValue === null || suggestedValue === undefined || suggestedValue === ''
            ? 'Empty'
            : String(suggestedValue),
    };
  });
}

function toSelectOptions(values: string[], currentValue?: string | null): ThemedSelectOption[] {
  const unique = Array.from(new Set([...values, currentValue ?? ''].filter(Boolean)));
  return unique.map((value) => ({ value, label: value }));
}

function subcategoryOptions(taxonomy: CardTaxonomy | null, category: string | null | undefined) {
  if (!taxonomy || !category) {
    return [];
  }

  const group = taxonomy.groups.find((entry) => entry.category === category);
  return group ? group.subcategories.map((subcategory) => subcategory.name) : [];
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
  const [taxonomy, setTaxonomy] = useState<CardTaxonomy | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<Awaited<
    ReturnType<typeof normalizeCardTitle>
  > | null>(null);
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
        const [payload, taxonomyPayload] = await Promise.all([
          getCard(cardId),
          getCardTaxonomy(),
        ]);
        if (stopped) {
          return;
        }
        setCard(payload);
        setForm(toFormState(payload));
        setTaxonomy(taxonomyPayload);
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
        condition:
          form.collectionStatus === 'WANTED' ? null : form.condition.trim() || null,
        isAutographed:
          form.collectionStatus === 'WANTED' ? false : form.isAutographed,
        autographFormat:
          form.collectionStatus === 'WANTED' ? null : form.autographFormat.trim() || null,
        isForTrade:
          form.collectionStatus === 'WANTED' ? false : form.isForTrade,
        isForSale:
          form.collectionStatus === 'WANTED' ? false : form.isForSale,
        askingPriceCents:
          form.collectionStatus === 'WANTED'
            ? null
            : parseOptionalNumber(form.askingPriceCents),
        priority:
          form.collectionStatus === 'WANTED'
            ? parseOptionalNumber(form.priority)
            : null,
        notes: form.notes.trim() || null,
        gradeEstimate:
          form.collectionStatus === 'WANTED' ? null : form.gradeEstimate.trim() || null,
      });

      setCard(updated);
      setForm(toFormState(updated));
      setPendingSuggestion(null);
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

      setPendingSuggestion(normalized);
      setMessage(
        normalized.usedAi
          ? `AI cleanup ready at ${normalized.confidence.toFixed(3)} confidence.`
          : normalized.changedFields.length
            ? `Cleanup suggestions ready at ${normalized.confidence.toFixed(3)} confidence.`
            : 'No better suggestion found from the current title.',
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

  const applyPendingSuggestion = () => {
    if (!form || !pendingSuggestion) {
      return;
    }

    setForm(applyNormalizationToForm(form, pendingSuggestion));
    setPendingSuggestion(null);
    setMessage('Suggested cleanup applied to the form.');
  };

  const isWanted = form?.collectionStatus === 'WANTED';
  const categoryOptions = taxonomy?.groups.map((group) => group.category) ?? [];
  const activeSubcategoryOptions = subcategoryOptions(taxonomy, form?.category);
  const suggestionItems = form ? buildSuggestionItems(form, pendingSuggestion) : [];

  return (
    <AppShell>
      <Head>
        <title>
          {card?.definition.name
            ? `${card.definition.name} | Trading Card App`
            : 'Card Detail | Trading Card App'}
        </title>
      </Head>

      <div className={pageStackClass}>
        <PageHeader
          eyebrow="Card Detail"
          title={card?.title ?? 'Reviewing card detail'}
          description="Identity, set metadata, market state, and provenance all stay visible here so edits match the real catalog model."
          actions={
            <div className={actionRowClass}>
              <Link className={ghostButtonClass} href="/binder">
                Back to binder
              </Link>
              {!authLoading && !authenticated ? (
                <Link className={primaryButtonClass} href="/login">
                  Log in to edit
                </Link>
              ) : null}
            </div>
          }
        />

        {loading ? <p className={messageClass()}>Loading card...</p> : null}
        {error ? <p className={messageClass('error')}>{error}</p> : null}
        {message ? <p className={messageClass('success')}>{message}</p> : null}

        {card && form ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
            <aside className="flex flex-col gap-6">
              <section className={cn(surfaceClass, 'flex flex-col gap-6 p-6 sm:p-8')}>
                <CardImage alt={card.title} src={card.imageUrl} />

                <div className="flex flex-wrap gap-3">
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

                <div className={cn(detailGridClass, 'mt-1')}>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Set line</strong>
                    <span className={detailValueClass}>
                      {joinFields([
                        card.definition.cardSet?.brand,
                        card.definition.cardSet?.setName ?? card.definition.legacySetText,
                        card.definition.cardNumber ? `#${card.definition.cardNumber}` : null,
                      ]) || 'No set line yet'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Catalog type</strong>
                    <span className={detailValueClass}>
                      {joinFields([
                        card.definition.category,
                        card.definition.subcategory,
                        card.definition.cardType,
                      ]) || 'Uncategorized'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Market state</strong>
                    <span className={detailValueClass}>
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
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Provenance</strong>
                    <span className={detailValueClass}>
                      {card.record.scanJobId
                        ? `From scan ${card.record.scanJobId}`
                        : 'Imported or edited manually'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Image fallback</strong>
                    <span className={detailValueClass}>
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

              <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                <div className={sectionHeaderClass}>
                  <div>
                    <h2 className={surfaceTitleClass}>Readout</h2>
                    <p className={cn(finePrintClass, 'mt-2')}>
                      Current persisted values from the catalog contract.
                    </p>
                  </div>
                </div>

                <div className={cn(detailGridClass, 'mt-6')}>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Season + sport</strong>
                    <span className={detailValueClass}>
                      {joinFields([
                        card.definition.cardSet?.season,
                        card.definition.cardSet?.sport,
                      ]) || 'Unknown'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Original or reprint</strong>
                    <span className={detailValueClass}>
                      {card.definition.originalOrReprint ?? 'Unknown'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Parallel / variety</strong>
                    <span className={detailValueClass}>
                      {card.definition.parallelOrVariety ?? 'None logged'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Autograph state</strong>
                    <span className={detailValueClass}>
                      {joinFields([
                        card.record.isAutographed ? 'Signed' : null,
                        card.record.autographFormat,
                        card.definition.hasAutographVariant ? 'Auto variant exists' : null,
                      ]) || 'Not marked'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Condition + grade</strong>
                    <span className={detailValueClass}>
                      {joinFields([card.record.condition, card.record.gradeEstimate]) || 'Unscored'}
                    </span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Last updated</strong>
                    <span className={detailValueClass}>{formatDate(card.record.updatedAt)}</span>
                  </div>
                  <div className={detailItemClass}>
                    <strong className={detailLabelClass}>Canonical image</strong>
                    <span className={detailValueClass}>
                      {card.canonicalImageUrl ? 'Available as shared fallback' : 'Not set yet'}
                    </span>
                  </div>
                </div>
              </section>
            </aside>

            <section className="flex flex-col gap-6">
              {pendingSuggestion ? (
                <SuggestionPreview
                  title="Cleanup preview"
                  subtitle={
                    pendingSuggestion.usedAi
                      ? `AI refinement suggested ${pendingSuggestion.changedFields.length} field change(s).`
                      : `Parser pass suggested ${pendingSuggestion.changedFields.length} field change(s).`
                  }
                  items={suggestionItems}
                  emptyMessage="No better suggestion found from the current title."
                  applyLabel="Apply suggestions"
                  onApply={applyPendingSuggestion}
                  onDismiss={() => setPendingSuggestion(null)}
                />
              ) : null}

              {!authenticated ? (
                <section
                  className={cn(
                    surfaceClass,
                    'bg-[linear-gradient(145deg,rgba(66,110,105,0.12),transparent_65%),var(--surface)] p-6 sm:p-8',
                  )}
                >
                  <h2 className={surfaceTitleClass}>Viewing the demo card in read-only mode</h2>
                  <p className={cn(surfaceCopyClass, 'mt-3')}>
                    Guests can inspect the richer card detail surface, but edits, trade flags, wishlist priority, and future profile activity belong to signed-in collectors.
                  </p>
                  <div className={cn(actionRowClass, 'mt-5')}>
                    <Link className={primaryButtonClass} href="/login">
                      Log in
                    </Link>
                    <Link className={secondaryButtonClass} href="/signup">
                      Create account
                    </Link>
                  </div>
                </section>
              ) : null}

              <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                  <div className={sectionHeaderClass}>
                    <div>
                      <h2 className={surfaceTitleClass}>Images</h2>
                      <p className={cn(finePrintClass, 'mt-2')}>
                        Personal front/back images live on your card record. Canonical images become
                        the shared fallback for this card definition.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <div className={cn(softSurfaceClass, 'p-4')}>
                      <h3 className={fieldLabelClass}>Front / primary</h3>
                      <CardImage alt={`${card.title} front`} src={card.frontImageUrl ?? card.imageUrl} />
                      {authenticated ? (
                        <div className={cn(actionRowClass, 'mt-4')}>
                          <label className={cn(secondaryButtonClass, fileButtonClass)}>
                            <input
                              className={hiddenFileInputClass}
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleUploadImage('front', event.target.files?.[0] ?? null)}
                              disabled={imageBusyKind !== null}
                            />
                            {imageBusyKind === 'front' ? 'Uploading...' : 'Upload front'}
                          </label>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => void handleClearImage('front')}
                            disabled={imageBusyKind !== null || !card.personalImageUrl}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className={cn(softSurfaceClass, 'p-4')}>
                      <h3 className={fieldLabelClass}>Back</h3>
                      <CardImage alt={`${card.title} back`} src={card.backImageUrl} />
                      {authenticated ? (
                        <div className={cn(actionRowClass, 'mt-4')}>
                          <label className={cn(secondaryButtonClass, fileButtonClass)}>
                            <input
                              className={hiddenFileInputClass}
                              type="file"
                              accept="image/*"
                              onChange={(event) => void handleUploadImage('back', event.target.files?.[0] ?? null)}
                              disabled={imageBusyKind !== null}
                            />
                            {imageBusyKind === 'back' ? 'Uploading...' : 'Upload back'}
                          </label>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => void handleClearImage('back')}
                            disabled={imageBusyKind !== null || !card.backImageUrl}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className={cn(softSurfaceClass, 'p-4')}>
                      <h3 className={fieldLabelClass}>Canonical fallback</h3>
                      <CardImage alt={`${card.title} canonical`} src={card.canonicalImageUrl} />
                      {authenticated ? (
                        <div className={cn(actionRowClass, 'mt-4')}>
                          <label className={cn(secondaryButtonClass, fileButtonClass)}>
                            <input
                              className={hiddenFileInputClass}
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
                            className={ghostButtonClass}
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

                <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                  <div className={sectionHeaderClass}>
                    <div>
                      <h2 className={surfaceTitleClass}>Identity</h2>
                      <p className={cn(finePrintClass, 'mt-2')}>
                        The public-facing card identity and search hooks.
                      </p>
                    </div>
                    {authenticated ? (
                      <button
                        className={secondaryButtonClass}
                        type="button"
                        onClick={() => void handleCleanup()}
                        disabled={cleanupBusy}
                      >
                        {cleanupBusy ? 'Cleaning...' : 'Suggest cleanup'}
                      </button>
                    ) : null}
                  </div>

                  <div className={cn(fieldGridClass, 'mt-6')}>
                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="name">
                        Card name
                      </label>
                      <input
                        className={inputClass}
                        id="name"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        disabled={!authenticated}
                        required
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="player">
                        Player
                      </label>
                      <input
                        className={inputClass}
                        id="player"
                        value={form.player}
                        onChange={(event) => setForm({ ...form, player: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="variant">
                        Variant
                      </label>
                      <input
                        className={inputClass}
                        id="variant"
                        value={form.variant}
                        onChange={(event) => setForm({ ...form, variant: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="category">
                        Category
                      </label>
                      <ThemedSelect
                        value={form.category}
                        onChange={(nextValue) =>
                          setForm({
                            ...form,
                            category: nextValue,
                            subcategory:
                              nextValue === form.category ? form.subcategory : '',
                          })
                        }
                        disabled={!authenticated}
                        placeholder="Select category"
                        options={toSelectOptions(categoryOptions, form.category)}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="subcategory">
                        Subcategory
                      </label>
                      <ThemedSelect
                        value={form.subcategory}
                        onChange={(nextValue) => setForm({ ...form, subcategory: nextValue })}
                        disabled={!authenticated || !form.category}
                        placeholder={form.category ? 'Select subcategory' : 'Pick category first'}
                        options={toSelectOptions(activeSubcategoryOptions, form.subcategory)}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="cardType">
                        Card type
                      </label>
                      <input
                        className={inputClass}
                        id="cardType"
                        value={form.cardType}
                        onChange={(event) => setForm({ ...form, cardType: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>
                  </div>
                </section>

                <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                  <div className={sectionHeaderClass}>
                    <div>
                      <h2 className={surfaceTitleClass}>Set metadata</h2>
                      <p className={cn(finePrintClass, 'mt-2')}>
                        Brand, season, numbering, and release context.
                      </p>
                    </div>
                  </div>

                  <div className={cn(fieldGridClass, 'mt-6')}>
                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="brand">
                        Brand
                      </label>
                      <input
                        className={inputClass}
                        id="brand"
                        value={form.brand}
                        onChange={(event) => setForm({ ...form, brand: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="setName">
                        Set name
                      </label>
                      <input
                        className={inputClass}
                        id="setName"
                        value={form.setName}
                        onChange={(event) => setForm({ ...form, setName: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="legacySetText">
                        Legacy set text
                      </label>
                      <input
                        className={inputClass}
                        id="legacySetText"
                        value={form.legacySetText}
                        onChange={(event) => setForm({ ...form, legacySetText: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="season">
                        Season
                      </label>
                      <input
                        className={inputClass}
                        id="season"
                        value={form.season}
                        onChange={(event) => setForm({ ...form, season: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="sport">
                        Sport
                      </label>
                      <input
                        className={inputClass}
                        id="sport"
                        value={form.sport}
                        onChange={(event) => setForm({ ...form, sport: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="cardNumber">
                        Card number
                      </label>
                      <input
                        className={inputClass}
                        id="cardNumber"
                        value={form.cardNumber}
                        onChange={(event) => setForm({ ...form, cardNumber: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="yearManufactured">
                        Year manufactured
                      </label>
                      <input
                        className={inputClass}
                        id="yearManufactured"
                        inputMode="numeric"
                        value={form.yearManufactured}
                        onChange={(event) =>
                          setForm({ ...form, yearManufactured: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="setType">
                        Set type
                      </label>
                      <input
                        className={inputClass}
                        id="setType"
                        value={form.setType}
                        onChange={(event) => setForm({ ...form, setType: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="insertSetName">
                        Insert set name
                      </label>
                      <input
                        className={inputClass}
                        id="insertSetName"
                        value={form.insertSetName}
                        onChange={(event) =>
                          setForm({ ...form, insertSetName: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="parallelOrVariety">
                        Parallel / variety
                      </label>
                      <input
                        className={inputClass}
                        id="parallelOrVariety"
                        value={form.parallelOrVariety}
                        onChange={(event) =>
                          setForm({ ...form, parallelOrVariety: event.target.value })
                        }
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="originalOrReprint">
                        Original or reprint
                      </label>
                      <input
                        className={inputClass}
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

                <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                  <div className={sectionHeaderClass}>
                    <div>
                      <h2 className={surfaceTitleClass}>Ownership + market state</h2>
                      <p className={cn(finePrintClass, 'mt-2')}>
                        Collection status, condition, grading, and disposition.
                      </p>
                    </div>
                  </div>

                  {isWanted ? (
                    <p className={cn(messageClass(), 'mt-6')}>
                      Wanted cards keep wishlist priority and notes active. Copy-specific fields like condition, grade, autograph state, and sale/trade controls are disabled.
                    </p>
                  ) : null}

                  <div className={cn(fieldGridClass, 'mt-6')}>
                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="status">
                        Status
                      </label>
                      <ThemedSelect
                        value={form.collectionStatus}
                        onChange={(nextValue) =>
                          setForm({
                            ...form,
                            collectionStatus: nextValue as CollectionStatus,
                          })
                        }
                        disabled={!authenticated}
                        options={[
                          { value: 'OWNED', label: 'Owned' },
                          { value: 'WANTED', label: 'Wanted' },
                        ]}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="condition">
                        Condition
                      </label>
                      <input
                        className={inputClass}
                        id="condition"
                        value={form.condition}
                        onChange={(event) => setForm({ ...form, condition: event.target.value })}
                        disabled={!authenticated || isWanted}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="gradeEstimate">
                        Grade estimate
                      </label>
                      <input
                        className={inputClass}
                        id="gradeEstimate"
                        value={form.gradeEstimate}
                        onChange={(event) =>
                          setForm({ ...form, gradeEstimate: event.target.value })
                        }
                        disabled={!authenticated || isWanted}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="askingPriceCents">
                        Asking price (cents)
                      </label>
                      <input
                        className={inputClass}
                        id="askingPriceCents"
                        inputMode="numeric"
                        value={form.askingPriceCents}
                        onChange={(event) =>
                          setForm({ ...form, askingPriceCents: event.target.value })
                        }
                        disabled={!authenticated || isWanted}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="priority">
                        Wishlist priority
                      </label>
                      <input
                        className={inputClass}
                        id="priority"
                        inputMode="numeric"
                        value={form.priority}
                        onChange={(event) => setForm({ ...form, priority: event.target.value })}
                        disabled={!authenticated}
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={fieldLabelClass} htmlFor="autographFormat">
                        Autograph format
                      </label>
                      <input
                        className={inputClass}
                        id="autographFormat"
                        value={form.autographFormat}
                        onChange={(event) =>
                          setForm({ ...form, autographFormat: event.target.value })
                        }
                        disabled={!authenticated || isWanted}
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <label className={cn(checkboxRowClass, 'cursor-pointer')}>
                      <input
                        className={checkboxInputClass}
                        type="checkbox"
                        checked={form.isAutographed}
                        onChange={(event) =>
                          setForm({ ...form, isAutographed: event.target.checked })
                        }
                        disabled={!authenticated || isWanted}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">Autographed copy</span>
                    </label>

                    <label className={cn(checkboxRowClass, 'cursor-pointer')}>
                      <input
                        className={checkboxInputClass}
                        type="checkbox"
                        checked={form.hasAutographVariant}
                        onChange={(event) =>
                          setForm({ ...form, hasAutographVariant: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">
                        Auto variant exists
                      </span>
                    </label>

                    <label className={cn(checkboxRowClass, 'cursor-pointer')}>
                      <input
                        className={checkboxInputClass}
                        type="checkbox"
                        checked={form.isVintage}
                        onChange={(event) =>
                          setForm({ ...form, isVintage: event.target.checked })
                        }
                        disabled={!authenticated}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">Vintage flag</span>
                    </label>

                    <label className={cn(checkboxRowClass, 'cursor-pointer')}>
                      <input
                        className={checkboxInputClass}
                        type="checkbox"
                        checked={form.isForTrade}
                        onChange={(event) =>
                          setForm({ ...form, isForTrade: event.target.checked })
                        }
                        disabled={!authenticated || isWanted}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">
                        Available for trade
                      </span>
                    </label>

                    <label className={cn(checkboxRowClass, 'cursor-pointer')}>
                      <input
                        className={checkboxInputClass}
                        type="checkbox"
                        checked={form.isForSale}
                        onChange={(event) =>
                          setForm({ ...form, isForSale: event.target.checked })
                        }
                        disabled={!authenticated || isWanted}
                      />
                      <span className="text-sm font-medium text-[var(--text)]">
                        Available for sale
                      </span>
                    </label>
                  </div>
                </section>

                <section className={cn(surfaceClass, 'p-6 sm:p-8')}>
                  <div className={sectionHeaderClass}>
                    <div>
                      <h2 className={surfaceTitleClass}>Notes + provenance</h2>
                      <p className={cn(finePrintClass, 'mt-2')}>
                        Collector notes and how this record entered the system.
                      </p>
                    </div>
                  </div>

                  <div className={cn(detailGridClass, 'mt-6')}>
                    <div className={detailItemClass}>
                      <strong className={detailLabelClass}>Created</strong>
                      <span className={detailValueClass}>{formatDate(card.record.createdAt)}</span>
                    </div>
                    <div className={detailItemClass}>
                      <strong className={detailLabelClass}>Updated</strong>
                      <span className={detailValueClass}>{formatDate(card.record.updatedAt)}</span>
                    </div>
                    <div className={detailItemClass}>
                      <strong className={detailLabelClass}>Scan job</strong>
                      <span className={detailValueClass}>{card.record.scanJobId ?? 'None linked'}</span>
                    </div>
                    <div className={detailItemClass}>
                      <strong className={detailLabelClass}>Current asking price</strong>
                      <span className={detailValueClass}>
                        {formatCurrency(card.record.askingPriceCents)}
                      </span>
                    </div>
                  </div>

                  <div className={cn(fieldClass, 'mt-6')}>
                    <label className={fieldLabelClass} htmlFor="notes">
                      Collector notes
                    </label>
                    <textarea
                      className={textareaClass}
                      id="notes"
                      rows={5}
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      disabled={!authenticated}
                    />
                  </div>
                </section>

                <div className={actionRowClass}>
                  <button className={primaryButtonClass} type="submit" disabled={busy || !authenticated}>
                    {busy ? 'Saving...' : 'Save changes'}
                  </button>
                  <Link className={secondaryButtonClass} href="/binder">
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
