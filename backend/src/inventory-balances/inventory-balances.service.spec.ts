import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { PaymentMethod } from '../orders/enums/payment-method.enum';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Store } from '../stores/entities/store.entity';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventorySettlementSnapshot } from './entities/inventory-settlement-snapshot.entity';
import { InventoryBalancesService } from './inventory-balances.service';

describe('InventoryBalancesService', () => {
  let moduleRef: TestingModule;
  let service: InventoryBalancesService;
  let dataSource: DataSource;

  const storeId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          retryAttempts: 0,
          entities: [
            Store,
            Product,
            Expense,
            Purchase,
            Order,
            DailySettlement,
            InventoryAdjustment,
            InventoryDestruction,
            InventoryBalance,
            InventorySettlementSnapshot,
          ],
        }),
        TypeOrmModule.forFeature([
          InventoryBalance,
          InventorySettlementSnapshot,
        ]),
      ],
      providers: [InventoryBalancesService],
    }).compile();

    service = moduleRef.get(InventoryBalancesService);
    dataSource = moduleRef.get(DataSource);

    await dataSource.getRepository(Store).save({
      id: storeId,
      name: 'Main',
      code: 'MAIN',
      isActive: true,
      cashCarryAmount: 0,
    });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('falls back to full-history reconciliation when the store has no settlement snapshot', async () => {
    await saveProduct('product-cake', 'Cake');
    await savePurchase({
      clientPurchaseId: 'purchase-cake-1',
      productName: 'Cake',
      quantity: 5,
      syncedAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'order-cake-1',
      productName: 'Cake',
      quantity: 2,
      status: OrderStatus.COMPLETED,
      orderedAt: new Date('2026-08-01T11:00:00.000Z'),
    });
    await saveBalance('product-cake', 2);

    await expect(service.reconcileStore(storeId)).resolves.toEqual([
      {
        storeId,
        productClientId: 'product-cake',
        calculatedFromHistory: 3,
        currentBalance: 2,
        difference: -1,
      },
    ]);
  });

  it('uses the latest settlement snapshot and only applies later inventory movement', async () => {
    await saveProduct('product-cake', 'Cake');
    await saveProduct('product-beans', 'Beans');
    const settlement = await saveSettlementWithSnapshots(
      'settlement-latest',
      new Date('2026-08-10T12:00:00.000Z'),
      [
        { productClientId: 'product-cake', quantity: 10 },
        { productClientId: 'product-beans', quantity: 7 },
      ],
    );

    await savePurchase({
      clientPurchaseId: 'purchase-before-snapshot',
      productName: 'Beans',
      quantity: 50,
      syncedAt: new Date('2026-08-09T10:00:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'order-beans-after-snapshot',
      productName: 'Beans',
      quantity: 2,
      status: OrderStatus.COMPLETED,
      orderedAt: new Date('2026-08-10T13:00:00.000Z'),
    });
    await savePurchase({
      clientPurchaseId: 'purchase-before-adjustment',
      productName: 'Cake',
      quantity: 5,
      syncedAt: new Date('2026-08-10T13:30:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'order-before-adjustment',
      productName: 'Cake',
      quantity: 1,
      status: OrderStatus.COMPLETED,
      orderedAt: new Date('2026-08-10T14:00:00.000Z'),
    });
    await saveAdjustment(
      'adjustment-cake',
      'product-cake',
      20,
      new Date('2026-08-11T00:00:00.000Z'),
    );
    await savePurchase({
      clientPurchaseId: 'purchase-after-adjustment',
      productName: 'Cake',
      quantity: 3,
      syncedAt: new Date('2026-08-11T01:00:00.000Z'),
    });
    await savePurchase({
      clientPurchaseId: 'payment-after-adjustment',
      productName: 'Cake',
      quantity: 100,
      purchaseKind: 'PAYMENT',
      syncedAt: new Date('2026-08-11T01:15:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'order-after-adjustment',
      productName: 'Cake',
      quantity: 2,
      status: OrderStatus.COMPLETED,
      orderedAt: new Date('2026-08-11T02:00:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'refund-after-adjustment',
      productName: 'Cake',
      quantity: 1,
      status: OrderStatus.REFUNDED,
      orderedAt: new Date('2026-08-11T03:00:00.000Z'),
    });
    await saveDestruction(
      'destruction-after-adjustment',
      'product-cake',
      0.5,
      new Date('2026-08-11T04:00:00.000Z'),
    );
    await saveBalance('product-cake', 20);
    await saveBalance('product-beans', 4);

    const rows = await service.reconcileStore(storeId);

    expect(settlement.id).toBeDefined();
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          storeId,
          productClientId: 'product-cake',
          calculatedFromHistory: 21.5,
          currentBalance: 20,
          difference: -1.5,
        },
        {
          storeId,
          productClientId: 'product-beans',
          calculatedFromHistory: 5,
          currentBalance: 4,
          difference: -1,
        },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('repairs balances using one reconciliation pass', async () => {
    await saveProduct('product-repair', 'Repair Cake');
    await savePurchase({
      clientPurchaseId: 'purchase-repair',
      productName: 'Repair Cake',
      quantity: 6,
      syncedAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    await saveOrder({
      clientOrderId: 'order-repair',
      productName: 'Repair Cake',
      quantity: 1,
      status: OrderStatus.COMPLETED,
      orderedAt: new Date('2026-08-01T11:00:00.000Z'),
    });
    await saveBalance('product-repair', 0);

    const calculateSpy = jest.spyOn(
      service as never,
      'calculateCurrentStock' as never,
    );
    const rows = await dataSource.transaction((manager) =>
      service.repairStore(storeId, manager),
    );
    const balance = await dataSource
      .getRepository(InventoryBalance)
      .findOneByOrFail({
        storeId,
        productClientId: 'product-repair',
      });

    expect(calculateSpy).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        storeId,
        productClientId: 'product-repair',
        calculatedFromHistory: 5,
        currentBalance: 0,
        difference: -5,
      },
    ]);
    expect(balance.quantity).toBe(5);
  });

  async function saveProduct(
    clientProductId: string,
    name: string,
  ): Promise<void> {
    await dataSource.getRepository(Product).save({
      clientProductId,
      name,
      unitType: 'PIECE',
      price: 10,
      costPrice: 5,
      excludeFromPurchaseInvoice: false,
      syncedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
  }

  async function savePurchase(options: {
    clientPurchaseId: string;
    productName: string;
    quantity: number;
    syncedAt: Date;
    purchaseKind?: 'SUPPLY' | 'TAWASI' | 'PAYMENT' | 'STOCK_ONLY';
  }): Promise<void> {
    await dataSource.getRepository(Purchase).save({
      clientPurchaseId: options.clientPurchaseId,
      storeId,
      productName: options.productName,
      quantity: options.quantity,
      unitCost: 5,
      totalCost: options.quantity * 5,
      purchaseKind: options.purchaseKind ?? 'SUPPLY',
      sellPrice: null,
      paymentAmount:
        options.purchaseKind === 'PAYMENT' ? options.quantity * 5 : 0,
      purchaseDate: options.syncedAt.toISOString().slice(0, 10),
      note: null,
      syncedAt: options.syncedAt,
    });
  }

  async function saveOrder(options: {
    clientOrderId: string;
    productName: string;
    quantity: number;
    status: OrderStatus;
    orderedAt: Date;
  }): Promise<void> {
    await dataSource.getRepository(Order).save({
      clientOrderId: options.clientOrderId,
      storeId,
      cashierName: 'Cashier',
      status: options.status,
      paymentMethod: PaymentMethod.CASH,
      subtotal: options.quantity * 10,
      discount: 0,
      tax: 0,
      total: options.quantity * 10,
      items: [
        {
          productName: options.productName,
          quantity: options.quantity,
          unitPrice: 10,
          lineTotal: options.quantity * 10,
        },
      ],
      note: null,
      orderedAt: options.orderedAt,
      syncedAt: options.orderedAt,
    });
  }

  async function saveAdjustment(
    clientAdjustmentId: string,
    productClientId: string,
    actualQuantity: number,
    adjustedAt: Date,
  ): Promise<void> {
    await dataSource.getRepository(InventoryAdjustment).save({
      clientAdjustmentId,
      storeId,
      productClientId,
      actualQuantity,
      adjustedAt,
      syncedAt: adjustedAt,
    });
  }

  async function saveDestruction(
    clientDestructionId: string,
    productClientId: string,
    quantity: number,
    destroyedAt: Date,
  ): Promise<void> {
    await dataSource.getRepository(InventoryDestruction).save({
      clientDestructionId,
      storeId,
      productClientId,
      quantity,
      note: null,
      destroyedAt,
      syncedAt: destroyedAt,
    });
  }

  async function saveBalance(
    productClientId: string,
    quantity: number,
  ): Promise<void> {
    await dataSource.getRepository(InventoryBalance).save({
      storeId,
      productClientId,
      quantity,
    });
  }

  async function saveSettlementWithSnapshots(
    clientClosureId: string,
    syncedAt: Date,
    snapshots: Array<{ productClientId: string; quantity: number }>,
  ): Promise<DailySettlement> {
    const settlement = await dataSource.getRepository(DailySettlement).save({
      clientClosureId,
      storeId,
      businessDate: syncedAt.toISOString().slice(0, 10),
      cashBoxAmount: 0,
      sharesAmount: 0,
      actualRemainingAmount: 0,
      expectedRevenue: 0,
      carryInAmount: 0,
      cycleStartedAt: null,
      salesAmount: 0,
      refundAmount: 0,
      expensesAmount: 0,
      purchasesAmount: 0,
      tawasiAmount: 0,
      employeeWithdrawalsAmount: 0,
      ordersCount: 0,
      expensesCount: 0,
      purchasesCount: 0,
      withdrawalsCount: 0,
      paymentsAmount: 0,
      note: null,
      syncedAt,
    });

    await dataSource.getRepository(InventorySettlementSnapshot).save(
      snapshots.map((snapshot) => ({
        settlementId: settlement.id,
        storeId,
        productClientId: snapshot.productClientId,
        quantity: snapshot.quantity,
      })),
    );

    return settlement;
  }
});
