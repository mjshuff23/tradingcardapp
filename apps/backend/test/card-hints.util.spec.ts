import { parseStructuredCardHints } from '../src/common/card-hints.util';

describe('parseStructuredCardHints', () => {
  it('extracts years, card numbers, and brands from text', () => {
    const hints = parseStructuredCardHints(
      'Michael Jordan',
      '1993 Upper Deck Card #23 Chicago Bulls',
    );

    expect(hints.years).toContain(1993);
    expect(hints.cardNumbers).toContain('23');
    expect(hints.brands).toContain('upper deck');
  });
});
