export type ScanStatus = 'QUEUED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'FAILED';
export type CollectionStatus = 'OWNED' | 'WANTED';

export type ValidationHint = {
  source: 'ebay_sold' | 'psa' | 'web_lookup';
  provider?: string;
  url: string;
  title: string;
  score: number;
  imageUrl?: string;
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

export type CardRecord = {
  id: number;
  name: string;
  set: string | null;
  year: number | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  confidence: number | null;
  collectionStatus: CollectionStatus;
  gradeEstimate: string | null;
};

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
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
}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set('q', params.q);
  }

  if (params.collectionStatus && params.collectionStatus !== 'ALL') {
    searchParams.set('collectionStatus', params.collectionStatus);
  }

  const suffix = searchParams.toString();
  return request<{
    items: CardRecord[];
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

  return request<{
    summary: {
      totalRows: number;
      createdCount: number;
      updatedCount: number;
      skippedCount: number;
      errorCount: number;
    };
  }>('/import/cards/csv', {
    method: 'POST',
    body: form,
  });
}

export async function getCard(cardId: number): Promise<CardRecord> {
  return request<CardRecord>(`/cards/${cardId}`);
}

export async function updateCard(
  cardId: number,
  payload: Partial<{
    name: string;
    set: string | null;
    year: number | null;
    player: string | null;
    variant: string | null;
    sport: string | null;
    collectionStatus: CollectionStatus;
    gradeEstimate: string | null;
  }>,
): Promise<CardRecord> {
  return request<CardRecord>(`/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
