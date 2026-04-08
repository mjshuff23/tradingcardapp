import { Injectable } from '@nestjs/common';
import { tokenize, overlapScore } from '../common/normalize.util';
import { SourceHint } from '../common/source-hint.type';

export type CandidateForValidation = {
  name: string;
  set?: string | null;
  year?: number | null;
  player?: string | null;
  variant?: string | null;
};

@Injectable()
export class ValidationService {
  validateCandidate(candidate: CandidateForValidation, ocrText: string): {
    validationScore: number;
    sourceHints: SourceHint[];
  } {
    const query = [candidate.year, candidate.player, candidate.name, candidate.set, candidate.variant]
      .filter(Boolean)
      .join(' ')
      .trim();
    const normalizedQuery = query || candidate.name;
    const encodedQuery = encodeURIComponent(normalizedQuery);

    const ocrTokens = tokenize(ocrText);
    const candidateTokens = tokenize(normalizedQuery);
    const lexicalScore = overlapScore(ocrTokens, candidateTokens);

    return {
      validationScore: Number(lexicalScore.toFixed(3)),
      sourceHints: [
        {
          source: 'ebay_sold',
          title: `eBay sold: ${normalizedQuery}`,
          url: `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Sold=1&LH_Complete=1`,
          score: Number((lexicalScore * 0.9 + 0.1).toFixed(3)),
        },
        {
          source: 'psa',
          title: `PSA search: ${normalizedQuery}`,
          url: `https://www.psacard.com/cert/${encodedQuery}`,
          score: Number((lexicalScore * 0.8 + 0.15).toFixed(3)),
        },
      ],
    };
  }
}
