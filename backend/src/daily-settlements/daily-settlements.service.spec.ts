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

function createAggregateQueryBuilder(rawRow: Record<string, string | number>) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawRow),
  };
}

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
    repository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    orderRepository = {
      createQueryBuilder: jest.fn(() =>
        createAggregateQueryBuilder({ salesAmount: 0, refundAmount: 0 }),
      ),
    };
    expenseRepository = {
      createQueryBuilder: jest.fn(() => createAggregateQueryBuilder({ total: 0 })),
    };
    purchaseRepository = {
      createQueryBuilder: jest.fn(() =>
        createAggregateQueryBuilder({ purchasesAmount: 0, tawasiAmount: 0 }),
      ),
    };
    employeeWithdrawalRepository = {
      createQueryBuilder: jest.fn(() => createAggregateQueryBuilder({ total: 0 })),
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

  it('keeps generated settlement financial snapshots based on the current cycle', async () => {
    const previousSettlement = {
      clientClosureId: 'close-previous',
      syncedAt: new Date('2026-06-13T20:00:00.000Z'),
    } as DailySettlement;
    const orderQb = createAggregateQueryBuilder({
      salesAmount: '1200.50',
      refundAmount: '100.25',
      ordersCount: '6',
    });
    const expenseQb = createAggregateQueryBuilder({
      total: '80.25',
      expensesCount: '3',
    });
    const purchaseQb = createAggregateQueryBuilder({
      purchasesAmount: '350.75',
      tawasiAmount: '70.25',
      purchasesCount: '4',
      paymentsAmount: '25.00',
    });
    const withdrawalQb = createAggregateQueryBuilder({
      total: '45.50',
      withdrawalsCount: '2',
    });
    const saved = {
      ...payload,
      id: 'server-id',
      expectedRevenue: 0,
      salesAmount: 1200.5,
      refundAmount: 100.25,
      expensesAmount: 80.25,
      purchasesAmount: 350.75,
      tawasiAmount: 70.25,
      employeeWithdrawalsAmount: 45.5,
      ordersCount: 6,
      expensesCount: 3,
      purchasesCount: 4,
      withdrawalsCount: 2,
      paymentsAmount: 25,
      syncedAt: new Date(payload.syncedAt),
    } as DailySettlement;

    orderRepository.createQueryBuilder.mockReturnValueOnce(orderQb);
    expenseRepository.createQueryBuilder.mockReturnValueOnce(expenseQb);
    purchaseRepository.createQueryBuilder.mockReturnValueOnce(purchaseQb);
    employeeWithdrawalRepository.createQueryBuilder.mockReturnValueOnce(
      withdrawalQb,
    );
    repository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(previousSettlement)
      .mockResolvedValueOnce(saved);
    repository.create?.mockReturnValue(saved);
    repository.save?.mockResolvedValue(saved);

    await service.createOrUpdate(
      { ...payload, expectedRevenue: undefined },
      cashierUser,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevenue: 0,
        salesAmount: 1200.5,
        refundAmount: 100.25,
        expensesAmount: 80.25,
        purchasesAmount: 350.75,
        tawasiAmount: 70.25,
        employeeWithdrawalsAmount: 45.5,
        ordersCount: 6,
        expensesCount: 3,
        purchasesCount: 4,
        withdrawalsCount: 2,
        paymentsAmount: 25,
      }),
    );
    expect(orderQb.andWhere).toHaveBeenCalledWith(
      'order.orderedAt <= :cycleEndedAt',
      { cycleEndedAt: new Date(payload.syncedAt) },
    );
    expect(orderQb.andWhere).toHaveBeenCalledWith(
      'order.orderedAt > :cycleStartedAt',
      { cycleStartedAt: previousSettlement.syncedAt },
    );
    expect(expenseQb.andWhere).toHaveBeenCalledWith(
      'expense.cycleStartClosureId = :cycleStartClosureId',
      { cycleStartClosureId: previousSettlement.clientClosureId },
    );
    expect(repository.findOne).toHaveBeenNthCalledWith(3, {
      where: { storeId },
      order: { businessDate: 'DESC', syncedAt: 'DESC', createdAt: 'DESC' },
    });
  });

  it('excludes stock-only purchases from generated purchase totals', async () => {
    const purchaseQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        purchasesAmount: 0,
        tawasiAmount: 0,
        purchasesCount: 0,
        paymentsAmount: 0,
      }),
    };
    purchaseRepository.createQueryBuilder.mockReturnValueOnce(purchaseQb);
    const created = {
      ...payload,
      expectedRevenue: undefined,
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

    await service.createOrUpdate(
      { ...payload, expectedRevenue: undefined },
      cashierUser,
    );

    expect(purchaseQb.select).toHaveBeenCalledWith(
      expect.stringContaining("purchase.purchaseKind <> 'STOCK_ONLY'"),
      'purchasesAmount',
    );
    expect(purchaseQb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining("'STOCK_ONLY'"),
      'purchasesCount',
    );
  });
});
