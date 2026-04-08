import { ValidationService } from '../src/validation/validation.service';

describe('ValidationService', () => {
  const service = new ValidationService();

  it('returns lexical validation score with marketplace lookup hints', () => {
    const result = service.validateCandidate(
      {
        name: 'Prizm Base',
        year: 2019,
        player: 'Zion Williamson',
      },
      '2019 zion williamson prizm base',
    );

    expect(result.sourceHints).toHaveLength(2);
    expect(result.sourceHints.map((hint) => hint.source)).toEqual(
      expect.arrayContaining(['ebay_sold', 'psa']),
    );
    expect(result.validationScore).toBeGreaterThan(0);
  });
});
