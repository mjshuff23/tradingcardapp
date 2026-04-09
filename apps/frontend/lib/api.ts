export type ScanStatus = 'QUEUED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'FAILED';
export type CollectionStatus = 'OWNED' | 'WANTED';
export type CardQueryMode = 'text' | 'nl';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  pfpUrl: string | null;
};

export type AuthSession = {
  authenticated: boolean;
  user: AuthUser | null;
};

export type ValidationHint = {
  source: string;
  provider?: string;
  url: string;
  title: string;
  score: number;
  imageUrl?: string | null;
};

export type ScanCandidate = {
  id: number;
  name: string;
  set: string | null;
  year: number | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  score: number;
  validationScore: number | null;
  sourceHints: ValidationHint[] | null;
  chosen: boolean;
};

export type ScanResponse = {
  id: number;
  status: ScanStatus;
  sourceFilename: string | null;
  ocrText: string | null;
  error: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  candidates: ScanCandidate[];
};

export type CardSet = {
  id: string;
  brand: string | null;
  setName: string | null;
  yearManufactured: number | null;
  sport: string | null;
  season: string | null;
  cardConditionScale: string | null;
  cardSize: string | null;
  cardThicknessPt: number | null;
  countryOfOrigin: string | null;
  language: string | null;
  material: string | null;
  metadata: Record<string, unknown> | null;
};

export type CardDefinition = {
  id: string;
  normalizedCardKey: string;
  cardNumber: string | null;
  name: string;
  player: string | null;
  variant: string | null;
  legacySetText: string | null;
  category: string | null;
  subcategory: string | null;
  hasAutographVariant: boolean;
  features: Record<string, unknown> | null;
  originalOrReprint: string | null;
  parallelOrVariety: string | null;
  setType: string | null;
  insertSetName: string | null;
  cardType: string | null;
  isVintage: boolean;
  metadata: Record<string, unknown> | null;
  cardSet: CardSet | null;
};

export type CardCollectionRecord = {
  collectionStatus: CollectionStatus;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  frontImageKey: string | null;
  backImageKey: string | null;
  condition: string | null;
  isAutographed: boolean;
  autographFormat: string | null;
  isForTrade: boolean;
  isForSale: boolean;
  askingPriceCents: number | null;
  priority: number | null;
  notes: string | null;
  gradeEstimate: string | null;
  confidence: number | null;
  scanJobId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CardListItem = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  collectionStatus: CollectionStatus;
  definition: CardDefinition;
  record: CardCollectionRecord;
};

export type CardDetail = CardListItem;

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    const text = await response.text();
    try {
      const parsed = text ? JSON.parse(text) : null;
      message = parsed?.message ?? parsed?.error ?? message;
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getCurrentSession(): Promise<AuthSession> {
  return request<AuthSession>('/auth/me');
}

export async function signup(payload: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<AuthSession> {
  return request<AuthSession>('/auth/logout', {
    method: 'POST',
  });
}

export async function uploadScan(input: {
  image: File;
  backImage?: File | null;
}): Promise<{ scanId: number; status: ScanStatus }> {
  const form = new FormData();
  form.append('image', input.image);
  if (input.backImage) {
    form.append('backImage', input.backImage);
  }

  return request('/scans', {
    method: 'POST',
    body: form,
  });
}

export async function getScan(scanId: number): Promise<ScanResponse> {
  return request(`/scans/${scanId}`);
}

export async function confirmScan(
  scanId: number,
  payload: {
    candidateId: number;
    collectionStatus: CollectionStatus;
  },
): Promise<{ id: number }> {
  return request<{ id: number }>(`/scans/${scanId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function listCards(params: {
  q?: string;
  collectionStatus?: CollectionStatus | 'ALL';
  queryMode?: CardQueryMode;
}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set('q', params.q);
  }

  if (params.collectionStatus && params.collectionStatus !== 'ALL') {
    searchParams.set('collectionStatus', params.collectionStatus);
  }

  if (params.queryMode) {
    searchParams.set('queryMode', params.queryMode);
  }

  const suffix = searchParams.toString();
  return request<{
    items: CardListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>(`/cards${suffix ? `?${suffix}` : ''}`);
}

export async function importCardsCsv(file: File): Promise<{
  summary: {
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
  };
}> {
  const form = new FormData();
  form.append('file', file);

  return request('/import/cards/csv', {
    method: 'POST',
    body: form,
  });
}

export async function getCard(cardId: number): Promise<CardDetail> {
  return request<CardDetail>(`/cards/${cardId}`);
}

export async function updateCard(
  cardId: number,
  payload: Partial<{
    name: string;
    brand: string | null;
    setName: string | null;
    legacySetText: string | null;
    season: string | null;
    cardNumber: string | null;
    yearManufactured: number | null;
    player: string | null;
    variant: string | null;
    sport: string | null;
    category: string | null;
    subcategory: string | null;
    originalOrReprint: string | null;
    parallelOrVariety: string | null;
    setType: string | null;
    insertSetName: string | null;
    cardType: string | null;
    hasAutographVariant: boolean;
    isVintage: boolean;
    collectionStatus: CollectionStatus;
    condition: string | null;
    isAutographed: boolean;
    autographFormat: string | null;
    isForTrade: boolean;
    isForSale: boolean;
    askingPriceCents: number | null;
    priority: number | null;
    notes: string | null;
    gradeEstimate: string | null;
  }>,
): Promise<CardDetail> {
  return request<CardDetail>(`/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
