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

  it('extracts season years and subset hints from text', () => {
    const hints = parseStructuredCardHints(
      'Front text',
      '1997-98 Upper Deck SPx Michael Jordan die-cut sample',
    );

    expect(hints.seasons).toContain('1997-98');
    expect(hints.years).toEqual(expect.arrayContaining([1997, 1998]));
    expect(hints.brands).toContain('upper deck');
    expect(hints.subsets).toEqual(expect.arrayContaining(['spx', 'die cut']));
  });

  it('extracts card numbers from raw slab-style markers before normalization strips the pound sign', () => {
    const hints = parseStructuredCardHints(
      'Front text',
      '1993-94 Upper Deck #466 Michael Jordan SKL',
    );

    expect(hints.cardNumbers).toContain('466');
  });

  it('avoids pulling random stat numbers as card numbers', () => {
    const hints = parseStructuredCardHints(
      'Front text',
      'PTS 30.1 REB 6.6 AST 5.4 1997 season',
    );

    expect(hints.cardNumbers).toHaveLength(0);
  });
});
