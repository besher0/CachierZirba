import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { StoresService } from '../stores/stores.service';
import { InventoryDestruction } from './entities/inventory-destruction.entity';
import { InventoryDestructionsService } from './inventory-destructions.service';

describe('InventoryDestructionsService', () => {
  let service: InventoryDestructionsService;
  let repository: jest.Mocked<Partial<Repository<InventoryDestruction>>>;
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
    clientDestructionId: 'destroy-1',
    storeId: '11111111-1111-4111-8111-111111111111',
    productClientId: 'product-1',
    quantity: 2.5,
    note: 'Damaged in transit',
    destroyedAt: '2026-06-14T10:00:00.000Z',
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
        InventoryDestructionsService,
        {
          provide: getRepositoryToken(InventoryDestruction),
          useValue: repository,
        },
        { provide: StoresService, useValue: storesService },
      ],
    }).compile();

    service = module.get(InventoryDestructionsService);
  });

  it('allows a cashier to create destruction for the assigned store', async () => {
    const created = {
      ...payload,
      destroyedAt: new Date(payload.destroyedAt),
      syncedAt: new Date(payload.syncedAt),
    } as InventoryDestruction;
    const saved = { ...created, id: 'server-id' } as InventoryDestruction;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.create(payload, cashierUser)).resolves.toBe(saved);
    expect(storesService.findById).toHaveBeenCalledWith(payload.storeId);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: cashierUser.storeId,
        productClientId: payload.productClientId,
        quantity: 2.5,
      }),
    );
  });

  it('rejects cashier destruction for another store', async () => {
    await expect(
      service.create(
        {
          ...payload,
          storeId: '22222222-2222-4222-8222-222222222222',
        },
        cashierUser,
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(storesService.findById).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns an existing destruction for an idempotent admin request', async () => {
    const existing = {
      ...payload,
      id: 'server-id',
      destroyedAt: new Date(payload.destroyedAt),
      syncedAt: new Date(payload.syncedAt),
    } as InventoryDestruction;
    repository.findOne?.mockResolvedValue(existing);

    await expect(service.create(payload, adminUser)).resolves.toBe(existing);
    expect(storesService.findById).toHaveBeenCalledWith(payload.storeId);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates a destruction record with its optional note', async () => {
    const created = {
      ...payload,
      destroyedAt: new Date(payload.destroyedAt),
      syncedAt: new Date(payload.syncedAt),
    } as InventoryDestruction;
    const saved = { ...created, id: 'server-id' } as InventoryDestruction;
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
        quantity: 2.5,
        note: payload.note,
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(created);
  });
});
