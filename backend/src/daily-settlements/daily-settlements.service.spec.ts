import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { EmployeeWithdrawal } from '../employees/entities/employee-withdrawal.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from '../orders/entities/order.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresService } from '../stores/stores.service';
import { DailySettlementsService } from './daily-settlements.service';
import { DailySettlement } from './entities/daily-settlement.entity';

describe('DailySettlementsService', () => {
  let service: DailySettlementsService;
  let repository: jest.Mocked<Partial<Repository<DailySettlement>>>;
  let orderRepository: { createQueryBuilder: jest.Mock };
  let expenseRepository: { createQueryBuilder: jest.Mock };
  let purchaseRepository: { createQueryBuilder: jest.Mock };
  let employeeWithdrawalRepository: { createQueryBuilder: jest.Mock };
  let storesService: { findById: jest.Mock; setCashCarry: jest.Mock };

  const storeId = '11111111-1111-4111-8111-111111111111';
  const cashierUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId,
  };
  const payload = {
    clientClosureId: 'close-1',
    storeId,
    businessDate: '2026-06-14',
    cashBoxAmount: 100,
    sharesAmount: 50,
    actualRemainingAmount: 180,
    expectedRevenue: 175,
    carryInAmount: 20,
    syncedAt: '2026-06-14T20:00:00.000Z',
  };

  beforeEach(async () => {
    const createQueryBuilder = (
      rawRow: Record<string, number> = { total: 0 },
    ) => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(rawRow),
      };
      return qb;
    };
    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    orderRepository = {
      createQueryBuilder: jest.fn(() =>
        createQueryBuilder({ salesAmount: 0, refundAmount: 0 }),
      ),
    };
    expenseRepository = {
      createQueryBuilder: jest.fn(() => createQueryBuilder()),
    };
    purchaseRepository = {
      createQueryBuilder: jest.fn(() =>
        createQueryBuilder({ purchasesAmount: 0, tawasiAmount: 0 }),
      ),
    };
    employeeWithdrawalRepository = {
      createQueryBuilder: jest.fn(() => createQueryBuilder()),
    };
    storesService = {
      findById: jest.fn(),
      setCashCarry: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DailySettlementsService,
        {
          provide: getRepositoryToken(DailySettlement),
          useValue: repository,
        },
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Expense), useValue: expenseRepository },
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepository },
        {
          provide: getRepositoryToken(EmployeeWithdrawal),
          useValue: employeeWithdrawalRepository,
        },
        { provide: StoresService, useValue: storesService },
      ],
    }).compile();

    service = module.get(DailySettlementsService);
  });

  it('returns an existing settlement for an idempotent client closure id', async () => {
    const existing = {
      ...payload,
      id: 'server-id',
      syncedAt: new Date(payload.syncedAt),
    } as DailySettlement;
    repository.findOne?.mockResolvedValueOnce(existing);

    await expect(service.createOrUpdate(payload, cashierUser)).resolves.toBe(
      existing,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(storesService.setCashCarry).not.toHaveBeenCalled();
  });

  it('rejects a different settlement for an already-settled store date', async () => {
    const existing = {
      ...payload,
      clientClosureId: 'close-existing',
      id: 'server-id',
      syncedAt: new Date(payload.syncedAt),
    } as DailySettlement;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    await expect(
      service.createOrUpdate(payload, cashierUser),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(storesService.setCashCarry).not.toHaveBeenCalled();
  });

  it('creates a new settlement and updates the store carry amount', async () => {
    const created = {
      ...payload,
      note: null,
      syncedAt: new Date(payload.syncedAt),
    } as DailySettlement;
    const saved = { ...created, id: 'server-id' } as DailySettlement;
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(created);
    repository.save?.mockResolvedValue(saved);

    await expect(service.createOrUpdate(payload, cashierUser)).resolves.toBe(
      saved,
    );
    expect(repository.save).toHaveBeenCalledWith(created);
    expect(storesService.setCashCarry).toHaveBeenCalledWith(storeId, 30);
  });
});
