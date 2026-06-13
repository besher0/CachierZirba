import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { InventoryAdjustment } from './entities/inventory-adjustment.entity';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

describe('InventoryAdjustmentsService', () => {
  let service: InventoryAdjustmentsService;
  let repository: jest.Mocked<Partial<Repository<InventoryAdjustment>>>;
  let storesService: { findById: jest.Mock };

  const adminUser: AuthUser = {
    id: 'admin-id',
    username: 'admin',
    displayName: 'Admin',
    role: UserRole.ADMIN,
    storeId: null,
  };
  const cashierUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId: '11111111-1111-4111-8111-111111111111',
  };
  const payload = {
    clientAdjustmentId: 'stock-1',
    storeId: '11111111-1111-4111-8111-111111111111',
    productClientId: 'product-1',
    actualQuantity: 13,
    adjustedAt: '2026-06-14T10:00:00.000Z',
    syncedAt: '2026-06-14T10:00:00.000Z',
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
        InventoryAdjustmentsService,
        {
          provide: getRepositoryToken(InventoryAdjustment),
          useValue: repository,
        },
        { provide: StoresService, useValue: storesService },
      ],
    }).compile();

    service = module.get(InventoryAdjustmentsService);
  });

  it('rejects inventory writes from cashier accounts', async () => {
    await expect(service.create(payload, cashierUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns an existing adjustment for an idempotent admin request', async () => {
    const existing = {
      ...payload,
      id: 'server-id',
      adjustedAt: new Date(payload.adjustedAt),
      syncedAt: new Date(payload.syncedAt),
    } as InventoryAdjustment;
    repository.findOne?.mockResolvedValue(existing);

    await expect(service.create(payload, adminUser)).resolves.toBe(existing);
    expect(storesService.findById).toHaveBeenCalledWith(payload.storeId);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates an inventory adjustment for an admin account', async () => {
    const created = {
      ...payload,
      adjustedAt: new Date(payload.adjustedAt),
      syncedAt: new Date(payload.syncedAt),
    } as InventoryAdjustment;
    const saved = { ...created, id: 'server-id' } as InventoryAdjustment;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.create(payload, adminUser)).resolves.toBe(saved);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: payload.storeId,
        productClientId: payload.productClientId,
        actualQuantity: 13,
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(created);
  });
});
