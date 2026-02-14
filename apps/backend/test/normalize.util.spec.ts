import { normalizeText, overlapScore, tokenize } from '../src/common/normalize.util';

describe('normalize.util', () => {
  it('normalizes punctuation and casing', () => {
    expect(normalizeText('  LeBrOn James! #23  ')).toBe('lebron james 23');
  });

  it('tokenizes normalized text', () => {
    expect(tokenize('Skybox Premium 1990')).toEqual(['skybox', 'premium', '1990']);
  });

  it('calculates overlap score', () => {
    const score = overlapScore(['lebron', 'james', '2003'], ['2003', 'lebron', 'rookie']);
    expect(score).toBeCloseTo(2 / 3, 5);
  });
});
