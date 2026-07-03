import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { ListOrdersQueryDto } from '../orders/dto/list-orders-query.dto';
import { Store } from '../stores/entities/store.entity';
import { StoresService } from '../stores/stores.service';
import { CreateCashboxWithdrawalDto } from './dto/create-cashbox-withdrawal.dto';
import { CashboxWithdrawal } from './entities/cashbox-withdrawal.entity';

interface OrderAggRow {
  storeId: string;
  ordersCount: string;
  completedRevenue: string;
  refundAmount: string;
}

interface SettlementAggRow {
  storeId: string;
  cashBoxAmount: string;
  sharesAmount: string;
  expectedRevenue: string;
  expectedCarryForwardAmount: string;
  actualRemainingAmount: string;
}

interface CashboxWithdrawalAggRow {
  storeId: string | null;
  cashBoxWithdrawalsAmount: string;
}

export interface StoreDashboardSummary {
  storeId: string;
  storeName: string;
  ordersCount: number;
  completedRevenue: number;
  refundAmount: number;
  sharesAmount: number;
  cashBoxAmount: number;
  cashBoxWithdrawalsAmount: number;
  actualCashBoxRemainingAmount: number;
  expectedCarryForwardAmount: number;
  actualRemainingAmount: number;
  settlementDifferenceAmount: number;
  netProfit: number;
}

export interface AdminDashboardResponse {
  totals: {
    ordersCount: number;
    completedRevenue: number;
    refundAmount: number;
    sharesAmount: number;
    cashBoxAmount: number;
    cashBoxWithdrawalsAmount: number;
    actualCashBoxRemainingAmount: number;
    expectedCarryForwardAmount: number;
    actualRemainingAmount: number;
    settlementDifferenceAmount: number;
    netProfit: number;
  };
  stores: StoreDashboardSummary[];
}

