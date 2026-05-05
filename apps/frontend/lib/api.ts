export type ScanStatus = 'QUEUED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'FAILED';
export type CollectionStatus = 'OWNED' | 'WANTED';
export type CardQueryMode = 'text' | 'nl';
export type CardImageSource = 'USER' | 'CANONICAL' | 'LEGACY' | 'NONE';
export type SortDirection = 'asc' | 'desc';
export type CardSortBy =
  | 'title'
  | 'player'
  | 'brand'
  | 'setName'
  | 'yearManufactured'
  | 'season'
  | 'cardNumber'
  | 'sport'
  | 'category'
  | 'subcategory'
  | 'cardType'
  | 'collectionStatus'
  | 'condition'
  | 'gradeEstimate'
  | 'isAutographed'
  | 'isForTrade'
  | 'isForSale'
  | 'askingPriceCents'
  | 'priority'
  | 'confidence'
  | 'createdAt'
  | 'updatedAt';

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
  setName: string | null;
  legacySetText: string | null;
  brand: string | null;
  year: number | null;
  season: string | null;
  cardNumber: string | null;
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
  personalImageUrl: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
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
  imageSource: CardImageSource;
  canonicalImageUrl: string | null;
  personalImageUrl: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  collectionStatus: CollectionStatus;
  definition: CardDefinition;
  record: CardCollectionRecord;
};

export type CardDetail = CardListItem;

export type NormalizedCardFields = {
  name?: string | null;
  player?: string | null;
  brand?: string | null;
  setName?: string | null;
  yearManufactured?: number | null;
  season?: string | null;
  cardNumber?: string | null;
  sport?: string | null;
  variant?: string | null;
  category?: string | null;
  subcategory?: string | null;
  hasAutographVariant?: boolean | null;
  isVintage?: boolean | null;
};

export type NormalizeTitleResult = {
  rawTitle: string;
  cleanedTitle: string;
  cleanedSearchText: string | null;
  fields: NormalizedCardFields;
  fieldConfidence: Record<string, number>;
  confidence: number;
  usedAi: boolean;
  search: Partial<{
    searchText: string;
    collectionStatus: CollectionStatus;
    year: number;
    sport: string;
    cardNumber: string;
    brand: string;
    setName: string;
    season: string;
    isForTrade: boolean;
    isForSale: boolean;
    isAutographed: boolean;
    isVintage: boolean;
    priority: number;
  }>;
  changedFields: string[];
  debug?: Record<string, unknown> | null;
};

export type EnrichedScanCandidateFields = Partial<{
  name: string | null;
  set: string | null;
  setName: string | null;
  brand: string | null;
  year: number | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  cardNumber: string | null;
  season: string | null;
  category: string | null;
  subcategory: string | null;
  hasAutographVariant: boolean | null;
  isVintage: boolean | null;
}>;

export type EnrichedScanCandidateSource = {
  provider: string;
  query: string;
  url: string;
  title: string;
  snippet: string | null;
  score: number;
};

export type EnrichScanCandidateResult = {
  fields: EnrichedScanCandidateFields;
  fieldConfidence: Record<string, number>;
  confidence: number;
  usedAi: boolean;
  provider: string;
  queries: string[];
  sources: EnrichedScanCandidateSource[];
  debug?: Record<string, unknown> | null;
};

export type CardTaxonomySubcategory = {
  name: string;
  keywords: string[];
};

export type CardTaxonomyGroup = {
  category: string;
  keywords: string[];
  subcategories: CardTaxonomySubcategory[];
};

export type CardTaxonomy = {
  groups: CardTaxonomyGroup[];
};

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_BASE = `${API_ORIGIN}/api/v1`;

function toAbsoluteApiUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }

  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

function normalizeAuthUser(user: AuthUser | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    ...user,
    pfpUrl: toAbsoluteApiUrl(user.pfpUrl),
  };
}

function normalizeSession(session: AuthSession): AuthSession {
  return {
    ...session,
    user: normalizeAuthUser(session.user),
  };
}

function normalizeValidationHint(hint: ValidationHint): ValidationHint {
  return {
    ...hint,
    imageUrl: toAbsoluteApiUrl(hint.imageUrl),
  };
}

function normalizeScanCandidate(candidate: ScanCandidate): ScanCandidate {
  return {
    ...candidate,
    sourceHints: candidate.sourceHints?.map(normalizeValidationHint) ?? null,
  };
}

function normalizeScan(scan: ScanResponse): ScanResponse {
  return {
    ...scan,
    frontImageUrl: toAbsoluteApiUrl(scan.frontImageUrl),
    backImageUrl: toAbsoluteApiUrl(scan.backImageUrl),
    candidates: scan.candidates.map(normalizeScanCandidate),
  };
}

