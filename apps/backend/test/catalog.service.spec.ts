import { CollectionStatus } from '../src/prisma/client';
import { CatalogService } from '../src/catalog/catalog.service';
import { CardSortBy, SortDirection } from '../src/catalog/dto/list-cards-query.dto';

type CardSetRow = {
  id: string;
  brand: string | null;
  setName: string | null;
  yearManufactured: number | null;
  sport: string | null;
  season: string | null;
  cardConditionScale: string | null;
  cardSize: string | null;
  cardThicknessPt: number | null;
  countryOfOrigin: string | null;
  language: string | null;
  material: string | null;
  metadata: Record<string, unknown> | null;
};

type CardDefinitionRow = {
  id: string;
  normalizedCardKey: string;
  cardNumber: string | null;
  name: string;
  player: string | null;
  variant: string | null;
  legacySetText: string | null;
  category: string | null;
  subcategory: string | null;
  hasAutographVariant: boolean;
  features: Record<string, unknown> | null;
  originalOrReprint: string | null;
  parallelOrVariety: string | null;
  setType: string | null;
  insertSetName: string | null;
  cardType: string | null;
  isVintage: boolean;
  metadata: Record<string, unknown> | null;
  cardSet: CardSetRow | null;
};

type UserCardRow = {
  id: number;
  userId: string;
  cardDefinitionId: string;
  condition: string | null;
  isAutographed: boolean;
  autographFormat: string | null;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  frontImageKey: string | null;
  backImageKey: string | null;
  isForTrade: boolean;
  isForSale: boolean;
  askingPriceCents: number | null;
  notes: string | null;
  gradeEstimate: string | null;
  confidence: number | null;
  scanJobId: number | null;
  createdAt: Date;
  updatedAt: Date;
  cardDefinition: CardDefinitionRow;
};

type UserWishlistRow = {
  id: number;
  userId: string;
  cardDefinitionId: string;
  priority: number | null;
  notes: string | null;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  gradeEstimate: string | null;
  confidence: number | null;
  scanJobId: number | null;
  createdAt: Date;
  updatedAt: Date;
  cardDefinition: CardDefinitionRow;
};