export interface StoreSummaryResponse {
  store: Pick<Store, 'id' | 'name' | 'code' | 'isActive'>;
  metrics: {
    ordersCount: number;
    completedRevenue: number;
    refundAmount: number;
    sharesAmount: number;
    cashBoxAmount: number;
    cashBoxWithdrawalsAmount: number;
    actualCashBoxRemainingAmount: number;
    expectedCarryForwardAmount: number;
    actualRemainingAmount: number;
    settlementDifferenceAmount: number;
    netProfit: number;
  };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(DailySettlement)
    private readonly dailySettlementRepository: Repository<DailySettlement>,
    @InjectRepository(CashboxWithdrawal)
    private readonly cashboxWithdrawalRepository: Repository<CashboxWithdrawal>,
    private readonly storesService: StoresService,
  ) {}

  async getDashboard(query: DateRangeQueryDto): Promise<AdminDashboardResponse> {
    const stores = await this.storeRepository.find({ order: { name: 'ASC' } });

    const orderAggRows = await this.buildOrderAggQuery(query).getRawMany<OrderAggRow>();
    const settlementAggRows = await this
      .buildSettlementAggQuery(query)
      .getRawMany<SettlementAggRow>();
    const withdrawalAggRows = await this
      .buildCashboxWithdrawalAggQuery(query)
      .getRawMany<CashboxWithdrawalAggRow>();
    const allTimeCashBoxRows = await this
      .buildSettlementAggQuery({})
      .getRawMany<SettlementAggRow>();
    const allTimeWithdrawalRows = await this
      .buildCashboxWithdrawalAggQuery({})
      .getRawMany<CashboxWithdrawalAggRow>();

    const orderMap = new Map<string, OrderAggRow>(
      orderAggRows.map((row) => [row.storeId, row]),
    );
    const settlementMap = new Map<string, SettlementAggRow>(
      settlementAggRows.map((row) => [row.storeId, row]),
    );
    const withdrawalMap = new Map<string | null, CashboxWithdrawalAggRow>(
      withdrawalAggRows.map((row) => [row.storeId, row]),
    );
    const allTimeCashBoxMap = new Map<string, SettlementAggRow>(
      allTimeCashBoxRows.map((row) => [row.storeId, row]),
    );
    const allTimeWithdrawalMap = new Map<string | null, CashboxWithdrawalAggRow>(
      allTimeWithdrawalRows.map((row) => [row.storeId, row]),
    );
    const unassignedCashBoxWithdrawalsAmount =
      this.getUnassignedWithdrawalTotal(withdrawalAggRows);
    const unassignedActualCashBoxWithdrawalsAmount =
      this.getUnassignedWithdrawalTotal(allTimeWithdrawalRows);

    const storeSummaries = stores.map((store) => {
      const orderAgg = orderMap.get(store.id);
      const settlementAgg = settlementMap.get(store.id);
      const withdrawalAgg = withdrawalMap.get(store.id);
      const allTimeCashBoxAgg = allTimeCashBoxMap.get(store.id);
      const allTimeWithdrawalAgg = allTimeWithdrawalMap.get(store.id);

      const ordersCount = this.parseNumber(orderAgg?.ordersCount);
      const completedRevenue = this.parseNumber(orderAgg?.completedRevenue);
      const refundAmount = this.parseNumber(orderAgg?.refundAmount);
      const sharesAmount = this.parseNumber(settlementAgg?.sharesAmount);
      const cashBoxAmount = this.parseNumber(settlementAgg?.cashBoxAmount);
      const cashBoxWithdrawalsAmount = this.parseNumber(
        withdrawalAgg?.cashBoxWithdrawalsAmount,
      );
      const actualCashBoxRemainingAmount = this.toMoney(
        this.parseNumber(allTimeCashBoxAgg?.cashBoxAmount) -
          this.parseNumber(allTimeWithdrawalAgg?.cashBoxWithdrawalsAmount),
      );
      const expectedCarryForwardAmount = this.parseNumber(
        settlementAgg?.expectedCarryForwardAmount,
      );
      const actualRemainingAmount = this.parseNumber(settlementAgg?.actualRemainingAmount);
      const expectedRevenue = this.parseNumber(settlementAgg?.expectedRevenue);
      const settlementDifferenceAmount = Number(
        (actualRemainingAmount - expectedRevenue).toFixed(2),
      );
      const netProfit = completedRevenue - refundAmount - sharesAmount;

      return {
        storeId: store.id,
        storeName: store.name,
        ordersCount,
        completedRevenue,
        refundAmount,
        sharesAmount,
        cashBoxAmount,
        cashBoxWithdrawalsAmount,
        actualCashBoxRemainingAmount,
        expectedCarryForwardAmount,
        actualRemainingAmount,
        settlementDifferenceAmount,
        netProfit,
      } satisfies StoreDashboardSummary;
    });

    return {
      totals: {
        ordersCount: storeSummaries.reduce((sum, item) => sum + item.ordersCount, 0),
        completedRevenue: storeSummaries.reduce(
          (sum, item) => sum + item.completedRevenue,
          0,
        ),
        refundAmount: storeSummaries.reduce((sum, item) => sum + item.refundAmount, 0),
        sharesAmount: storeSummaries.reduce((sum, item) => sum + item.sharesAmount, 0),
        cashBoxAmount: storeSummaries.reduce((sum, item) => sum + item.cashBoxAmount, 0),
        cashBoxWithdrawalsAmount: this.toMoney(
          storeSummaries.reduce(
            (sum, item) => sum + item.cashBoxWithdrawalsAmount,
            0,
          ) + unassignedCashBoxWithdrawalsAmount,
        ),
        actualCashBoxRemainingAmount: this.toMoney(
          storeSummaries.reduce(
            (sum, item) => sum + item.actualCashBoxRemainingAmount,
            0,
          ) - unassignedActualCashBoxWithdrawalsAmount,
        ),
        expectedCarryForwardAmount: storeSummaries.reduce(
          (sum, item) => sum + item.expectedCarryForwardAmount,
          0,
        ),
        actualRemainingAmount: storeSummaries.reduce(
          (sum, item) => sum + item.actualRemainingAmount,
          0,
        ),
        settlementDifferenceAmount: storeSummaries.reduce(
          (sum, item) => sum + item.settlementDifferenceAmount,
          0,
        ),
        netProfit: storeSummaries.reduce((sum, item) => sum + item.netProfit, 0),
      },
      stores: storeSummaries,
    };
  }

  async getStoreSummary(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<StoreSummaryResponse> {
    const store = await this.storesService.findById(storeId);
    const orders = await this.listStoreOrders(storeId, query);
    const settlements = await this.listStoreDailySettlements(storeId, query);
    const cashBoxWithdrawalsAmount = await this.getStoreWithdrawalTotal(
      storeId,
      query,
    );
    const actualCashBoxRemainingAmount =
      await this.getStoreActualCashBoxRemainingAmount(storeId);

    const ordersCount = orders.length;
    const completedRevenue = orders
      .filter((item) => item.status === OrderStatus.COMPLETED)
      .reduce((sum, item) => sum + item.total, 0);
    const refundAmount = orders
      .filter((item) => item.status === OrderStatus.REFUNDED)
      .reduce((sum, item) => sum + item.total, 0);
    const sharesAmount = settlements.reduce((sum, item) => sum + item.sharesAmount, 0);
    const cashBoxAmount = settlements.reduce((sum, item) => sum + item.cashBoxAmount, 0);
    const expectedCarryForwardAmount = settlements.reduce((sum, item) => {
      const expectedCarryForward = Math.max(
        item.actualRemainingAmount - item.cashBoxAmount - item.sharesAmount,
        0,
      );
      return sum + expectedCarryForward;
    }, 0);
    const expectedRevenue = settlements.reduce((sum, item) => sum + item.expectedRevenue, 0);
    const actualRemainingAmount = settlements.reduce(
      (sum, item) => sum + item.actualRemainingAmount,
      0,
    );
    const settlementDifferenceAmount = Number(
      (actualRemainingAmount - expectedRevenue).toFixed(2),
    );

    return {
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        isActive: store.isActive,
      },
      metrics: {
        ordersCount,
        completedRevenue,
        refundAmount,
        sharesAmount,
        cashBoxAmount,
        cashBoxWithdrawalsAmount,
        actualCashBoxRemainingAmount,
        expectedCarryForwardAmount,
        actualRemainingAmount,
        settlementDifferenceAmount,
        netProfit: completedRevenue - refundAmount - sharesAmount,
      },
    };
  }

  async listStoreOrders(storeId: string, query: ListOrdersQueryDto): Promise<Order[]> {
    await this.storesService.findById(storeId);

    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.store', 'store')
      .where('o.storeId = :storeId', { storeId })
      .orderBy('o.orderedAt', 'DESC');

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    const fromValue = this.toOrderFromBoundary(query.from);
    if (fromValue) {
      qb.andWhere('o.orderedAt >= :from', { from: fromValue });
    }

    const toValue = this.toOrderToBoundary(query.to);
    if (toValue) {
      qb.andWhere('o.orderedAt <= :to', { to: toValue });
    }

    if (query.offset !== undefined) {
      qb.skip(query.offset);
    }

    if (query.limit !== undefined) {
      qb.take(query.limit);
    }

    return qb.getMany();
  }

  async listStoreDailySettlements(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<DailySettlement[]> {
    await this.storesService.findById(storeId);

    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.store', 'store')
      .where('s.storeId = :storeId', { storeId })
      .orderBy('s.businessDate', 'DESC');

    const fromDate = this.toDateOnly(query.from);
    if (fromDate) {
      qb.andWhere('s.businessDate >= :fromDate', { fromDate });
    }

    const toDate = this.toDateOnly(query.to);
    if (toDate) {
      qb.andWhere('s.businessDate <= :toDate', { toDate });
    }

    return qb.getMany();
  }

  async createCashboxWithdrawal(
    dto: CreateCashboxWithdrawalDto,
    authUser: AuthUser,
  ): Promise<CashboxWithdrawal> {
    const targetStoreId = dto.storeId?.trim() || null;
    if (targetStoreId) {
      await this.storesService.findById(targetStoreId);
    }

    const amount = this.toMoney(dto.amount);
    const availableAmount = targetStoreId
      ? await this.getStoreActualCashBoxRemainingAmount(targetStoreId)
      : await this.getTotalActualCashBoxRemainingAmount();

    if (amount > availableAmount) {
      throw new BadRequestException(
        'Withdrawal amount exceeds the available cashbox balance.',
      );
    }

    const withdrawal = this.cashboxWithdrawalRepository.create({
      storeId: targetStoreId,
      amount,
      note: dto.note?.trim() || null,
      withdrawnAt: dto.withdrawnAt ? new Date(dto.withdrawnAt) : new Date(),
      createdByUserId: authUser.id,
      createdByDisplayName: authUser.displayName,
    });

    const saved = await this.cashboxWithdrawalRepository.save(withdrawal);
    return this.cashboxWithdrawalRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { store: true },
    });
  }

  private buildOrderAggQuery(query: DateRangeQueryDto) {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .select('o.storeId', 'storeId')
      .addSelect('COUNT(o.id)', 'ordersCount')
      .addSelect(
        'SUM(CASE WHEN o.status = :completedStatus THEN o.total ELSE 0 END)',
        'completedRevenue',
      )
      .addSelect(
        'SUM(CASE WHEN o.status = :refundedStatus THEN o.total ELSE 0 END)',
        'refundAmount',
      )
      .setParameters({
        completedStatus: OrderStatus.COMPLETED,
        refundedStatus: OrderStatus.REFUNDED,
      })
      .groupBy('o.storeId');

    const fromValue = this.toOrderFromBoundary(query.from);
    if (fromValue) {
      qb.andWhere('o.orderedAt >= :from', { from: fromValue });
    }

    const toValue = this.toOrderToBoundary(query.to);
    if (toValue) {
      qb.andWhere('o.orderedAt <= :to', { to: toValue });
    }

    return qb;
  }

  private buildSettlementAggQuery(query: DateRangeQueryDto) {
    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .select('s.storeId', 'storeId')
      .addSelect('SUM(s.cashBoxAmount)', 'cashBoxAmount')
      .addSelect('SUM(s.sharesAmount)', 'sharesAmount')
      .addSelect('SUM(s.expectedRevenue)', 'expectedRevenue')
      .addSelect(
        'SUM(CASE WHEN (s.actualRemainingAmount - s.cashBoxAmount - s.sharesAmount) > 0 THEN (s.actualRemainingAmount - s.cashBoxAmount - s.sharesAmount) ELSE 0 END)',
        'expectedCarryForwardAmount',
      )
      .addSelect('SUM(s.actualRemainingAmount)', 'actualRemainingAmount')
      .groupBy('s.storeId');

    const fromDate = this.toDateOnly(query.from);
    if (fromDate) {
      qb.andWhere('s.businessDate >= :fromDate', { fromDate });
    }

    const toDate = this.toDateOnly(query.to);
    if (toDate) {
      qb.andWhere('s.businessDate <= :toDate', { toDate });
    }

    return qb;
  }

  private buildCashboxWithdrawalAggQuery(query: DateRangeQueryDto) {
    const qb = this.cashboxWithdrawalRepository
      .createQueryBuilder('w')
      .select('w.storeId', 'storeId')
      .addSelect('SUM(w.amount)', 'cashBoxWithdrawalsAmount')
      .groupBy('w.storeId');

    const fromValue = this.toOrderFromBoundary(query.from);
    if (fromValue) {
      qb.andWhere('w.withdrawnAt >= :from', { from: fromValue });
    }

    const toValue = this.toOrderToBoundary(query.to);
    if (toValue) {
      qb.andWhere('w.withdrawnAt <= :to', { to: toValue });
    }

    return qb;
  }

  private async getStoreWithdrawalTotal(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<number> {
    const row = await this.buildCashboxWithdrawalAggQuery(query)
      .andWhere('w.storeId = :storeId', { storeId })
      .getRawOne<CashboxWithdrawalAggRow>();
    return this.parseNumber(row?.cashBoxWithdrawalsAmount);
  }

  private async getStoreActualCashBoxRemainingAmount(
    storeId: string,
  ): Promise<number> {
    const cashBoxRow = await this.buildSettlementAggQuery({})
      .andWhere('s.storeId = :storeId', { storeId })
      .getRawOne<SettlementAggRow>();
    const withdrawalRow = await this.buildCashboxWithdrawalAggQuery({})
      .andWhere('w.storeId = :storeId', { storeId })
      .getRawOne<CashboxWithdrawalAggRow>();

    return this.toMoney(
      this.parseNumber(cashBoxRow?.cashBoxAmount) -
        this.parseNumber(withdrawalRow?.cashBoxWithdrawalsAmount),
    );
  }

  private async getTotalActualCashBoxRemainingAmount(): Promise<number> {
    const cashBoxRows = await this
      .buildSettlementAggQuery({})
      .getRawMany<SettlementAggRow>();
    const withdrawalRows = await this
      .buildCashboxWithdrawalAggQuery({})
      .getRawMany<CashboxWithdrawalAggRow>();

    return this.toMoney(
      cashBoxRows.reduce(
        (sum, row) => sum + this.parseNumber(row.cashBoxAmount),
        0,
      ) -
        withdrawalRows.reduce(
          (sum, row) =>
            sum + this.parseNumber(row.cashBoxWithdrawalsAmount),
          0,
        ),
    );
  }

  private getUnassignedWithdrawalTotal(
    rows: CashboxWithdrawalAggRow[],
  ): number {
    return rows
      .filter((row) => !row.storeId)
      .reduce(
        (sum, row) => sum + this.parseNumber(row.cashBoxWithdrawalsAmount),
        0,
      );
  }

  private parseNumber(value: string | number | undefined): number {
    if (value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private normalizeDateInput(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toDateOnly(value: string | undefined): string | undefined {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return undefined;
    }

    return normalized.slice(0, 10);
  }

  private toOrderFromBoundary(value: string | undefined): string | undefined {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return undefined;
    }

    if (normalized.length === 10) {
      return `${normalized}T00:00:00.000Z`;
    }

    return normalized;
  }

  private toOrderToBoundary(value: string | undefined): string | undefined {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return undefined;
    }

    if (normalized.length === 10) {
      return `${normalized}T23:59:59.999Z`;
    }

    return normalized;
  }
}
