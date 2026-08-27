import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { AdminService, AdminDashboardResponse } from './admin.service';

type QueryBuilderMock = {
  select: jest.Mock;
  addSelect: jest.Mock;
  setParameters: jest.Mock;
  groupBy: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getRawMany: jest.Mock;
  getRawOne: jest.Mock;
  getMany: jest.Mock;
};

function createQueryBuilderMock(result: {
  rawMany?: unknown[];
  rawOne?: unknown;
  many?: unknown[];
}): QueryBuilderMock {
  const qb = {
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    groupBy: jest.fn(),
    andWhere: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(result.rawMany ?? []),
    getRawOne: jest.fn().mockResolvedValue(result.rawOne),
    getMany: jest.fn().mockResolvedValue(result.many ?? []),
  } as QueryBuilderMock;

  Object.entries(qb).forEach(([key, value]) => {
    if (
      typeof value === 'function' &&
      !['getRawMany', 'getRawOne', 'getMany'].includes(key)
    ) {
      value.mockReturnValue(qb);
    }
  });

  return qb;
}

function oldDashboardTotalsFromRows(): AdminDashboardResponse {
  const stores = [
    { id: 'store-1', name: 'A' },
    { id: 'store-2', name: 'B' },
  ];
  const orders = [
    { storeId: 'store-1', status: OrderStatus.COMPLETED, total: 100 },
    { storeId: 'store-1', status: OrderStatus.REFUNDED, total: 20 },
    { storeId: 'store-1', status: OrderStatus.PENDING, total: 50 },
    { storeId: 'store-2', status: OrderStatus.COMPLETED, total: 200 },
  ];
  const periodSettlements = [
    {
      storeId: 'store-1',
      cashBoxAmount: 80,
      sharesAmount: 10,
      expectedRevenue: 70,
      actualRemainingAmount: 85,
    },
    {
      storeId: 'store-1',
      cashBoxAmount: 50,
      sharesAmount: 5,
      expectedRevenue: 40,
      actualRemainingAmount: 40,
    },
    {
      storeId: 'store-2',
      cashBoxAmount: 210,
      sharesAmount: 20,
      expectedRevenue: 200,
      actualRemainingAmount: 230,
    },
  ];
  const allTimeCashBoxByStore = new Map([
    ['store-1', 160],
    ['store-2', 400],
  ]);
  const periodCashboxWithdrawalsAmount = 30;
  const allTimeCashboxWithdrawalsAmount = 40;

  const summaries = stores.map((store) => {
    const storeOrders = orders.filter((order) => order.storeId === store.id);
    const storeSettlements = periodSettlements.filter(
      (settlement) => settlement.storeId === store.id,
    );
    const ordersCount = storeOrders.length;
    const completedRevenue = storeOrders
      .filter((order) => order.status === OrderStatus.COMPLETED)
      .reduce((sum, order) => sum + order.total, 0);
    const refundAmount = storeOrders
      .filter((order) => order.status === OrderStatus.REFUNDED)
      .reduce((sum, order) => sum + order.total, 0);
    const sharesAmount = storeSettlements.reduce(
      (sum, settlement) => sum + settlement.sharesAmount,
      0,
    );
    const cashBoxAmount = storeSettlements.reduce(
      (sum, settlement) => sum + settlement.cashBoxAmount,
      0,
    );
    const expectedCarryForwardAmount = storeSettlements.reduce(
      (sum, settlement) =>
        sum +
        Math.max(
          settlement.actualRemainingAmount -
            settlement.cashBoxAmount -
            settlement.sharesAmount,
          0,
        ),
      0,
    );
    const expectedRevenue = storeSettlements.reduce(
      (sum, settlement) => sum + settlement.expectedRevenue,
      0,
    );
    const actualRemainingAmount = storeSettlements.reduce(
      (sum, settlement) => sum + settlement.actualRemainingAmount,
      0,
    );
    const settlementDifferenceAmount = Number(
      (actualRemainingAmount - expectedRevenue).toFixed(2),
    );

    return {
      storeId: store.id,
      storeName: store.name,
      ordersCount,
      completedRevenue,
      refundAmount,
      sharesAmount,
      cashBoxAmount,
      cashBoxWithdrawalsAmount: 0,
      actualCashBoxRemainingAmount: allTimeCashBoxByStore.get(store.id) ?? 0,
      expectedCarryForwardAmount,
      actualRemainingAmount,
      settlementDifferenceAmount,
      netProfit: completedRevenue - refundAmount - sharesAmount,
    };
  });

  return {
    totals: {
      ordersCount: summaries.reduce((sum, item) => sum + item.ordersCount, 0),
      completedRevenue: summaries.reduce(
        (sum, item) => sum + item.completedRevenue,
        0,
      ),
      refundAmount: summaries.reduce((sum, item) => sum + item.refundAmount, 0),
      sharesAmount: summaries.reduce((sum, item) => sum + item.sharesAmount, 0),
      cashBoxAmount: summaries.reduce((sum, item) => sum + item.cashBoxAmount, 0),
      cashBoxWithdrawalsAmount: periodCashboxWithdrawalsAmount,
      actualCashBoxRemainingAmount:
        summaries.reduce(
          (sum, item) => sum + item.actualCashBoxRemainingAmount,
          0,
        ) - allTimeCashboxWithdrawalsAmount,
      expectedCarryForwardAmount: summaries.reduce(
        (sum, item) => sum + item.expectedCarryForwardAmount,
        0,
      ),
      actualRemainingAmount: summaries.reduce(
        (sum, item) => sum + item.actualRemainingAmount,
        0,
      ),
      settlementDifferenceAmount: summaries.reduce(
        (sum, item) => sum + item.settlementDifferenceAmount,
        0,
      ),
      netProfit: summaries.reduce((sum, item) => sum + item.netProfit, 0),
    },
    stores: summaries,
  };
}