describe('CatalogService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const cardSet: CardSetRow = {
    id: 'set-1',
    brand: 'O-Pee-Chee',
    setName: 'Hockey',
    yearManufactured: 1979,
    sport: 'Hockey',
    season: '1979-80',
    cardConditionScale: null,
    cardSize: null,
    cardThicknessPt: null,
    countryOfOrigin: null,
    language: null,
    material: null,
    metadata: null,
  };
  const cardDefinition: CardDefinitionRow = {
    id: 'definition-1',
    normalizedCardKey: 'wayne-gretzky-1979-opc-18',
    cardNumber: '18',
    name: '1979 O-Pee-Chee #18',
    player: 'Wayne Gretzky',
    variant: 'Rookie',
    legacySetText: 'O-Pee-Chee Hockey',
    category: 'Player',
    subcategory: 'Rookie',
    hasAutographVariant: false,
    features: null,
    originalOrReprint: 'Original',
    parallelOrVariety: null,
    setType: 'Base',
    insertSetName: null,
    cardType: 'Base',
    isVintage: true,
    metadata: null,
    cardSet,
  };

  function createServiceWithWantedRow() {
    const state: {
      userCard: UserCardRow | null;
      userWishlist: UserWishlistRow | null;
    } = {
      userCard: null,
      userWishlist: {
        id: 22,
        userId,
        cardDefinitionId: cardDefinition.id,
        priority: 7,
        notes: 'Chasing a clean rookie copy.',
        imageUrl: null,
        originalImageKey: null,
        thumbnailImageKey: null,
        gradeEstimate: 'Raw',
        confidence: 0.989,
        scanJobId: null,
        createdAt: new Date('2026-04-08T12:00:00Z'),
        updatedAt: new Date('2026-04-08T12:05:00Z'),
        cardDefinition,
      },
    };

    const prisma = {
      userCard: {
        findFirst: jest.fn(async ({ where }: { where: { id: number; userId: string } }) =>
          state.userCard && state.userCard.id === where.id && state.userCard.userId === where.userId
            ? state.userCard
            : null,
        ),
      },
      userWishlist: {
        findFirst: jest.fn(async ({ where }: { where?: { id?: number; userId?: string } }) => {
          if (!state.userWishlist) {
            return null;
          }

          if (where?.id !== undefined) {
            return state.userWishlist.id === where.id && state.userWishlist.userId === where.userId
              ? state.userWishlist
              : null;
          }

          return null;
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const tx = {
          userCard: {
            create: jest.fn(async ({ data }: { data: Partial<UserCardRow> }) => {
              state.userCard = {
                id: data.id ?? 91,
                userId,
                cardDefinitionId: cardDefinition.id,
                condition: data.condition ?? null,
                isAutographed: data.isAutographed ?? false,
                autographFormat: data.autographFormat ?? null,
                imageUrl: data.imageUrl ?? null,
                originalImageKey: data.originalImageKey ?? null,
                thumbnailImageKey: data.thumbnailImageKey ?? null,
                frontImageKey: data.frontImageKey ?? null,
                backImageKey: data.backImageKey ?? null,
                isForTrade: data.isForTrade ?? false,
                isForSale: data.isForSale ?? false,
                askingPriceCents: data.askingPriceCents ?? null,
                notes: data.notes ?? null,
                gradeEstimate: data.gradeEstimate ?? null,
                confidence: data.confidence ?? null,
                scanJobId: data.scanJobId ?? null,
                createdAt: (data.createdAt as Date) ?? new Date('2026-04-08T12:00:00Z'),
                updatedAt: (data.updatedAt as Date) ?? new Date('2026-04-08T12:05:00Z'),
                cardDefinition,
              };

              return state.userCard;
            }),
            delete: jest.fn(async ({ where }: { where: { id: number } }) => {
              if (state.userCard?.id === where.id) {
                state.userCard = null;
              }
            }),
            update: jest.fn(),
            findFirst: jest.fn(async ({ where }: { where: { id: number; userId: string } }) =>
              state.userCard && state.userCard.id === where.id && state.userCard.userId === where.userId
                ? state.userCard
                : null,
            ),
          },
          userWishlist: {
            create: jest.fn(),
            delete: jest.fn(async ({ where }: { where: { id: number } }) => {
              if (state.userWishlist?.id === where.id) {
                state.userWishlist = null;
              }
            }),
            update: jest.fn(),
            findFirst: jest.fn(async () => null),
          },
          $executeRawUnsafe: jest.fn(async () => 1),
        };

        return callback(tx);
      }),
    };

    const catalogIndexService = {
      upsertCatalogNodes: jest.fn(async () => ({
        cardSet,
        cardDefinition,
      })),
    };

    const catalogQueryService = {
      interpret: jest.fn(() => ({
        text: null,
        collectionStatus: undefined,
        sport: null,
        year: null,
        vintageOnly: false,
        autographedOnly: false,
        forTradeOnly: false,
        forSaleOnly: false,
        wishlistPriority: null,
      })),
    };

    const service = new CatalogService(
      prisma as never,
      {} as never,
      catalogIndexService as never,
      catalogQueryService as never,
      {} as never,
    );

    return {
      service,
      state,
    };
  }

  it('moves a wishlist card to owned while preserving the public id', async () => {
    const { service, state } = createServiceWithWantedRow();

    const updated = await service.updateCard(22, userId, {
      collectionStatus: CollectionStatus.OWNED,
      gradeEstimate: 'Raw',
    });

    expect(updated).toMatchObject({
      id: 22,
      collectionStatus: CollectionStatus.OWNED,
      title: '1979 · Wayne Gretzky · 1979 O-Pee-Chee #18',
      definition: {
        name: '1979 O-Pee-Chee #18',
        player: 'Wayne Gretzky',
        cardSet: {
          setName: 'Hockey',
          yearManufactured: 1979,
        },
      },
      record: {
        gradeEstimate: 'Raw',
      },
    });
    expect(state.userWishlist).toBeNull();
    expect(state.userCard).toMatchObject({
      id: 22,
      userId,
      cardDefinitionId: cardDefinition.id,
      gradeEstimate: 'Raw',
    });
  });

  it('keeps empty sort values last for both ascending and descending inventory sorts', async () => {
    const createdAt = new Date('2026-04-08T12:00:00Z');
    const updatedAt = new Date('2026-04-08T12:05:00Z');
    const prisma = {
      userCard: {
        findMany: jest.fn(async () => [
          {
            id: 1,
            userId,
            cardDefinitionId: 'definition-1',
            condition: 'Near Mint',
            isAutographed: false,
            autographFormat: null,
            imageUrl: null,
            originalImageKey: null,
            thumbnailImageKey: null,
            frontImageKey: null,
            backImageKey: null,
            isForTrade: false,
            isForSale: false,
            askingPriceCents: null,
            notes: null,
            gradeEstimate: 'BGS 9',
            confidence: 0.8,
            scanJobId: null,
            createdAt,
            updatedAt,
            cardDefinition,
          },
          {
            id: 2,
            userId,
            cardDefinitionId: 'definition-2',
            condition: null,
            isAutographed: false,
            autographFormat: null,
            imageUrl: null,
            originalImageKey: null,
            thumbnailImageKey: null,
            frontImageKey: null,
            backImageKey: null,
            isForTrade: false,
            isForSale: false,
            askingPriceCents: null,
            notes: null,
            gradeEstimate: null,
            confidence: 0.7,
            scanJobId: null,
            createdAt,
            updatedAt: new Date('2026-04-09T12:05:00Z'),
            cardDefinition: {
              ...cardDefinition,
              id: 'definition-2',
              name: '1992 Upper Deck SPX',
            },
          },
        ]),
      },
      userWishlist: {
        findMany: jest.fn(async () => []),
      },
    };

    const service = new CatalogService(
      prisma as never,
      {} as never,
      {} as never,
      {
        interpret: jest.fn(() => ({
          text: null,
          collectionStatus: undefined,
          sport: null,
          year: null,
          vintageOnly: false,
          autographedOnly: false,
          forTradeOnly: false,
          forSaleOnly: false,
          wishlistPriority: null,
        })),
      } as never,
      {} as never,
    );

    const ascending = await service.listCards({
      userId,
      sortBy: CardSortBy.GRADE_ESTIMATE,
      sortDirection: SortDirection.ASC,
    });
    const descending = await service.listCards({
      userId,
      sortBy: CardSortBy.GRADE_ESTIMATE,
      sortDirection: SortDirection.DESC,
    });

    expect(ascending.items.map((item) => item.id)).toEqual([1, 2]);
    expect(descending.items.map((item) => item.id)).toEqual([1, 2]);
  });
});
