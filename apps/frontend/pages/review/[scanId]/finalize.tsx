import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { CardImage } from '../../../components/CardImage';
import { PageHeader } from '../../../components/PageHeader';
import { StatusPill } from '../../../components/StatusPill';
import { SuggestionPreview } from '../../../components/SuggestionPreview';
import { ThemedSelect, ThemedSelectOption } from '../../../components/ThemedSelect';
import { useAuth } from '../../../lib/auth-context';
import {
  CardTaxonomy,
  CollectionStatus,
  ScanCandidate,
  ScanResponse,
  confirmScan,
  getCardTaxonomy,
  getScan,
  normalizeCardTitle,
} from '../../../lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FinalizeFormState = {
  rawTitle: string;
  name: string;
  player: string;
  set: string;
  setName: string;
  brand: string;
  year: string;
  season: string;
  cardNumber: string;
  variant: string;
  sport: string;
  category: string;
  subcategory: string;
  collectionStatus: CollectionStatus;
  condition: string;
  notes: string;
  gradeEstimate: string;
  isAutographed: boolean;
  autographFormat: string;
  isForTrade: boolean;
  isForSale: boolean;
  askingPriceCents: string;
  priority: string;
  hasAutographVariant: boolean;
  isVintage: boolean;
  keepScanImage: boolean;
  promoteToCanonical: boolean;
};

function toAbsoluteApiUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `${API_ORIGIN}${url}`;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function candidateToRawTitle(candidate: ScanCandidate) {
  return [
    candidate.season ?? candidate.year,
    candidate.brand,
    candidate.player,
    candidate.name,
    candidate.setName ?? candidate.legacySetText ?? candidate.set,
    candidate.cardNumber ? `#${candidate.cardNumber}` : null,
    candidate.variant,
    candidate.sport,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildInitialForm(candidate: ScanCandidate) {
  return {
    rawTitle: candidateToRawTitle(candidate),
    name: candidate.name ?? '',
    player: candidate.player ?? '',
    set: candidate.legacySetText ?? candidate.set ?? '',
    setName: candidate.setName ?? candidate.set ?? '',
    brand: candidate.brand ?? '',
    year: candidate.year ? String(candidate.year) : '',
    season: candidate.season ?? '',
    cardNumber: candidate.cardNumber ?? '',
    variant: candidate.variant ?? '',
    sport: candidate.sport ?? '',
    category: '',
    subcategory: '',
    collectionStatus: 'OWNED' as CollectionStatus,
    condition: '',
    notes: '',
    gradeEstimate: '',
    isAutographed: false,
    autographFormat: '',
    isForTrade: false,
    isForSale: false,
    askingPriceCents: '',
    priority: '',
    hasAutographVariant: false,
    isVintage: false,
    keepScanImage: true,
    promoteToCanonical: false,
  };
}

function applyNormalization(
  current: FinalizeFormState,
  result: Awaited<ReturnType<typeof normalizeCardTitle>>,
): FinalizeFormState {
  return {
    ...current,
    rawTitle: result.cleanedTitle || current.rawTitle,
    name: result.fields.name ?? current.name,
    player: result.fields.player ?? current.player,
    setName: result.fields.setName ?? current.setName,
    brand: result.fields.brand ?? current.brand,
    year:
      result.fields.yearManufactured !== undefined && result.fields.yearManufactured !== null
        ? String(result.fields.yearManufactured)
        : current.year,
    season: result.fields.season ?? current.season,
    cardNumber: result.fields.cardNumber ?? current.cardNumber,
    variant: result.fields.variant ?? current.variant,
    sport: result.fields.sport ?? current.sport,
    category: result.fields.category ?? current.category,
    subcategory: result.fields.subcategory ?? current.subcategory,
    hasAutographVariant:
      result.fields.hasAutographVariant ?? current.hasAutographVariant,
    isVintage: result.fields.isVintage ?? current.isVintage,
  };
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

function buildSuggestionItems(
  form: FinalizeFormState,
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
    yearManufactured: form.year || 'Empty',
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

export default function FinalizeScanPage() {
  const router = useRouter();
  const { authenticated, loading } = useAuth();
  const scanId = useMemo(() => {
    const raw = router.query.scanId;
    if (!raw) {
      return null;
    }

    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.scanId]);
  const candidateId = useMemo(() => {
    const raw = router.query.candidateId;
    if (!raw) {
      return null;
    }

    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.candidateId]);

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [form, setForm] = useState<FinalizeFormState | null>(null);
  const [taxonomy, setTaxonomy] = useState<CardTaxonomy | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<Awaited<
    ReturnType<typeof normalizeCardTitle>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [normalizing, setNormalizing] = useState(false);
  const [parserMessage, setParserMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = useMemo(() => {
    if (!scan) {
      return null;
    }

    if (candidateId !== null) {
      return scan.candidates.find((candidate) => candidate.id === candidateId) ?? null;
    }

    return scan.candidates[0] ?? null;
  }, [candidateId, scan]);

  useEffect(() => {
    if (!authenticated || !scanId || Number.isNaN(scanId)) {
      return;
    }

    let stopped = false;

    const load = async () => {
      setLoadingState(true);
      setError(null);

      try {
        const [payload, taxonomyPayload] = await Promise.all([
          getScan(scanId),
          getCardTaxonomy(),
        ]);
        if (stopped) {
          return;
        }

        setScan(payload);
        setTaxonomy(taxonomyPayload);
        const candidate =
          (candidateId !== null
            ? payload.candidates.find((entry) => entry.id === candidateId)
            : payload.candidates[0]) ?? null;

        if (!candidate) {
          setError('Selected candidate not found for this scan.');
          return;
        }

        const initial = buildInitialForm(candidate);
        const normalized = await normalizeCardTitle({
          rawTitle: initial.rawTitle,
          fields: {
            name: candidate.name,
            player: candidate.player,
            setName: candidate.set,
            yearManufactured: candidate.year,
            variant: candidate.variant,
            sport: candidate.sport,
          },
        });

        if (stopped) {
          return;
        }

        setForm(applyNormalization(initial, normalized));
        setParserMessage(
          normalized.usedAi
            ? `AI refinement applied at ${normalized.confidence.toFixed(3)} confidence.`
            : `Parser suggestions loaded at ${normalized.confidence.toFixed(3)} confidence.`,
        );
      } catch (loadError) {
        if (!stopped) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!stopped) {
          setLoadingState(false);
        }
      }
    };

    void load();

    return () => {
      stopped = true;
    };
  }, [authenticated, candidateId, scanId]);

  const handleNormalize = async () => {
    if (!form) {
      return;
    }

    setNormalizing(true);
    setError(null);

    try {
      const normalized = await normalizeCardTitle({
        rawTitle: form.rawTitle,
        fields: {
          name: form.name || null,
          player: form.player || null,
          brand: form.brand || null,
          setName: form.setName || null,
          yearManufactured: parseOptionalNumber(form.year),
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
      setParserMessage(
        normalized.usedAi
          ? `AI refinement ready at ${normalized.confidence.toFixed(3)} confidence.`
          : normalized.changedFields.length
            ? `Parser suggestions ready at ${normalized.confidence.toFixed(3)} confidence.`
            : 'No better suggestion found from the current title.',
      );
    } catch (normalizeError) {
      setError((normalizeError as Error).message);
    } finally {
      setNormalizing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scanId || !selectedCandidate || !form) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await confirmScan(scanId, {
        candidateId: selectedCandidate.id,
        collectionStatus: form.collectionStatus,
        keepScanImage: form.keepScanImage,
        promoteToCanonical: form.promoteToCanonical,
        draft: {
          name: form.name.trim(),
          set: form.set.trim() || null,
          setName: form.setName.trim() || null,
          brand: form.brand.trim() || null,
          year: parseOptionalNumber(form.year),
          player: form.player.trim() || null,
          variant: form.variant.trim() || null,
          sport: form.sport.trim() || null,
          cardNumber: form.cardNumber.trim() || null,
          season: form.season.trim() || null,
          category: form.category.trim() || null,
          subcategory: form.subcategory.trim() || null,
          hasAutographVariant: form.hasAutographVariant,
          isVintage: form.isVintage,
          condition:
            form.collectionStatus === 'WANTED' ? null : form.condition.trim() || null,
          notes: form.notes.trim() || null,
          gradeEstimate:
            form.collectionStatus === 'WANTED' ? null : form.gradeEstimate.trim() || null,
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
        },
      });

      await router.push(`/cards/${created.id}`);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyPendingSuggestion = () => {
    if (!form || !pendingSuggestion) {
      return;
    }

    setForm(applyNormalization(form, pendingSuggestion));
    setPendingSuggestion(null);
    setParserMessage('Suggested fields applied to the draft.');
  };

  const isWanted = form?.collectionStatus === 'WANTED';
  const categoryOptions = taxonomy?.groups.map((group) => group.category) ?? [];
  const activeSubcategoryOptions = subcategoryOptions(taxonomy, form?.category);
  const suggestionItems = form ? buildSuggestionItems(form, pendingSuggestion) : [];

  return (
    <AppShell>
      <Head>
        <title>Finalize Scan | Trading Card App</title>
      </Head>

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Finalize Scan"
          title={selectedCandidate ? `Finalize ${selectedCandidate.name}` : 'Finalize selected candidate'}
          description="Review the best match, clean up any missing fields, and choose how the first saved card should carry its images."
          actions={
            <div className="action-row">
              <Link className="button-ghost" href={scanId ? `/review/${scanId}` : '/review'}>
                Back to review
              </Link>
            </div>
          }
        />

        {!loading && !authenticated ? (
          <section className="surface gate-card">
            <h2 className="surface-title">Sign in to finalize scans</h2>
            <p className="surface-copy">
              Finalizing a scan creates or updates a real record in your collection, so this step is only available to signed-in collectors.
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

        {loadingState ? <p className="message">Loading selected candidate...</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}
        {parserMessage ? <p className="message">{parserMessage}</p> : null}

        {scan && selectedCandidate && form ? (
          <form className="stack" onSubmit={handleSubmit}>
            {pendingSuggestion ? (
              <SuggestionPreview
                title="Suggestion preview"
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

            {(scan.frontImageUrl || scan.backImageUrl) ? (
              <section className="surface">
                <div className="section-header">
                  <div>
                    <h2>Scan images</h2>
                    <p className="fine-print">These become the first personal images if you keep them during save.</p>
                  </div>
                </div>

                <div className="preview-grid">
                  {scan.frontImageUrl ? (
                    <div className="preview-frame">
                      <h3>Front</h3>
                      <CardImage alt="Uploaded front" src={toAbsoluteApiUrl(scan.frontImageUrl) ?? undefined} />
                    </div>
                  ) : null}
                  {scan.backImageUrl ? (
                    <div className="preview-frame">
                      <h3>Back</h3>
                      <CardImage alt="Uploaded back" src={toAbsoluteApiUrl(scan.backImageUrl) ?? undefined} />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="surface">
              <div className="section-header">
                <div>
                  <h2>Cleanup assistant</h2>
                  <p className="fine-print">Use the parser now so the first saved record starts cleaner than the raw OCR/candidate text.</p>
                </div>
                <button className="button-secondary" type="button" onClick={() => void handleNormalize()} disabled={normalizing}>
                  {normalizing ? 'Refreshing...' : 'Suggest fields'}
                </button>
              </div>

              <div className="field-grid">
                <div className="field field--full">
                  <label htmlFor="rawTitle">Raw title to parse</label>
                  <input
                    id="rawTitle"
                    value={form.rawTitle}
                    onChange={(event) => setForm({ ...form, rawTitle: event.target.value })}
                  />
                </div>
              </div>
            </section>

            <section className="surface">
              <div className="section-header">
                <div>
                  <h2>Definition fields</h2>
                  <p className="fine-print">What card this is, independent of your copy.</p>
                </div>
                <StatusPill label={`Match ${selectedCandidate.score.toFixed(3)}`} tone="accent" />
              </div>

              <div className="field-grid field-grid--three">
                <div className="field">
                  <label htmlFor="name">Card name</label>
                  <input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="player">Player</label>
                  <input id="player" value={form.player} onChange={(event) => setForm({ ...form, player: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="variant">Variant</label>
                  <input id="variant" value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="set">Legacy set text</label>
                  <input id="set" value={form.set} onChange={(event) => setForm({ ...form, set: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="setName">Set name</label>
                  <input id="setName" value={form.setName} onChange={(event) => setForm({ ...form, setName: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="brand">Brand</label>
                  <input id="brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="year">Year</label>
                  <input id="year" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="season">Season</label>
                  <input id="season" value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="cardNumber">Card number</label>
                  <input id="cardNumber" value={form.cardNumber} onChange={(event) => setForm({ ...form, cardNumber: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="sport">Sport</label>
                  <input id="sport" value={form.sport} onChange={(event) => setForm({ ...form, sport: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="category">Category</label>
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
                    placeholder="Select category"
                    options={toSelectOptions(categoryOptions, form.category)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="subcategory">Subcategory</label>
                  <ThemedSelect
                    value={form.subcategory}
                    onChange={(nextValue) => setForm({ ...form, subcategory: nextValue })}
                    placeholder={form.category ? 'Select subcategory' : 'Pick category first'}
                    disabled={!form.category}
                    options={toSelectOptions(activeSubcategoryOptions, form.subcategory)}
                  />
                </div>
              </div>

              <div className="toggle-row">
                <label className="checkbox">
                  <input type="checkbox" checked={form.hasAutographVariant} onChange={(event) => setForm({ ...form, hasAutographVariant: event.target.checked })} />
                  <span>Autograph variant exists</span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.isVintage} onChange={(event) => setForm({ ...form, isVintage: event.target.checked })} />
                  <span>Vintage card</span>
                </label>
              </div>
            </section>

            <section className="surface">
              <div className="section-header">
                <div>
                  <h2>Collection fields</h2>
                  <p className="fine-print">What is true about your record right now.</p>
                </div>
              </div>

              {isWanted ? (
                <p className="message">
                  Wanted cards keep wishlist priority and notes active. Copy-specific fields like condition, grade, autograph state, and sale/trade controls are disabled.
                </p>
              ) : null}

              <div className="field-grid field-grid--three">
                <div className="field">
                  <label htmlFor="collectionStatus">Status</label>
                  <ThemedSelect
                    value={form.collectionStatus}
                    onChange={(nextValue) =>
                      setForm({ ...form, collectionStatus: nextValue as CollectionStatus })
                    }
                    options={[
                      { value: 'OWNED', label: 'Owned' },
                      { value: 'WANTED', label: 'Wanted' },
                    ]}
                  />
                </div>
                <div className="field">
                  <label htmlFor="condition">Condition</label>
                  <input id="condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} disabled={isWanted} />
                </div>
                <div className="field">
                  <label htmlFor="gradeEstimate">Grade estimate</label>
                  <input id="gradeEstimate" value={form.gradeEstimate} onChange={(event) => setForm({ ...form, gradeEstimate: event.target.value })} disabled={isWanted} />
                </div>
                <div className="field">
                  <label htmlFor="autographFormat">Autograph format</label>
                  <input id="autographFormat" value={form.autographFormat} onChange={(event) => setForm({ ...form, autographFormat: event.target.value })} disabled={isWanted} />
                </div>
                <div className="field">
                  <label htmlFor="askingPriceCents">Asking price (cents)</label>
                  <input id="askingPriceCents" value={form.askingPriceCents} onChange={(event) => setForm({ ...form, askingPriceCents: event.target.value })} disabled={isWanted} />
                </div>
                <div className="field">
                  <label htmlFor="priority">Wishlist priority</label>
                  <input id="priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
                </div>
                <div className="field field--full">
                  <label htmlFor="notes">Notes</label>
                  <textarea id="notes" rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </div>
              </div>

              <div className="toggle-row">
                <label className="checkbox">
                  <input type="checkbox" checked={form.isAutographed} onChange={(event) => setForm({ ...form, isAutographed: event.target.checked })} disabled={isWanted} />
                  <span>This copy is signed</span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.isForTrade} onChange={(event) => setForm({ ...form, isForTrade: event.target.checked })} disabled={isWanted} />
                  <span>Open to trade</span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.isForSale} onChange={(event) => setForm({ ...form, isForSale: event.target.checked })} disabled={isWanted} />
                  <span>Open to sale</span>
                </label>
              </div>
            </section>

            <section className="surface">
              <div className="section-header">
                <div>
                  <h2>Image handling</h2>
                  <p className="fine-print">Choose whether the scan image becomes your personal front image and whether it also seeds the shared canonical image.</p>
                </div>
              </div>

              <div className="toggle-row">
                <label className="checkbox">
                  <input type="checkbox" checked={form.keepScanImage} onChange={(event) => setForm({ ...form, keepScanImage: event.target.checked })} />
                  <span>Keep scan image as the initial personal card image</span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.promoteToCanonical} onChange={(event) => setForm({ ...form, promoteToCanonical: event.target.checked })} />
                  <span>Seed the shared canonical image from this scan for future fallback use</span>
                </label>
              </div>
            </section>

            <div className="action-row">
              <button className="button" type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save card'}
              </button>
              <Link className="button-ghost" href={scanId ? `/review/${scanId}` : '/review'}>
                Back
              </Link>
            </div>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
