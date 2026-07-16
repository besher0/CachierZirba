import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { StoresService } from '../stores/stores.service';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepository: jest.Mocked<Partial<Repository<Expense>>>;
  let settlementRepository: jest.Mocked<Partial<Repository<DailySettlement>>>;
  let storesService: { findById: jest.Mock };

  const storeId = '11111111-1111-4111-8111-111111111111';
  const authUser: AuthUser = {
    id: 'cashier-id',
    username: 'cashier',
    displayName: 'Cashier',
    role: UserRole.CASHIER,
    storeId,
  };
  const payload = {
    clientExpenseId: 'expense-1',
    storeId,
    expenseDate: '2026-07-16',
    category: 'OTHER',
    description: 'Expense',
    amount: 1000,
    syncedAt: '2026-07-16T15:30:00.000Z',
  };

  beforeEach(async () => {
    expenseRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    settlementRepository = {
      findOne: jest.fn(),
    };
    storesService = {
      findById: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: getRepositoryToken(Expense),
          useValue: expenseRepository,
        },
        {
          provide: getRepositoryToken(DailySettlement),
          useValue: settlementRepository,
        },
        { provide: StoresService, useValue: storesService },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  it('anchors an unassigned expense to the latest settlement', async () => {
    const latestSettlement = {
      clientClosureId: 'closure-previous',
    } as DailySettlement;
    const created = {
      ...payload,
      cycleStartClosureId: latestSettlement.clientClosureId,
    } as unknown as Expense;
    const saved = { ...created, id: 'expense-server-id' } as Expense;

    expenseRepository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    settlementRepository.findOne?.mockResolvedValue(latestSettlement);
    expenseRepository.create?.mockReturnValue(created);
    expenseRepository.save?.mockResolvedValue(saved);

    await expect(service.create(payload, authUser)).resolves.toBe(saved);
    expect(settlementRepository.findOne).toHaveBeenCalledWith({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleStartClosureId: latestSettlement.clientClosureId,
      }),
    );
  });

  it('keeps the cycle anchor supplied by the client', async () => {
    const anchoredPayload = {
      ...payload,
      cycleStartClosureId: 'closure-from-device',
    };
    const created = anchoredPayload as unknown as Expense;
    const saved = { ...created, id: 'expense-server-id' } as Expense;

    expenseRepository.findOne
      ?.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    expenseRepository.create?.mockReturnValue(created);
    expenseRepository.save?.mockResolvedValue(saved);

    await expect(service.create(anchoredPayload, authUser)).resolves.toBe(saved);
    expect(settlementRepository.findOne).not.toHaveBeenCalled();
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleStartClosureId: anchoredPayload.cycleStartClosureId,
      }),
    );
  });
});
