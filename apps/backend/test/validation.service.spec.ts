import { ValidationService } from '../src/validation/validation.service';

describe('ValidationService', () => {
  const service = new ValidationService();

  it('returns lexical validation score without hardcoded external hints', () => {
    const result = service.validateCandidate(
      {
        name: 'Prizm Base',
        year: 2019,
        player: 'Zion Williamson',
      },
      '2019 zion williamson prizm base',
    );

    expect(result.sourceHints).toHaveLength(0);
    expect(result.validationScore).toBeGreaterThan(0);
  });
});
