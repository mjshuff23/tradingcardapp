import {
  buildNormalizedCardKey,
  buildNormalizedSetKey,
  deriveCatalogDraft,
  inferCardNumber,
} from '../src/common/catalog-normalization.util';

describe('catalog-normalization.util', () => {
  it('derives transitional set and card keys from legacy card data', () => {
    const draft = deriveCatalogDraft({
      name: '1986 Fleer #57',
      set: 'Fleer Basketball',
      year: 1986,
      player: 'Michael Jordan',
      variant: 'Base',
      sport: 'Basketball',
    });

    expect(draft.brand).toBe('Fleer');
    expect(draft.setName).toBe('Fleer Basketball');
    expect(draft.cardNumber).toBe('57');
    expect(draft.normalizedSetKey).toBe(
      buildNormalizedSetKey({
        brand: 'Fleer',
        setName: 'Fleer Basketball',
        legacySetText: 'Fleer Basketball',
        yearManufactured: 1986,
        sport: 'Basketball',
      }),
    );
    expect(draft.normalizedCardKey).toBe(
      buildNormalizedCardKey({
        normalizedSetKey: draft.normalizedSetKey,
        cardNumber: '57',
        name: '1986 Fleer #57',
        player: 'Michael Jordan',
        variant: 'Base',
        legacySetText: 'Fleer Basketball',
        year: 1986,
        sport: 'Basketball',
      }),
    );
  });

  it('extracts card numbers from explicit number patterns', () => {
    expect(
      inferCardNumber(
        'A1037',
        '1993-94 Upper Deck #466 Michael Jordan SKL',
        null,
      ),
    ).toBe('466');
  });
});
