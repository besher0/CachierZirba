import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { Purchase } from './entities/purchase.entity';
import { PurchasesService } from './purchases.service';

describe('PurchasesService', () => {
  let service: PurchasesService;
  let repository: jest.Mocked<Partial<Repository<Purchase>>>;
  let storesService: { findById: jest.Mock };

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
    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    storesService = { findById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: repository,
        },
        { provide: StoresService, useValue: storesService },
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
  });
});
