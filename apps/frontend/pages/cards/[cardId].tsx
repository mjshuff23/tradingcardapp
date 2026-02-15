import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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
    <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Card Detail</h1>
      <p>
        <Link href="/binder">Back to binder</Link>
      </p>

      {loading ? <p>Loading card...</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {message ? <p style={{ color: '#0f766e' }}>{message}</p> : null}

      {card && form ? (
        <section
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'minmax(220px, 300px) 1fr',
            alignItems: 'start',
          }}
        >
          <div>
            <img
              src={`${API_ORIGIN}/api/v1/cards/${card.id}/image`}
              alt={card.name}
              style={{
                width: '100%',
                maxWidth: '280px',
                borderRadius: '0.6rem',
                border: '1px solid #ddd',
                background: '#f3f4f6',
              }}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>

            <label>
              Set
              <input
                value={form.set}
                onChange={(event) => setForm({ ...form, set: event.target.value })}
              />
            </label>

            <label>
              Year
              <input
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value })}
                inputMode="numeric"
              />
            </label>

            <label>
              Player
              <input
                value={form.player}
                onChange={(event) => setForm({ ...form, player: event.target.value })}
              />
            </label>

            <label>
              Variant
              <input
                value={form.variant}
                onChange={(event) => setForm({ ...form, variant: event.target.value })}
              />
            </label>

            <label>
              Sport
              <input
                value={form.sport}
                onChange={(event) => setForm({ ...form, sport: event.target.value })}
              />
            </label>

            <label>
              Grade Estimate
              <input
                value={form.gradeEstimate}
                onChange={(event) => setForm({ ...form, gradeEstimate: event.target.value })}
              />
            </label>

            <label>
              Status
              <select
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
            </label>

            <button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