describe('AdminService', () => {
  const stores = [
    { id: 'store-1', name: 'A', code: 'A', isActive: true },
    { id: 'store-2', name: 'B', code: 'B', isActive: true },
  ];

  let storeRepository: { find: jest.Mock };
  let orderRepository: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let dailySettlementRepository: { createQueryBuilder: jest.Mock };
  let cashboxWithdrawalRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let storesService: { findById: jest.Mock; setCashCarry: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    storeRepository = {
      find: jest.fn().mockResolvedValue(stores),
    };
    orderRepository = {
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    };
    dailySettlementRepository = {
      createQueryBuilder: jest.fn(),
    };
    cashboxWithdrawalRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'withdrawal-1' })),
      findOneOrFail: jest.fn(async (value) => ({
        id: value.where.id,
        amount: 10,
        store: null,
      })),
      createQueryBuilder: jest.fn(),
    };
    storesService = {
      findById: jest.fn().mockResolvedValue({
        id: 'store-1',
        name: 'A',
        code: 'A',
        isActive: true,
      }),
      setCashCarry: jest.fn(),
    };
    service = new AdminService(
      storeRepository as never,
      orderRepository as never,
      dailySettlementRepository as never,
      cashboxWithdrawalRepository as never,
      storesService as never,
    );
  });

  it('keeps dashboard financial values equal to the previous row-reduction logic', async () => {
    const orderQb = createQueryBuilderMock({
      rawMany: [
        {
          storeId: 'store-1',
          ordersCount: '3',
          completedRevenue: '100',
          refundAmount: '20',
        },
        {
          storeId: 'store-2',
          ordersCount: '1',
          completedRevenue: '200',
          refundAmount: '0',
        },
      ],
    });
    const settlementQb = createQueryBuilderMock({
      rawMany: [
        {
          storeId: 'store-1',
          cashBoxAmount: '130',
          sharesAmount: '15',
          expectedRevenue: '110',
          expectedCarryForwardAmount: '0',
          actualRemainingAmount: '125',
          allTimeCashBoxAmount: '160',
        },
        {
          storeId: 'store-2',
          cashBoxAmount: '210',
          sharesAmount: '20',
          expectedRevenue: '200',
          expectedCarryForwardAmount: '0',
          actualRemainingAmount: '230',
          allTimeCashBoxAmount: '400',
        },
      ],
    });
    const withdrawalQb = createQueryBuilderMock({
      rawOne: {
        cashBoxWithdrawalsAmount: '30',
        allTimeCashBoxWithdrawalsAmount: '40',
      },
    });
    orderRepository.createQueryBuilder.mockReturnValue(orderQb);
    dailySettlementRepository.createQueryBuilder.mockReturnValue(settlementQb);
    cashboxWithdrawalRepository.createQueryBuilder.mockReturnValue(withdrawalQb);

    await expect(
      service.getDashboard({ from: '2026-06-01', to: '2026-06-30' }),
    ).resolves.toEqual(oldDashboardTotalsFromRows());

    expect(orderQb.getRawMany).toHaveBeenCalledTimes(1);
    expect(settlementQb.getRawMany).toHaveBeenCalledTimes(1);
    expect(withdrawalQb.getRawOne).toHaveBeenCalledTimes(1);
  });

  it('caches dashboard responses by from/to and reuses the cached value briefly', async () => {
    const orderQb = createQueryBuilderMock({ rawMany: [] });
    const settlementQb = createQueryBuilderMock({ rawMany: [] });
    const withdrawalQb = createQueryBuilderMock({
      rawOne: {
        cashBoxWithdrawalsAmount: '0',
        allTimeCashBoxWithdrawalsAmount: '0',
      },
    });
    orderRepository.createQueryBuilder.mockReturnValue(orderQb);
    dailySettlementRepository.createQueryBuilder.mockReturnValue(settlementQb);
    cashboxWithdrawalRepository.createQueryBuilder.mockReturnValue(withdrawalQb);

    await service.getDashboard({ from: '2026-06-01', to: '2026-06-30' });
    await service.getDashboard({ from: '2026-06-01', to: '2026-06-30' });

    expect(storeRepository.find).toHaveBeenCalledTimes(1);
    expect(orderRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(dailySettlementRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(cashboxWithdrawalRepository.createQueryBuilder).toHaveBeenCalledTimes(
      1,
    );

    await service.getDashboard({ from: '2026-07-01', to: '2026-07-31' });

    expect(orderRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(dailySettlementRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(cashboxWithdrawalRepository.createQueryBuilder).toHaveBeenCalledTimes(
      2,
    );
  });

  it('builds store summaries from aggregate rows instead of loading order and settlement rows', async () => {
    const orderQb = createQueryBuilderMock({
      rawOne: {
        storeId: 'store-1',
        ordersCount: '3',
        completedRevenue: '100',
        refundAmount: '20',
      },
    });
    const settlementQb = createQueryBuilderMock({
      rawOne: {
        storeId: 'store-1',
        cashBoxAmount: '130',
        sharesAmount: '15',
        expectedRevenue: '110',
        expectedCarryForwardAmount: '0',
        actualRemainingAmount: '125',
        allTimeCashBoxAmount: '160',
      },
    });
    orderRepository.createQueryBuilder.mockReturnValue(orderQb);
    dailySettlementRepository.createQueryBuilder.mockReturnValue(settlementQb);

    await expect(
      service.getStoreSummary('store-1', {
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ).resolves.toEqual({
      store: {
        id: 'store-1',
        name: 'A',
        code: 'A',
        isActive: true,
      },
      metrics: {
        ordersCount: 3,
        completedRevenue: 100,
        refundAmount: 20,
        sharesAmount: 15,
        cashBoxAmount: 130,
        cashBoxWithdrawalsAmount: 0,
        actualCashBoxRemainingAmount: 160,
        expectedCarryForwardAmount: 0,
        actualRemainingAmount: 125,
        settlementDifferenceAmount: 15,
        netProfit: 65,
      },
    });

    expect(orderQb.getRawOne).toHaveBeenCalledTimes(1);
    expect(settlementQb.getRawOne).toHaveBeenCalledTimes(1);
    expect(orderQb.getMany).not.toHaveBeenCalled();
    expect(settlementQb.getMany).not.toHaveBeenCalled();
  });

  it('aggregates store product sales in SQL without loading raw order rows', async () => {
    const ordersQb = createQueryBuilderMock({ many: [] });
    orderRepository.createQueryBuilder.mockReturnValue(ordersQb);
    orderRepository.query.mockResolvedValue([
      {
        productName: 'sql cake',
        soldQty: '3.25',
        refundedQty: '1.5',
        netQty: '1.75',
        netAmount: '17.49',
      },
      {
        productName: 'SQL Tea',
        soldQty: '1',
        refundedQty: '0',
        netQty: '1',
        netAmount: '4',
      },
    ]);

    await expect(
      service.listStoreProductSales('store-1', {
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    ).resolves.toEqual([
      {
        productName: 'sql cake',
        soldQty: 3.25,
        refundedQty: 1.5,
        netQty: 1.75,
        netAmount: 17.49,
      },
      {
        productName: 'SQL Tea',
        soldQty: 1,
        refundedQty: 0,
        netQty: 1,
        netAmount: 4,
      },
    ]);

    expect(storesService.findById).toHaveBeenCalledWith('store-1');
    expect(orderRepository.query).toHaveBeenCalledTimes(1);
    expect(orderRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(ordersQb.getMany).not.toHaveBeenCalled();
    expect(orderRepository.query.mock.calls[0][0]).toContain(
      'jsonb_array_elements',
    );
    expect(orderRepository.query.mock.calls[0][1]).toEqual([
      'store-1',
      '2026-08-01T00:00:00.000Z',
      '2026-08-31T23:59:59.999Z',
      OrderStatus.REFUNDED,
      OrderStatus.REFUNDED,
      OrderStatus.REFUNDED,
      OrderStatus.REFUNDED,
    ]);
  });

  it('invalidates dashboard cache after cashbox withdrawal writes', async () => {
    orderRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({ rawMany: [] }),
    );
    dailySettlementRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [] }))
      .mockReturnValueOnce(
        createQueryBuilderMock({
          rawMany: [{ storeId: 'store-1', cashBoxAmount: '100' }],
        }),
      )
      .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [] }));
    cashboxWithdrawalRepository.createQueryBuilder
      .mockReturnValueOnce(
        createQueryBuilderMock({
          rawOne: {
            cashBoxWithdrawalsAmount: '0',
            allTimeCashBoxWithdrawalsAmount: '0',
          },
        }),
      )
      .mockReturnValueOnce(
        createQueryBuilderMock({
          rawOne: {
            cashBoxWithdrawalsAmount: '0',
          },
        }),
      )
      .mockReturnValueOnce(
        createQueryBuilderMock({
          rawOne: {
            cashBoxWithdrawalsAmount: '0',
            allTimeCashBoxWithdrawalsAmount: '0',
          },
        }),
      );

    await service.getDashboard({});
    await service.createCashboxWithdrawal(
      { amount: 10, note: 'x' },
      {
        id: 'admin-id',
        username: 'admin',
        displayName: 'Admin',
        role: 'ADMIN',
      } as never,
    );
    await service.getDashboard({});

    expect(cashboxWithdrawalRepository.save).toHaveBeenCalledTimes(1);
    expect(orderRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('rejects cashbox withdrawals above the current available balance', async () => {
    dailySettlementRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        rawMany: [{ storeId: 'store-1', cashBoxAmount: '10' }],
      }),
    );
    cashboxWithdrawalRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        rawOne: {
          cashBoxWithdrawalsAmount: '0',
        },
      }),
    );

    await expect(
      service.createCashboxWithdrawal(
        { amount: 20 },
        {
          id: 'admin-id',
          username: 'admin',
          displayName: 'Admin',
          role: 'ADMIN',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
