import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CardImage } from '../../components/CardImage';
import { PageHeader } from '../../components/PageHeader';
import { StatusPill } from '../../components/StatusPill';
import { CardRecord, CollectionStatus, getCard, updateCard } from '../../lib/api';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FormState = {
  name: string;
  set: string;
  year: string;
  player: string;
  variant: string;
  sport: string;
  collectionStatus: CollectionStatus;
  gradeEstimate: string;
};

function toFormState(card: CardRecord): FormState {
  return {
    name: card.name ?? '',
    set: card.set ?? '',
    year: card.year ? String(card.year) : '',
    player: card.player ?? '',
    variant: card.variant ?? '',
    sport: card.sport ?? '',
    collectionStatus: card.collectionStatus,
    gradeEstimate: card.gradeEstimate ?? '',
  };
}

export default function CardDetailPage() {
  const router = useRouter();
  const cardId = useMemo(() => {
    const raw = router.query.cardId;
    if (!raw) {
      return null;
    }
    return Number(Array.isArray(raw) ? raw[0] : raw);
  }, [router.query.cardId]);

  const [card, setCard] = useState<CardRecord | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
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
    if (!cardId || !form) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const updated = await updateCard(cardId, {
        name: form.name.trim(),
        set: form.set.trim() || null,
        year: form.year.trim() ? Number(form.year) : null,
        player: form.player.trim() || null,
        variant: form.variant.trim() || null,
        sport: form.sport.trim() || null,
        collectionStatus: form.collectionStatus,
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

  return (
    <AppShell>
      <Head>
        <title>{card?.name ? `${card.name} | Trading Card App` : 'Card Detail | Trading Card App'}</title>
      </Head>

      <div className="stack fade-up">
        <PageHeader
          eyebrow="Card Detail"
          title={card?.name ?? 'Reviewing card metadata'}
          description="Clean up scanned metadata here without leaving the collection view."
          actions={
            <Link className="button-ghost" href="/binder">
              Back to binder
            </Link>
          }
        />

        {loading ? <p className="message">Loading card...</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}
        {message ? <p className="message message--success">{message}</p> : null}

        {card && form ? (
          <section className="editor-shell">
            <aside className="editor-aside">
              <CardImage alt={card.name} src={`${API_ORIGIN}/api/v1/cards/${card.id}/image`} />

              <div className="surface">
                <div className="action-row">
                  <StatusPill
                    label={card.collectionStatus}
                    tone={card.collectionStatus === 'OWNED' ? 'success' : 'accent'}
                  />
                  <StatusPill
                    label={card.confidence !== null ? `Confidence ${card.confidence.toFixed(3)}` : 'No confidence'}
                  />
                </div>

                <div className="detail-grid detail-grid-spaced">
                  <div className="detail-item">
                    <strong>Set</strong>
                    <span>{card.set ?? 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Year</strong>
                    <span>{card.year ?? 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Player</strong>
                    <span>{card.player ?? 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Sport</strong>
                    <span>{card.sport ?? 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </aside>

            <section className="surface">
              <form className="stack" onSubmit={handleSubmit}>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="set">Set</label>
                    <input
                      id="set"
                      value={form.set}
                      onChange={(event) => setForm({ ...form, set: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="year">Year</label>
                    <input
                      id="year"
                      value={form.year}
                      onChange={(event) => setForm({ ...form, year: event.target.value })}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="player">Player</label>
                    <input
                      id="player"
                      value={form.player}
                      onChange={(event) => setForm({ ...form, player: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="variant">Variant</label>
                    <input
                      id="variant"
                      value={form.variant}
                      onChange={(event) => setForm({ ...form, variant: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="sport">Sport</label>
                    <input
                      id="sport"
                      value={form.sport}
                      onChange={(event) => setForm({ ...form, sport: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="gradeEstimate">Grade estimate</label>
                    <input
                      id="gradeEstimate"
                      value={form.gradeEstimate}
                      onChange={(event) => setForm({ ...form, gradeEstimate: event.target.value })}
                    />
                  </div>

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
                    >
                      <option value="OWNED">Owned</option>
                      <option value="WANTED">Wanted</option>
                    </select>
                  </div>
                </div>

                <div className="action-row">
                  <button className="button" type="submit" disabled={busy}>
                    {busy ? 'Saving...' : 'Save changes'}
                  </button>
                  <Link className="button-secondary" href="/binder">
                    Return to binder
                  </Link>
                </div>
              </form>
            </section>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
