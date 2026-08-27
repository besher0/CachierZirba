import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InventoryBalancesService } from '../inventory-balances/inventory-balances.service';
import { StoresService } from '../stores/stores.service';
import { Purchase } from './entities/purchase.entity';
import { PurchasesService } from './purchases.service';

type MockQueryBuilder = {
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  andWhere: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const qb = {} as MockQueryBuilder;
  qb.leftJoinAndSelect = jest.fn(() => qb);
  qb.orderBy = jest.fn(() => qb);
  qb.addOrderBy = jest.fn(() => qb);
  qb.andWhere = jest.fn(() => qb);
  qb.skip = jest.fn(() => qb);
  qb.take = jest.fn(() => qb);
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('PurchasesService', () => {
  let service: PurchasesService;
  let repository: jest.Mocked<Partial<Repository<Purchase>>>;
  let storesService: { findById: jest.Mock };
  let inventoryBalancesService: {
    runInTransaction: jest.Mock;
    applyPurchaseDelta: jest.Mock;
  };
  let queryBuilder: MockQueryBuilder;

  const storeId = '11111111-1111-4111-8111-111111111111';
  const cashierUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId,
  };
  const adminUser: AuthUser = {
    id: 'admin-id',
    username: 'admin',
    displayName: 'Admin',
    role: UserRole.ADMIN,
    storeId: null,
  };
  const payload = {
    clientPurchaseId: 'purchase-1',
    storeId,
    productName: 'test-product',
    quantity: 5,
    unitCost: 10,
    totalCost: 50,
    purchaseDate: '2026-06-14',
    syncedAt: '2026-06-13T21:30:00.000Z',
  };

  beforeEach(async () => {
    queryBuilder = createMockQueryBuilder();
    repository = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder as never),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    storesService = { findById: jest.fn() };
    inventoryBalancesService = {
      runInTransaction: jest.fn(async (work) =>
        work({
          getRepository: jest.fn(() => repository),
        }),
      ),
      applyPurchaseDelta: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: repository,
        },
        { provide: StoresService, useValue: storesService },
        { provide: InventoryBalancesService, useValue: inventoryBalancesService },
      ],
    }).compile();

    service = module.get(PurchasesService);
  });

  it('allows a cashier to create a purchase for the assigned store', async () => {
    const created = {
      ...payload,
      note: null,
      syncedAt: new Date(payload.syncedAt),
    } as Purchase;
    const saved = { ...created, id: 'server-id' } as Purchase;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.create(payload, cashierUser)).resolves.toBe(saved);
    expect(storesService.findById).toHaveBeenCalledWith(storeId);
    expect(repository.save).toHaveBeenCalledWith(created);
    expect(inventoryBalancesService.applyPurchaseDelta).toHaveBeenCalledWith(
      expect.anything(),
      saved,
    );
  });

  it('allows an admin to create a purchase for the selected store', async () => {
    const created = {
      ...payload,
      note: null,
      syncedAt: new Date(payload.syncedAt),
    } as Purchase;
    const saved = { ...created, id: 'server-id' } as Purchase;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.create(payload, adminUser)).resolves.toBe(saved);
    expect(storesService.findById).toHaveBeenCalledWith(storeId);
    expect(repository.save).toHaveBeenCalledWith(created);
    expect(inventoryBalancesService.applyPurchaseDelta).toHaveBeenCalledWith(
      expect.anything(),
      saved,
    );
  });

  it('accepts stock-only purchases for inventory without invoice cost', async () => {
    const stockOnlyPayload = {
      ...payload,
      clientPurchaseId: 'stock-only-1',
      quantity: 3,
      unitCost: 0,
      totalCost: 0,
      purchaseKind: 'STOCK_ONLY' as const,
      paymentAmount: 0,
      note: 'جرد فقط خارج فاتورة التوريدات',
    };
    const created = {
      ...stockOnlyPayload,
      syncedAt: new Date(payload.syncedAt),
    } as Purchase;
    const saved = { ...created, id: 'server-id' } as Purchase;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.create(stockOnlyPayload, adminUser)).resolves.toBe(
      saved,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseKind: 'STOCK_ONLY',
        unitCost: 0,
        totalCost: 0,
        paymentAmount: 0,
      }),
    );
  });

  it('applies the default list limit when none is provided', async () => {
    await service.findAll({}, adminUser);

    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(200);
  });

  it('caps the list limit at the maximum value', async () => {
    await service.findAll({ limit: 999 }, adminUser);

    expect(queryBuilder.take).toHaveBeenCalledWith(500);
  });

  it('applies list offset with the requested limit', async () => {
    await service.findAll({ limit: 50, offset: 40 }, adminUser);

    expect(queryBuilder.skip).toHaveBeenCalledWith(40);
    expect(queryBuilder.take).toHaveBeenCalledWith(50);
  });

  it('keeps purchase list filters while paginating', async () => {
    await service.findAll(
      {
        storeId,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30',
        product: 'cones',
        limit: 25,
        offset: 10,
      },
      adminUser,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('p.storeId = :storeId', {
      storeId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'p.purchaseDate >= :fromDate',
      { fromDate: '2026-06-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'p.purchaseDate <= :toDate',
      { toDate: '2026-06-30' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(p.productName) LIKE LOWER(:product)',
      { product: '%cones%' },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(25);
  });
});
