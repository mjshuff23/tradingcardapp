import { CollectionStatus } from '@prisma/client';
import { CatalogService } from '../src/catalog/catalog.service';

type CardSetRow = {
  id: string;
  setName: string | null;
  yearManufactured: number | null;
  sport: string | null;
};

type CardDefinitionRow = {
  id: string;
  name: string;
  player: string | null;
  variant: string | null;
  legacySetText: string | null;
  cardSet: CardSetRow | null;
};

type UserCardRow = {
  id: number;
  userId: string;
  cardDefinitionId: string;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  notes: string | null;
  gradeEstimate: string | null;
  confidence: number | null;
  scanJobId: number | null;
  createdAt: Date;
  updatedAt: Date;
  cardDefinition: CardDefinitionRow;
};

type UserWishlistRow = UserCardRow;

describe('CatalogService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const cardSet: CardSetRow = {
    id: 'set-1',
    setName: 'O-Pee-Chee Hockey',
    yearManufactured: 1979,
    sport: 'Hockey',
  };
  const cardDefinition: CardDefinitionRow = {
    id: 'definition-1',
    name: '1979 O-Pee-Chee #18',
    player: 'Wayne Gretzky',
    variant: 'Rookie',
    legacySetText: 'O-Pee-Chee Hockey',
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
        imageUrl: null,
        originalImageKey: null,
        thumbnailImageKey: null,
        notes: null,
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
        findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
          state.userCard && state.userCard.id === where.id ? state.userCard : null,
        ),
      },
      userWishlist: {
        findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
          state.userWishlist && state.userWishlist.id === where.id ? state.userWishlist : null,
        ),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const tx = {
          userCard: {
            create: jest.fn(async ({ data }: { data: Partial<UserCardRow> }) => {
              state.userCard = {
                ...(state.userWishlist as UserWishlistRow),
                ...data,
                cardDefinition,
                cardDefinitionId: cardDefinition.id,
              };
              return state.userCard;
            }),
            delete: jest.fn(async ({ where }: { where: { id: number } }) => {
              if (state.userCard?.id === where.id) {
                state.userCard = null;
              }
            }),
            update: jest.fn(),
            findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
              state.userCard && state.userCard.id === where.id ? state.userCard : null,
            ),
          },
          userWishlist: {
            create: jest.fn(async ({ data }: { data: Partial<UserWishlistRow> }) => {
              state.userWishlist = {
                ...(state.userCard as UserCardRow),
                ...data,
                cardDefinition,
                cardDefinitionId: cardDefinition.id,
              };
              return state.userWishlist;
            }),
            delete: jest.fn(async ({ where }: { where: { id: number } }) => {
              if (state.userWishlist?.id === where.id) {
                state.userWishlist = null;
              }
            }),
            update: jest.fn(),
            findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
              state.userWishlist && state.userWishlist.id === where.id ? state.userWishlist : null,
            ),
            findFirst: jest.fn(async () => null),
          },
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

    const service = new CatalogService(
      prisma as never,
      {} as never,
      catalogIndexService as never,
    );

    return {
      service,
      state,
    };
  }

  it('moves a wishlist card to owned while preserving the public id', async () => {
    const { service, state } = createServiceWithWantedRow();

    const updated = await service.updateCard(22, {
      collectionStatus: CollectionStatus.OWNED,
      gradeEstimate: 'Raw',
    });

    expect(updated).toMatchObject({
      id: 22,
      collectionStatus: CollectionStatus.OWNED,
      gradeEstimate: 'Raw',
      set: 'O-Pee-Chee Hockey',
      year: 1979,
      player: 'Wayne Gretzky',
    });
    expect(state.userWishlist).toBeNull();
    expect(state.userCard).toMatchObject({
      id: 22,
      userId,
      cardDefinitionId: cardDefinition.id,
      gradeEstimate: 'Raw',
    });
  });
});