function normalizeCardRecord(record: CardCollectionRecord): CardCollectionRecord {
  return {
    ...record,
    personalImageUrl: toAbsoluteApiUrl(record.personalImageUrl),
    frontImageUrl: toAbsoluteApiUrl(record.frontImageUrl),
    backImageUrl: toAbsoluteApiUrl(record.backImageUrl),
  };
}

function normalizeCard(card: CardListItem): CardListItem {
  return {
    ...card,
    imageUrl: toAbsoluteApiUrl(card.imageUrl),
    canonicalImageUrl: toAbsoluteApiUrl(card.canonicalImageUrl),
    personalImageUrl: toAbsoluteApiUrl(card.personalImageUrl),
    frontImageUrl: toAbsoluteApiUrl(card.frontImageUrl),
    backImageUrl: toAbsoluteApiUrl(card.backImageUrl),
    record: normalizeCardRecord(card.record),
  };
}

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
  return normalizeSession(await request<AuthSession>('/auth/me'));
}

export async function signup(payload: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  return normalizeSession(await request<AuthSession>('/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return normalizeSession(await request<AuthSession>('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));
}

export async function logout(): Promise<AuthSession> {
  return normalizeSession(await request<AuthSession>('/auth/logout', {
    method: 'POST',
  }));
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
  return normalizeScan(await request<ScanResponse>(`/scans/${scanId}`));
}

export async function confirmScan(
  scanId: number,
  payload: {
    candidateId?: number;
    collectionStatus?: CollectionStatus;
    keepScanImage?: boolean;
    promoteToCanonical?: boolean;
    draft?: Partial<{
      name: string;
      set: string | null;
      setName: string | null;
      brand: string | null;
      year: number | null;
      player: string | null;
      variant: string | null;
      sport: string | null;
      cardNumber: string | null;
      season: string | null;
      category: string | null;
      subcategory: string | null;
      hasAutographVariant: boolean | null;
      isVintage: boolean | null;
      condition: string | null;
      notes: string | null;
      gradeEstimate: string | null;
      isAutographed: boolean | null;
      autographFormat: string | null;
      isForTrade: boolean | null;
      isForSale: boolean | null;
      askingPriceCents: number | null;
      priority: number | null;
    }>;
    enrichment?: Partial<EnrichScanCandidateResult>;
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

export async function normalizeCardTitle(payload: {
  rawTitle: string;
  fields?: NormalizedCardFields;
}): Promise<NormalizeTitleResult> {
  return request<NormalizeTitleResult>('/cards/normalize-title', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getCardTaxonomy(): Promise<CardTaxonomy> {
  return request<CardTaxonomy>('/cards/taxonomy');
}

export async function listCards(params: {
  q?: string;
  collectionStatus?: CollectionStatus | 'ALL';
  queryMode?: CardQueryMode;
  sortBy?: CardSortBy;
  sortDirection?: SortDirection;
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

  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }

  if (params.sortDirection) {
    searchParams.set('sortDirection', params.sortDirection);
  }

  const suffix = searchParams.toString();
  const response = await request<{
    items: CardListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>(`/cards${suffix ? `?${suffix}` : ''}`);

  return {
    ...response,
    items: response.items.map(normalizeCard),
  };
}

export async function enrichScanCandidate(
  scanId: number,
  candidateId: number,
  payload?: {
    draft?: EnrichedScanCandidateFields;
  },
): Promise<EnrichScanCandidateResult> {
  return request<EnrichScanCandidateResult>(`/scans/${scanId}/candidates/${candidateId}/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
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
  return normalizeCard(await request<CardDetail>(`/cards/${cardId}`));
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
  return normalizeCard(await request<CardDetail>(`/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));
}

export async function uploadCardImage(
  cardId: number,
  kind: 'front' | 'back' | 'canonical',
  file: File,
): Promise<CardDetail> {
  const form = new FormData();
  form.append('image', file);

  return normalizeCard(await request<CardDetail>(`/cards/${cardId}/images/${kind}`, {
    method: 'POST',
    body: form,
  }));
}

export async function clearCardImage(
  cardId: number,
  kind: 'front' | 'back' | 'canonical',
): Promise<CardDetail> {
  return normalizeCard(await request<CardDetail>(`/cards/${cardId}/images/${kind}`, {
    method: 'DELETE',
  }));
}

export async function uploadProfileImage(file: File): Promise<AuthSession> {
  const form = new FormData();
  form.append('image', file);

  return normalizeSession(await request<AuthSession>('/auth/me/pfp', {
    method: 'POST',
    body: form,
  }));
}

export async function clearProfileImage(): Promise<AuthSession> {
  return normalizeSession(await request<AuthSession>('/auth/me/pfp', {
    method: 'DELETE',
  }));
}
