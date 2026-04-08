import { ScanService } from '../src/scan/scan.service';
import { SourceHint } from '../src/common/source-hint.type';
import { ValidationService } from '../src/validation/validation.service';
import { LinkPreviewService } from '../src/scan/link-preview.service';

describe('ScanService ranking', () => {
  function createService(linkPreviewService?: Partial<LinkPreviewService>) {
    return new ScanService(
      {} as never,
      {} as never,
      {} as never,
      new ValidationService(),
      {} as never,
      (linkPreviewService ?? {}) as never,
    );
  }

  it('filters profile-style lookup results and noisy saved cards for a scan 23 style OCR payload', () => {
    const service = createService() as any;
    const lookupHints: SourceHint[] = [
      {
        source: 'web_lookup',
        provider: 'duckduckgo',
        title: 'Michael Jordan - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Michael_Jordan',
        score: 0.6,
      },
      {
        source: 'web_lookup',
        provider: 'duckduckgo',
        title: 'Michael Jordan | Stats, NASCAR, Age, Height, Chicago Bulls, & Facts',
        url: 'https://www.britannica.com/biography/Michael-Jordan',
        score: 0.56,
      },
    ];

    const references = [
      {
        name: 'A1037',
        set: '1993-94 Upper Deck #466 Michael Jordan SKL',
        year: 1993,
        player: 'Michael Jordan',
        variant: null,
        sport: 'Basketball',
        source: 'catalog_card',
        metadata: null,
      },
      {
        name: 'Michael Jordan #SPX5 for sale',
        set: 'SPX',
        year: 1997,
        player: 'Michael Jordan',
        variant: null,
        sport: 'Basketball',
        source: 'catalog_card',
        metadata: null,
      },
      {
        name: 'Michael Jordan #SPX5 Sample',
        set: 'SPX',
        year: 1997,
        player: 'Michael Jordan',
        variant: null,
        sport: 'Basketball',
        source: 'catalog_card',
        metadata: null,
      },
      {
        name: '1986 Fleer #57',
        set: 'Fleer Basketball',
        year: 1986,
        player: 'Michael Jordan',
        variant: 'Base',
        sport: 'Basketball',
        source: 'catalog_card',
        metadata: null,
      },
    ];

    const ranked = service.rankCandidates(
      {
        text: 'MICHA ORDAN ad ip SR 9 es a jill L NY 27 Lams Zon MICHA y 466 MICHAEL JORDAN G Beyond the boundaries of gravity is where Mic Jordan thrived over his nine-year stay in the NBA',
        backText: '1993-94 Upper Deck Card #466 Michael Jordan SKL Chicago Bulls',
        hints: {
          years: [1993, 1994],
          seasons: ['1993-94'],
          cardNumbers: ['466'],
          brands: ['upper deck'],
          subsets: [],
        },
        lookup: {
          corpus: '',
          hints: lookupHints,
        },
      },
      references,
    );

    expect(ranked[0]).toMatchObject({
      name: 'A1037',
      year: 1993,
      set: '1993-94 Upper Deck #466 Michael Jordan SKL',
    });
    expect(ranked.some((candidate: { name: string }) => candidate.name === 'Michael Jordan')).toBe(false);
    expect(
      ranked.some((candidate: { name: string }) => candidate.name.toLowerCase().includes('for sale')),
    ).toBe(false);
    expect(
      ranked.some((candidate: { name: string }) => candidate.name.toLowerCase().includes('sample')),
    ).toBe(false);
    expect(ranked[0].sourceHints.map((hint: SourceHint) => hint.source)).toEqual(
      expect.arrayContaining(['ebay_sold', 'psa']),
    );
    expect(
      ranked[0].sourceHints.some((hint: SourceHint) => hint.title.toLowerCase().includes('wikipedia')),
    ).toBe(false);
  });

  it('rewrites trusted ebay preview images through the local proxy endpoint', async () => {
    const service = createService({
      getPreviewImage: jest
        .fn()
        .mockResolvedValue('https://i.ebayimg.com/images/g/ClwAAOSwffFi4wfr/s-l500.webp'),
      shouldProxyPreviewImage: jest.fn().mockReturnValue(true),
    }) as any;

    const enriched = await service.enrichSourceHintsWithPreviewImages(23, 135, [
      {
        source: 'web_lookup',
        provider: 'duckduckgo',
        title: '1993-94 Upper Deck #466 Michael Jordan SKL Chicago Bulls',
        url: 'https://www.ebay.com/itm/327074734032',
        score: 0.6,
      },
    ]);

    expect(enriched[0].imageUrl).toBe(
      '/api/v1/scans/23/candidates/135/preview-image?hintUrl=https%3A%2F%2Fwww.ebay.com%2Fitm%2F327074734032',
    );
  });
});
