import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

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

describe('Zirba API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken = '';
  let adminUsername = '';
  let cashierMainToken = '';
  let adminCreatedExpenseId = '';
  let adminCreatedPurchaseId = '';
  let createdExpenseId = '';
  let createdPurchaseId = '';
  const e2eDbPath = join(process.cwd(), 'zirba.e2e.db');

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    process.env.SQLITE_DB_PATH = e2eDbPath;
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
