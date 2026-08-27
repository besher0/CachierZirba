import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { InventoryBalance } from '../src/inventory-balances/entities/inventory-balance.entity';
import { InventoryBalancesService } from '../src/inventory-balances/inventory-balances.service';
import { DataSource } from 'typeorm';

const MAIN_STORE_ID = '11111111-1111-4111-8111-111111111111';
const MALL_STORE_ID = '22222222-2222-4222-8222-222222222222';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    role: 'ADMIN' | 'CASHIER';
    displayName: string;
    storeId: string | null;
  };
  expiresIn: string;
}

interface ProductSalesTestItem {
  productName: string;
  quantity: number;
  lineTotal: number;
}

interface ProductSalesTestOrder {
  storeId: string;
  status: string;
  orderedAt: string;
  items: ProductSalesTestItem[];
}

function expectedProductSalesFromOldReduction(
  orders: ProductSalesTestOrder[],
  storeId: string,
  range: { from?: string; to?: string } = {},
) {
  const fromBoundary = range.from
    ? new Date(
        range.from.length === 10
          ? `${range.from}T00:00:00.000Z`
          : range.from,
      )
    : null;
  const toBoundary = range.to
    ? new Date(
        range.to.length === 10 ? `${range.to}T23:59:59.999Z` : range.to,
      )
    : null;
  const byProduct = new Map<
    string,
    {
      productName: string;
      soldQty: number;
      refundedQty: number;
      netQty: number;
      netAmount: number;
    }
  >();

  orders
    .filter((order) => order.storeId === storeId)
    .filter((order) => {
      const orderedAt = new Date(order.orderedAt);
      return (
        (!fromBoundary || orderedAt >= fromBoundary) &&
        (!toBoundary || orderedAt <= toBoundary)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
    )
    .forEach((order) => {
      order.items.forEach((item) => {
        const key = item.productName.trim().toLocaleLowerCase();
        const row = byProduct.get(key) ?? {
          productName: item.productName,
          soldQty: 0,
          refundedQty: 0,
          netQty: 0,
          netAmount: 0,
        };

        if (order.status === 'REFUNDED') {
          row.refundedQty += item.quantity;
          row.netQty -= item.quantity;
          row.netAmount -= item.lineTotal;
        } else {
          row.soldQty += item.quantity;
          row.netQty += item.quantity;
          row.netAmount += item.lineTotal;
        }

        byProduct.set(key, row);
      });
    });

  return Array.from(byProduct.values())
    .map((row) => ({
      ...row,
      soldQty: Number(row.soldQty.toFixed(3)),
      refundedQty: Number(row.refundedQty.toFixed(3)),
      netQty: Number(row.netQty.toFixed(3)),
      netAmount: Number(row.netAmount.toFixed(2)),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName, 'ar'));
}

describe('Zirba API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken = '';
  let adminUsername = '';
  let cashierMainToken = '';
  let adminCreatedExpenseId = '';
  let adminCreatedPurchaseId = '';
  let createdExpenseId = '';
  let createdPurchaseId = '';
  let dataSource: DataSource;
  let inventoryBalancesService: InventoryBalancesService;
  const e2eDbPath = join(process.cwd(), 'zirba.e2e.db');

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    process.env.SQLITE_DB_PATH = e2eDbPath;
    process.env.TYPEORM_SYNCHRONIZE = 'true';
    if (existsSync(e2eDbPath)) {
      await unlink(e2eDbPath);
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: true,
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
    inventoryBalancesService = app.get(InventoryBalancesService);
  });

  it('GET /api/health should be public', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({
      service: 'zirba-backend',
      status: 'ok',
    });
  });

  it('POST /api/auth/login should authenticate admin and cashier users', async () => {
    const admin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'مها', password: 'abcd' })
      .expect(201);

    const cashier = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'محافظة', password: '0000' })
      .expect(201);

    const adminBody = admin.body as LoginResponse;
    const cashierBody = cashier.body as LoginResponse;

    adminToken = adminBody.accessToken;
    adminUsername = adminBody.user.username;
    cashierMainToken = cashierBody.accessToken;

    expect(adminBody.user.role).toBe('ADMIN');
    expect(cashierBody.user.role).toBe('CASHIER');
    expect(cashierBody.user.storeId).toBe(MAIN_STORE_ID);
  });

  it('POST /api/auth/change-password should validate the old password before updating', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .send({
        username: adminUsername,
        oldPassword: 'wrong-password',
        newPassword: 'abcd2',
      })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .send({
        username: adminUsername,
        oldPassword: 'abcd',
        newPassword: 'abcd2',
      })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Password updated successfully.',
    });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password: 'abcd' })
      .expect(401);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password: 'abcd2' })
      .expect(201);

    adminToken = (loginResponse.body as LoginResponse).accessToken;
  });

  it('GET /api/admin/dashboard should reject unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/admin/dashboard').expect(401);
  });

  it('GET /api/admin/dashboard should reject cashier role', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(403);
  });

  it('GET /api/admin/dashboard should allow admin role', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('totals');
    expect(Array.isArray(response.body.stores)).toBe(true);
  });

  it('GET /api/admin/stores/:storeId/product-sales aggregates items in SQL with the old financial semantics', async () => {
    const productSalesOrders: ProductSalesTestOrder[] = [
      {
        storeId: MAIN_STORE_ID,
        status: 'COMPLETED',
        orderedAt: '2026-07-25T09:00:00.000Z',
        items: [{ productName: 'SQL Cake', quantity: 4, lineTotal: 40 }],
      },
      {
        storeId: MAIN_STORE_ID,
        status: 'COMPLETED',
        orderedAt: '2026-08-01T09:00:00.000Z',
        items: [
          { productName: 'SQL Cake', quantity: 2.5, lineTotal: 25 },
          { productName: 'SQL Tea', quantity: 1.25, lineTotal: 6.25 },
        ],
      },
      {
        storeId: MAIN_STORE_ID,
        status: 'COMPLETED',
        orderedAt: '2026-08-02T09:00:00.000Z',
        items: [
          { productName: ' sql cake ', quantity: 0.75, lineTotal: 7.5 },
          { productName: 'SQL Bun', quantity: 2, lineTotal: 5 },
        ],
      },
      {
        storeId: MAIN_STORE_ID,
        status: 'REFUNDED',
        orderedAt: '2026-08-03T09:00:00.000Z',
        items: [
          { productName: 'sql cake', quantity: 1.5, lineTotal: 15.01 },
          { productName: 'SQL Tea', quantity: 0.25, lineTotal: 1.25 },
        ],
      },
      {
        storeId: MALL_STORE_ID,
        status: 'COMPLETED',
        orderedAt: '2026-08-02T09:00:00.000Z',
        items: [{ productName: 'SQL Cake', quantity: 99, lineTotal: 990 }],
      },
    ];

    for (const [index, order] of productSalesOrders.entries()) {
      const total = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientOrderId: `product-sales-sql-${index + 1}`,
          storeId: order.storeId,
          cashierName: 'Report Test',
          status: order.status,
          paymentMethod: 'CASH',
          subtotal: Number(total.toFixed(2)),
          discount: 0,
          tax: 0,
          total: Number(total.toFixed(2)),
          orderedAt: order.orderedAt,
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Number((item.lineTotal / item.quantity).toFixed(2)),
            lineTotal: item.lineTotal,
          })),
        })
        .expect(201);
    }

    const fetchProductSales = async (
      storeId: string,
      range: { from?: string; to?: string } = {},
    ) => {
      const query = [
        range.from ? `from=${encodeURIComponent(range.from)}` : '',
        range.to ? `to=${encodeURIComponent(range.to)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      const response = await request(app.getHttpServer())
        .get(
          `/api/admin/stores/${storeId}/product-sales${query ? `?${query}` : ''}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      return response.body;
    };

    await expect(fetchProductSales(MAIN_STORE_ID)).resolves.toEqual(
      expectedProductSalesFromOldReduction(productSalesOrders, MAIN_STORE_ID),
    );
    await expect(
      fetchProductSales(MAIN_STORE_ID, { from: '2026-08-02' }),
    ).resolves.toEqual(
      expectedProductSalesFromOldReduction(productSalesOrders, MAIN_STORE_ID, {
        from: '2026-08-02',
      }),
    );
    await expect(
      fetchProductSales(MAIN_STORE_ID, { to: '2026-08-01' }),
    ).resolves.toEqual(
      expectedProductSalesFromOldReduction(productSalesOrders, MAIN_STORE_ID, {
        to: '2026-08-01',
      }),
    );
    await expect(
      fetchProductSales(MAIN_STORE_ID, {
        from: '2026-08-01',
        to: '2026-08-03',
      }),
    ).resolves.toEqual(
      expectedProductSalesFromOldReduction(productSalesOrders, MAIN_STORE_ID, {
        from: '2026-08-01',
        to: '2026-08-03',
      }),
    );
    await expect(fetchProductSales(MALL_STORE_ID)).resolves.toEqual(
      expectedProductSalesFromOldReduction(productSalesOrders, MALL_STORE_ID),
    );
  });

  it('keeps inventory current-state transactional, idempotent, isolated, and snapshot-based', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientProductId: 'inv-cake',
        name: 'Inventory Cake',
        unitType: 'PIECE',
        price: 20,
        costPrice: 10,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientProductId: 'inv-beans',
        name: 'Inventory Beans',
        unitType: 'KG',
        price: 30,
        costPrice: 15,
      })
      .expect(201);

    const getStock = async (storeId: string) => {
      const response = await request(app.getHttpServer())
        .get(`/api/inventory-stock?storeId=${storeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      return response.body as Array<{
        productClientId: string;
        remainingQty: number;
        previousRemainingQty: number;
        loggedToday: number;
      }>;
    };
    const findStock = async (storeId: string, productClientId: string) =>
      (await getStock(storeId)).find(
        (item) => item.productClientId === productClientId,
      );

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 0, previousRemainingQty: 0 }),
    );

    const purchasePayload = {
      clientPurchaseId: 'inv-purchase-cake-1',
      storeId: MAIN_STORE_ID,
      productName: 'Inventory Cake',
      quantity: 5,
      unitCost: 10,
      totalCost: 50,
      purchaseDate: '2026-08-27',
      syncedAt: '2026-08-27T08:00:00.000Z',
    };
    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(purchasePayload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(purchasePayload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...purchasePayload,
        clientPurchaseId: 'inv-payment-cake-1',
        purchaseKind: 'PAYMENT',
        quantity: 100,
        totalCost: 0,
        paymentAmount: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...purchasePayload,
        clientPurchaseId: 'inv-purchase-beans-1',
        productName: 'Inventory Beans',
        quantity: 1.25,
        unitCost: 15,
        totalCost: 18.75,
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 5 }),
    );
    expect(await findStock(MAIN_STORE_ID, 'inv-beans')).toEqual(
      expect.objectContaining({ remainingQty: 1.25 }),
    );

    const orderPayload = {
      clientOrderId: 'inv-order-sale-1',
      storeId: MAIN_STORE_ID,
      cashierName: 'Cashier',
      status: 'COMPLETED',
      paymentMethod: 'CASH',
      subtotal: 40,
      discount: 0,
      tax: 0,
      total: 40,
      orderedAt: '2026-08-27T03:00:00.000Z',
      items: [
        {
          productName: 'Inventory Cake',
          quantity: 2,
          unitPrice: 20,
          lineTotal: 40,
        },
      ],
    };
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(orderPayload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(orderPayload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...orderPayload,
        clientOrderId: 'inv-order-refund-1',
        status: 'REFUNDED',
        subtotal: 20,
        total: 20,
        items: [
          {
            productName: 'Inventory Cake',
            quantity: 1,
            unitPrice: 20,
            lineTotal: 20,
          },
        ],
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 4 }),
    );

    const destructionPayload = {
      clientDestructionId: 'inv-destruction-1',
      storeId: MAIN_STORE_ID,
      productClientId: 'inv-cake',
      quantity: 0.5,
      destroyedAt: '2026-08-27T03:30:00.000Z',
      syncedAt: '2026-08-27T03:30:00.000Z',
    };
    await request(app.getHttpServer())
      .post('/api/inventory-destructions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(destructionPayload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/inventory-destructions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(destructionPayload)
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 3.5 }),
    );

    await request(app.getHttpServer())
      .post('/api/inventory-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientAdjustmentId: 'inv-adjustment-1',
        storeId: MAIN_STORE_ID,
        productClientId: 'inv-cake',
        actualQuantity: 12.75,
        adjustedAt: '2026-08-27T23:00:00.000Z',
        syncedAt: '2026-08-27T23:00:00.000Z',
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 12.75 }),
    );

    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...purchasePayload,
        clientPurchaseId: 'inv-purchase-mall-1',
        storeId: MALL_STORE_ID,
        quantity: 10,
        totalCost: 100,
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 12.75 }),
    );
    expect(await findStock(MALL_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 10 }),
    );

    await request(app.getHttpServer())
      .post('/api/daily-settlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientClosureId: 'inv-settlement-1',
        storeId: MAIN_STORE_ID,
        businessDate: '2026-08-27',
        cashBoxAmount: 100,
        sharesAmount: 10,
        actualRemainingAmount: 120,
        expectedRevenue: 120,
        syncedAt: '2026-08-27T20:00:00.000Z',
      })
      .expect(201);

    const cycleStockBeforeNewPurchases = await request(app.getHttpServer())
      .get('/api/inventory-stock')
      .query({
        storeId: MAIN_STORE_ID,
        cycleStartedAt: '2026-08-27T20:00:00.000Z',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (
        cycleStockBeforeNewPurchases.body as Array<{
          productClientId: string;
          previousRemainingQty: number;
          loggedToday: number;
        }>
      ).find((item) => item.productClientId === 'inv-cake'),
    ).toEqual(
      expect.objectContaining({
        previousRemainingQty: 12.75,
        loggedToday: 0,
      }),
    );

    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...purchasePayload,
        clientPurchaseId: 'inv-purchase-cake-after-settlement',
        quantity: 0.75,
        totalCost: 7.5,
        purchaseDate: '2026-08-27',
        syncedAt: '2026-08-27T23:01:00.000Z',
      })
      .expect(201);

    const cycleStockAfterNewPurchases = await request(app.getHttpServer())
      .get('/api/inventory-stock')
      .query({
        storeId: MAIN_STORE_ID,
        cycleStartedAt: '2026-08-27T20:00:00.000Z',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (
        cycleStockAfterNewPurchases.body as Array<{
          productClientId: string;
          loggedToday: number;
        }>
      ).find((item) => item.productClientId === 'inv-cake'),
    ).toEqual(expect.objectContaining({ loggedToday: 0.75 }));

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...orderPayload,
        clientOrderId: 'inv-order-refund-after-settlement',
        status: 'REFUNDED',
        orderedAt: '2026-08-27T23:05:00.000Z',
        subtotal: 40,
        total: 40,
        items: [
          {
            productName: 'Inventory Cake',
            quantity: 2,
            unitPrice: 20,
            lineTotal: 40,
          },
        ],
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({
        remainingQty: 15.5,
        previousRemainingQty: 12.75,
      }),
    );

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...orderPayload,
        clientOrderId: 'inv-order-concurrent-1',
        orderedAt: '2026-08-27T23:10:00.000Z',
        total: 20,
        items: [
          {
            productName: 'Inventory Cake',
            quantity: 1,
            unitPrice: 20,
            lineTotal: 20,
          },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...orderPayload,
        clientOrderId: 'inv-order-concurrent-2',
        orderedAt: '2026-08-27T23:11:00.000Z',
        total: 40,
        items: [
          {
            productName: 'Inventory Cake',
            quantity: 2,
            unitPrice: 20,
            lineTotal: 40,
          },
        ],
      })
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 12.5 }),
    );

    await expect(
      inventoryBalancesService.runInTransaction(async (manager) => {
        await inventoryBalancesService.applyPurchaseDelta(manager, {
          storeId: MAIN_STORE_ID,
          productName: 'Inventory Cake',
          quantity: 100,
          purchaseKind: 'SUPPLY',
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 12.5 }),
    );

    await dataSource.getRepository(InventoryBalance).update(
      { storeId: MAIN_STORE_ID, productClientId: 'inv-cake' },
      { quantity: 10 },
    );

    const mismatch = await request(app.getHttpServer())
      .get(`/api/admin/inventory-reconciliation?storeId=${MAIN_STORE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(mismatch.body).toEqual([
      expect.objectContaining({
        productClientId: 'inv-cake',
        calculatedFromHistory: 12.5,
        currentBalance: 10,
        difference: -2.5,
      }),
    ]);

    await request(app.getHttpServer())
      .post(`/api/admin/inventory-reconciliation/${MAIN_STORE_ID}/repair`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(await findStock(MAIN_STORE_ID, 'inv-cake')).toEqual(
      expect.objectContaining({ remainingQty: 12.5 }),
    );

    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientProductId: 'inv-closing-snapshot',
        name: 'Inventory Closing Snapshot',
        unitType: 'PIECE',
        price: 12,
        costPrice: 6,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/inventory-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientAdjustmentId: 'inv-closing-snapshot-adjustment',
        storeId: MALL_STORE_ID,
        productClientId: 'inv-closing-snapshot',
        actualQuantity: 5,
        adjustedAt: '2026-08-28T18:00:00.000Z',
        syncedAt: '2026-08-28T18:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/daily-settlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientClosureId: 'inv-closing-snapshot-settlement',
        storeId: MALL_STORE_ID,
        businessDate: '2026-08-28',
        cashBoxAmount: 0,
        sharesAmount: 0,
        actualRemainingAmount: 0,
        expectedRevenue: 0,
        syncedAt: '2026-08-28T20:00:00.000Z',
        inventorySnapshots: [
          {
            productClientId: 'inv-closing-snapshot',
            quantity: 2.5,
          },
        ],
      })
      .expect(201);

    expect(await findStock(MALL_STORE_ID, 'inv-closing-snapshot')).toEqual(
      expect.objectContaining({
        remainingQty: 5,
        previousRemainingQty: 2.5,
      }),
    );
  });

  it('GET /api/orders should enforce store scope for cashier', async () => {
    await request(app.getHttpServer())
      .get(`/api/orders?storeId=${MALL_STORE_ID}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(403);
  });

  it('GET /api/orders should allow cashier assigned store', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/orders?storeId=${MAIN_STORE_ID}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('POST /api/expenses should allow admin write access for a selected store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientExpenseId: 'exp-admin-1',
        storeId: MAIN_STORE_ID,
        expenseDate: '2026-05-15',
        category: 'RAW_MATERIALS',
        description: 'Admin-managed expense',
        amount: 10,
        syncedAt: new Date().toISOString(),
      })
      .expect(201);

    adminCreatedExpenseId = response.body.clientExpenseId as string;
    expect(response.body.storeId).toBe(MAIN_STORE_ID);
  });

  it('POST /api/expenses should enforce cashier store scope', async () => {
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        clientExpenseId: 'exp-wrong-store-1',
        storeId: MALL_STORE_ID,
        expenseDate: '2026-05-15',
        category: 'UTILITIES',
        description: 'Wrong store should fail',
        amount: 20,
        syncedAt: new Date().toISOString(),
      })
      .expect(403);
  });

  it('POST /api/expenses should allow cashier create for assigned store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        clientExpenseId: 'exp-main-1',
        storeId: MAIN_STORE_ID,
        expenseDate: '2026-05-15',
        category: 'RAW_MATERIALS',
        description: 'French butter shipment',
        amount: 842,
        note: 'Critical ingredient',
        syncedAt: new Date().toISOString(),
      })
      .expect(201);

    createdExpenseId = response.body.clientExpenseId as string;
    expect(response.body.storeId).toBe(MAIN_STORE_ID);
    expect(response.body.category).toBe('RAW_MATERIALS');
  });

  it('GET /api/expenses should enforce cashier store scope on query', async () => {
    await request(app.getHttpServer())
      .get(`/api/expenses?storeId=${MALL_STORE_ID}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(403);
  });

  it('GET /api/expenses should support admin read + category/date filters', async () => {
    const allResponse = await request(app.getHttpServer())
      .get('/api/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(allResponse.body)).toBe(true);
    expect(allResponse.body.some((item: { clientExpenseId: string }) => item.clientExpenseId === createdExpenseId)).toBe(true);

    const filteredResponse = await request(app.getHttpServer())
      .get('/api/expenses')
      .query({
        storeId: MAIN_STORE_ID,
        category: 'RAW_MATERIALS',
        from: '2026-05-01',
        to: '2026-05-31',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      filteredResponse.body.some(
        (item: { clientExpenseId: string }) => item.clientExpenseId === createdExpenseId,
      ),
    ).toBe(true);
  });

  it('PATCH /api/expenses should allow admin write access', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 900 })
      .expect(200);

    expect(response.body.amount).toBe(900);
  });

  it('PATCH /api/expenses should allow cashier update', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        amount: 900,
        description: 'Updated butter shipment',
        syncedAt: new Date().toISOString(),
      })
      .expect(200);

    expect(response.body.amount).toBe(900);
    expect(response.body.description).toBe('Updated butter shipment');
  });

  it('DELETE /api/expenses should hard-delete record for cashier', async () => {
    await request(app.getHttpServer())
      .delete(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/expenses')
      .query({ storeId: MAIN_STORE_ID })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      response.body.some(
        (item: { clientExpenseId: string }) => item.clientExpenseId === createdExpenseId,
      ),
    ).toBe(false);
  });

  it('DELETE /api/expenses should allow admin write access', async () => {
    await request(app.getHttpServer())
      .delete(`/api/expenses/${adminCreatedExpenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('POST /api/purchases should allow admin write access for a selected store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientPurchaseId: 'pur-admin-1',
        storeId: MAIN_STORE_ID,
        productName: 'Macaron Box',
        quantity: 10,
        unitCost: 5,
        totalCost: 50,
        purchaseDate: '2026-05-15',
        syncedAt: new Date().toISOString(),
      })
      .expect(201);

    adminCreatedPurchaseId = response.body.clientPurchaseId as string;
    expect(response.body.storeId).toBe(MAIN_STORE_ID);
  });

  it('POST /api/purchases should enforce cashier store scope', async () => {
    await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        clientPurchaseId: 'pur-wrong-store-1',
        storeId: MALL_STORE_ID,
        productName: 'Wrong Store Product',
        quantity: 5,
        unitCost: 5,
        totalCost: 25,
        purchaseDate: '2026-05-15',
        syncedAt: new Date().toISOString(),
      })
      .expect(403);
  });

  it('POST /api/purchases should allow cashier create for assigned store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/purchases')
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        clientPurchaseId: 'pur-main-1',
        storeId: MAIN_STORE_ID,
        productName: 'Premium Pistachio Cream',
        quantity: 12,
        unitCost: 10.5,
        totalCost: 126,
        purchaseDate: '2026-05-15',
        note: 'Weekly supply',
        syncedAt: new Date().toISOString(),
      })
      .expect(201);

    createdPurchaseId = response.body.clientPurchaseId as string;
    expect(response.body.storeId).toBe(MAIN_STORE_ID);
    expect(response.body.productName).toBe('Premium Pistachio Cream');
  });

  it('GET /api/purchases should enforce cashier store scope on query', async () => {
    await request(app.getHttpServer())
      .get(`/api/purchases?storeId=${MALL_STORE_ID}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(403);
  });

  it('GET /api/purchases should support admin read + product/date filters', async () => {
    const allResponse = await request(app.getHttpServer())
      .get('/api/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(allResponse.body)).toBe(true);
    expect(
      allResponse.body.some(
        (item: { clientPurchaseId: string }) => item.clientPurchaseId === createdPurchaseId,
      ),
    ).toBe(true);

    const filteredResponse = await request(app.getHttpServer())
      .get('/api/purchases')
      .query({
        storeId: MAIN_STORE_ID,
        product: 'Pistachio',
        from: '2026-05-01',
        to: '2026-05-31',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      filteredResponse.body.some(
        (item: { clientPurchaseId: string }) => item.clientPurchaseId === createdPurchaseId,
      ),
    ).toBe(true);
  });

  it('PATCH /api/purchases should allow admin write access', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/purchases/${createdPurchaseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ totalCost: 140 })
      .expect(200);

    expect(response.body.totalCost).toBe(140);
  });

  it('PATCH /api/purchases should allow cashier update', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/purchases/${createdPurchaseId}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .send({
        quantity: 14,
        unitCost: 10,
        totalCost: 140,
        syncedAt: new Date().toISOString(),
      })
      .expect(200);

    expect(response.body.quantity).toBe(14);
    expect(response.body.totalCost).toBe(140);
  });

  it('DELETE /api/purchases should hard-delete record for cashier', async () => {
    await request(app.getHttpServer())
      .delete(`/api/purchases/${createdPurchaseId}`)
      .set('Authorization', `Bearer ${cashierMainToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/purchases')
      .query({ storeId: MAIN_STORE_ID })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      response.body.some(
        (item: { clientPurchaseId: string }) => item.clientPurchaseId === createdPurchaseId,
      ),
    ).toBe(false);
  });

  it('DELETE /api/purchases should allow admin write access', async () => {
    await request(app.getHttpServer())
      .delete(`/api/purchases/${adminCreatedPurchaseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();

    if (existsSync(e2eDbPath)) {
      await unlink(e2eDbPath);
    }
  });
});
