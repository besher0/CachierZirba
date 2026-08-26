import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { StoresService } from '../stores/stores.service';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';

type MockQueryBuilder = {
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  andWhere: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const qb = {} as MockQueryBuilder;
  qb.leftJoinAndSelect = jest.fn(() => qb);
  qb.orderBy = jest.fn(() => qb);
  qb.addOrderBy = jest.fn(() => qb);
  qb.andWhere = jest.fn(() => qb);
  qb.skip = jest.fn(() => qb);
  qb.take = jest.fn(() => qb);
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepository: jest.Mocked<Partial<Repository<Expense>>>;
  let settlementRepository: jest.Mocked<Partial<Repository<DailySettlement>>>;
  let storesService: { findById: jest.Mock };
  let queryBuilder: MockQueryBuilder;

  const storeId = '11111111-1111-4111-8111-111111111111';
  const authUser: AuthUser = {
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
    clientExpenseId: 'expense-1',
    storeId,
    expenseDate: '2026-07-16',
    category: 'OTHER',
    description: 'Expense',
    amount: 1000,
    syncedAt: '2026-07-16T15:30:00.000Z',
  };

  beforeEach(async () => {
    queryBuilder = createMockQueryBuilder();
    expenseRepository = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder as never),
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

    await expect(service.create(anchoredPayload, authUser)).resolves.toBe(
      saved,
    );
    expect(settlementRepository.findOne).not.toHaveBeenCalled();
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleStartClosureId: anchoredPayload.cycleStartClosureId,
      }),
    );
  });

  it('applies the default list limit when none is provided', async () => {
    await service.findAll({}, adminUser);

    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(200);
  });

  it('caps the list limit at the maximum value', async () => {
    await service.findAll({ limit: 999 }, adminUser);

    expect(queryBuilder.take).toHaveBeenCalledWith(500);
  });

  it('applies list offset with the requested limit', async () => {
    await service.findAll({ limit: 50, offset: 40 }, adminUser);

    expect(queryBuilder.skip).toHaveBeenCalledWith(40);
    expect(queryBuilder.take).toHaveBeenCalledWith(50);
  });

  it('keeps expense list filters while paginating', async () => {
    await service.findAll(
      {
        storeId,
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-31',
        category: 'OTHER',
        description: 'fuel',
        cycleStartClosureId: 'closure-from-client',
        limit: 25,
        offset: 10,
      },
      adminUser,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.storeId = :storeId', {
      storeId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'e.expenseDate >= :fromDate',
      { fromDate: '2026-07-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'e.expenseDate <= :toDate',
      { toDate: '2026-07-31' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'e.category = :category',
      { category: 'OTHER' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(e.description) LIKE LOWER(:description)',
      { description: '%fuel%' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'e.cycleStartClosureId = :cycleStartClosureId',
      { cycleStartClosureId: 'closure-from-client' },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(25);
  });

  it('keeps the unanchored cycle filter while paginating', async () => {
    await service.findAll({ unanchoredCycle: true }, adminUser);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'e.cycleStartClosureId IS NULL',
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(200);
  });
});
