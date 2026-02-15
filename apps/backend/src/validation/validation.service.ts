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

    const ocrTokens = tokenize(ocrText);
    const candidateTokens = tokenize(query || candidate.name);
    const lexicalScore = overlapScore(ocrTokens, candidateTokens);

    return {
      validationScore: Number(lexicalScore.toFixed(3)),
      sourceHints: [],
    };
  }
}
