import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresService } from '../stores/stores.service';
import { InventoryStockService } from './inventory-stock.service';

type FindRepository<T> = {
  find: jest.MockedFunction<Repository<T>['find']>;
};

function createFindRepository<T>(): FindRepository<T> {
  return {
    find: jest.fn() as jest.MockedFunction<Repository<T>['find']>,
  };
}

describe('InventoryStockService', () => {
  let service: InventoryStockService;
  let productRepository: FindRepository<Product>;
  let purchaseRepository: FindRepository<Purchase>;
  let orderRepository: FindRepository<Order>;
  let adjustmentRepository: FindRepository<InventoryAdjustment>;
  let destructionRepository: FindRepository<InventoryDestruction>;
  let dailySettlementRepository: FindRepository<DailySettlement>;

  const storeId = '11111111-1111-4111-8111-111111111111';
  const authUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId,
  };

  beforeEach(async () => {
    productRepository = createFindRepository<Product>();
    purchaseRepository = createFindRepository<Purchase>();
    orderRepository = createFindRepository<Order>();
    adjustmentRepository = createFindRepository<InventoryAdjustment>();
    destructionRepository = createFindRepository<InventoryDestruction>();
    dailySettlementRepository = createFindRepository<DailySettlement>();

    const module = await Test.createTestingModule({
      providers: [
        InventoryStockService,
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: purchaseRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(InventoryAdjustment),
          useValue: adjustmentRepository,
        },
        {
          provide: getRepositoryToken(InventoryDestruction),
          useValue: destructionRepository,
        },
        {
          provide: getRepositoryToken(DailySettlement),
          useValue: dailySettlementRepository,
        },
        {
          provide: StoresService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: storeId }) },
        },
      ],
    }).compile();

    service = module.get(InventoryStockService);
  });

  function mockSingleProduct(): void {
    productRepository.find.mockResolvedValue([
      {
        id: 'server-product-id',
        clientProductId: 'product-1',
        name: 'Cake',
        unitType: 'PIECE',
        price: 20,
        costPrice: 10,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      } as Product,
    ]);
  }

  beforeEach(() => {
    purchaseRepository.find.mockResolvedValue([]);
    orderRepository.find.mockResolvedValue([]);
    adjustmentRepository.find.mockResolvedValue([]);
    destructionRepository.find.mockResolvedValue([]);
    dailySettlementRepository.find.mockResolvedValue([]);
  });

  it('uses the latest settlement closing quantity as previous remaining', async () => {
    mockSingleProduct();
    dailySettlementRepository.find.mockResolvedValue([
      {
        storeId,
        businessDate: '2020-01-04',
        syncedAt: new Date('2020-01-04T20:00:00.000Z'),
        createdAt: new Date('2020-01-04T20:00:00.000Z'),
      } as DailySettlement,
    ]);
    adjustmentRepository.find.mockResolvedValue([
      {
        productClientId: 'product-1',
        actualQuantity: 8,
        adjustedAt: new Date('2020-01-05T00:00:00.000Z'),
        createdAt: new Date('2020-01-05T00:00:00.000Z'),
      } as InventoryAdjustment,
      {
        productClientId: 'product-1',
        actualQuantity: 20,
        adjustedAt: new Date('2020-01-02T00:00:00.000Z'),
        createdAt: new Date('2020-01-02T00:00:00.000Z'),
      } as InventoryAdjustment,
    ]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(rows).toEqual([
      expect.objectContaining({
        productClientId: 'product-1',
        remainingQty: 8,
        previousRemainingQty: 20,
      }),
    ]);
  });

  it('includes movements up to the latest settlement in previous remaining', async () => {
    mockSingleProduct();
    dailySettlementRepository.find.mockResolvedValue([
      {
        storeId,
        businessDate: '2020-01-04',
        syncedAt: new Date('2020-01-04T20:00:00.000Z'),
        createdAt: new Date('2020-01-04T20:00:00.000Z'),
      } as DailySettlement,
    ]);
    purchaseRepository.find.mockResolvedValue([
      {
        storeId,
        productName: 'Cake',
        quantity: 7,
        purchaseKind: 'SUPPLY',
        purchaseDate: '2020-01-03',
        createdAt: new Date('2020-01-03T12:00:00.000Z'),
      } as Purchase,
    ]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(rows).toEqual([
      expect.objectContaining({
        productClientId: 'product-1',
        remainingQty: 7,
        previousRemainingQty: 7,
      }),
    ]);
  });

  it('falls back to zero when a product has no previous settlement', async () => {
    mockSingleProduct();
    purchaseRepository.find.mockResolvedValue([
      {
        storeId,
        productName: 'Cake',
        quantity: 7,
        purchaseKind: 'SUPPLY',
        purchaseDate: '2020-01-03',
        createdAt: new Date('2020-01-03T12:00:00.000Z'),
      } as Purchase,
    ]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(rows).toEqual([
      expect.objectContaining({
        productClientId: 'product-1',
        remainingQty: 7,
        previousRemainingQty: 0,
      }),
    ]);
  });

  it('does not change previous remaining from movements after the last settlement', async () => {
    mockSingleProduct();
    dailySettlementRepository.find.mockResolvedValue([
      {
        storeId,
        businessDate: '2020-01-02',
        syncedAt: new Date('2020-01-02T00:00:00.000Z'),
        createdAt: new Date('2020-01-02T00:00:00.000Z'),
      } as DailySettlement,
    ]);
    adjustmentRepository.find.mockResolvedValue([
      {
        productClientId: 'product-1',
        actualQuantity: 10,
        adjustedAt: new Date('2020-01-02T00:00:00.000Z'),
        createdAt: new Date('2020-01-02T00:00:00.000Z'),
      } as InventoryAdjustment,
    ]);
    purchaseRepository.find.mockResolvedValue([
      {
        storeId,
        productName: 'Cake',
        quantity: 99,
        purchaseKind: 'SUPPLY',
        purchaseDate: '2020-01-01',
        createdAt: new Date('2020-01-01T12:00:00.000Z'),
      } as Purchase,
      {
        storeId,
        productName: 'Cake',
        quantity: 5,
        purchaseKind: 'SUPPLY',
        purchaseDate: '2020-01-03',
        createdAt: new Date('2020-01-03T12:00:00.000Z'),
      } as Purchase,
    ]);
    orderRepository.find.mockResolvedValue([
      {
        storeId,
        status: OrderStatus.COMPLETED,
        orderedAt: new Date('2020-01-04T12:00:00.000Z'),
        createdAt: new Date('2020-01-04T12:00:00.000Z'),
        items: [
          { productName: 'Cake', quantity: 3, unitPrice: 20, lineTotal: 60 },
        ],
      } as Order,
      {
        storeId,
        status: OrderStatus.REFUNDED,
        orderedAt: new Date('2020-01-05T12:00:00.000Z'),
        createdAt: new Date('2020-01-05T12:00:00.000Z'),
        items: [
          { productName: 'Cake', quantity: 1, unitPrice: 20, lineTotal: 20 },
        ],
      } as Order,
    ]);
    destructionRepository.find.mockResolvedValue([
      {
        storeId,
        productClientId: 'product-1',
        quantity: 2,
        destroyedAt: new Date('2020-01-06T12:00:00.000Z'),
        createdAt: new Date('2020-01-06T12:00:00.000Z'),
      } as InventoryDestruction,
    ]);

    const rows = await service.findAll({ storeId }, authUser);

    expect(rows).toEqual([
      expect.objectContaining({
        storeId,
        productId: 'product-1',
        productClientId: 'product-1',
        name: 'Cake',
        remainingQty: 11,
        previousRemainingQty: 10,
        loggedToday: 0,
      }),
    ]);
  });
});
