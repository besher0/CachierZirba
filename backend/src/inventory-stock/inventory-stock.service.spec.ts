import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InventoryBalance } from '../inventory-balances/entities/inventory-balance.entity';
import { InventorySettlementSnapshot } from '../inventory-balances/entities/inventory-settlement-snapshot.entity';
import { InventoryBalancesService } from '../inventory-balances/inventory-balances.service';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresService } from '../stores/stores.service';
import { InventoryStockService } from './inventory-stock.service';

type ProductRepositoryMock = {
  find: jest.Mock;
};

type PurchaseQueryBuilderMock = {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  getRawMany: jest.Mock;
};

function createPurchaseQueryBuilder(): PurchaseQueryBuilderMock {
  const qb = {} as PurchaseQueryBuilderMock;
  qb.select = jest.fn(() => qb);
  qb.addSelect = jest.fn(() => qb);
  qb.where = jest.fn(() => qb);
  qb.andWhere = jest.fn(() => qb);
  qb.groupBy = jest.fn(() => qb);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('InventoryStockService', () => {
  let service: InventoryStockService;
  let productRepository: ProductRepositoryMock;
  let purchaseQueryBuilder: PurchaseQueryBuilderMock;
  let inventoryBalancesService: {
    findBalancesByStore: jest.Mock;
    findLatestSnapshotsByStore: jest.Mock;
  };

  const storeId = '11111111-1111-4111-8111-111111111111';
  const authUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId,
  };
  const products = [
    {
      id: 'server-product-id',
      clientProductId: 'product-1',
      name: 'Cake',
      unitType: 'PIECE',
      price: 20,
      costPrice: 10,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    },
    {
      id: 'server-product-id-2',
      clientProductId: 'product-2',
      name: 'Coffee',
      unitType: 'KG',
      price: 30,
      costPrice: 15,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    },
  ] as Product[];

  beforeEach(async () => {
    purchaseQueryBuilder = createPurchaseQueryBuilder();
    productRepository = {
      find: jest.fn().mockResolvedValue(products),
    };
    inventoryBalancesService = {
      findBalancesByStore: jest.fn().mockResolvedValue([]),
      findLatestSnapshotsByStore: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        InventoryStockService,
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            createQueryBuilder: jest.fn(() => purchaseQueryBuilder),
          },
        },
        {
          provide: InventoryBalancesService,
          useValue: inventoryBalancesService,
        },
        {
          provide: StoresService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: storeId }) },
        },
      ],
    }).compile();

    service = module.get(InventoryStockService);
  });

  it('reads current stock from inventory balances and previous stock from latest settlement snapshots', async () => {
    inventoryBalancesService.findBalancesByStore.mockResolvedValue([
      {
        storeId,
        productClientId: 'product-1',
        quantity: 8.1254,
      },
    ] as InventoryBalance[]);
    inventoryBalancesService.findLatestSnapshotsByStore.mockResolvedValue([
      {
        storeId,
        productClientId: 'product-1',
        quantity: 7.5,
      },
    ] as InventorySettlementSnapshot[]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(rows).toEqual([
      expect.objectContaining({
        productClientId: 'product-1',
        remainingQty: 8.125,
        previousRemainingQty: 7.5,
      }),
      expect.objectContaining({
        productClientId: 'product-2',
        remainingQty: 0,
        previousRemainingQty: 0,
      }),
    ]);
    expect(inventoryBalancesService.findBalancesByStore).toHaveBeenCalledWith(
      storeId,
    );
  });

  it('calculates loggedToday only from today non-payment purchase aggregation', async () => {
    purchaseQueryBuilder.getRawMany.mockResolvedValue([
      { productName: 'Cake', quantity: '4.25' },
      { productName: 'Unknown', quantity: '99' },
    ]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(purchaseQueryBuilder.where).toHaveBeenCalledWith(
      'purchase.storeId = :storeId',
      { storeId },
    );
    expect(purchaseQueryBuilder.andWhere).toHaveBeenCalledWith(
      'purchase.purchaseKind <> :paymentKind',
      { paymentKind: 'PAYMENT' },
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({
        productClientId: 'product-1',
        loggedToday: 4.25,
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        productClientId: 'product-2',
        loggedToday: 0,
      }),
    );
  });
});
