import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  toBusinessDayEndBoundary,
  toBusinessDayStartBoundary,
  toDateOnly,
} from '../common/business-date-boundaries';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import {
  ListPaginationQuery,
  resolveListPagination,
} from '../common/list-pagination';
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
  ordersCount: string | number | null;
  completedRevenue: string | number | null;
  refundAmount: string | number | null;
}

interface SettlementAggRow {
  storeId: string;
  cashBoxAmount: string | number | null;
  sharesAmount: string | number | null;
  expectedRevenue: string | number | null;
  expectedCarryForwardAmount: string | number | null;
  actualRemainingAmount: string | number | null;
  allTimeCashBoxAmount: string | number | null;
}

interface CashboxWithdrawalAggRow {
  cashBoxWithdrawalsAmount: string | number | null;
  allTimeCashBoxWithdrawalsAmount?: string | number | null;
}

interface ProductSalesAggRow {
  productName: string | null;
  soldQty: string | number | null;
  refundedQty: string | number | null;
  netQty: string | number | null;
  netAmount: string | number | null;
}

interface DashboardCacheEntry {
  expiresAt: number;
  response: AdminDashboardResponse;
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

export interface ProductSalesSummaryResponse {
  productName: string;
  soldQty: number;
  refundedQty: number;
  netQty: number;
  netAmount: number;
}

const DASHBOARD_CACHE_TTL_MS = 120000;

@Injectable()
export class AdminService {
  private readonly dashboardCache = new Map<string, DashboardCacheEntry>();

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
    const cacheKey = this.getDashboardCacheKey(query);
    const cached = this.dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return this.cloneDashboardResponse(cached.response);
    }

    const [
      stores,
      orderAggRows,
      settlementAggRows,
      withdrawalAggRows,
    ] = await Promise.all([
      this.storeRepository.find({ order: { name: 'ASC' } }),
      this.buildOrderAggQuery(query).getRawMany<OrderAggRow>(),
      this.buildDashboardSettlementAggQuery(query).getRawMany<SettlementAggRow>(),
      this.getCashboxWithdrawalDashboardTotalsOrEmpty(query),
    ]);

    const orderMap = new Map<string, OrderAggRow>(
      orderAggRows.map((row) => [row.storeId, row]),
    );
    const settlementMap = new Map<string, SettlementAggRow>(
      settlementAggRows.map((row) => [row.storeId, row]),
    );
    const cashBoxWithdrawalsAmount = this.parseNumber(
      withdrawalAggRows?.cashBoxWithdrawalsAmount,
    );
    const allTimeCashBoxWithdrawalsAmount = this.parseNumber(
      withdrawalAggRows?.allTimeCashBoxWithdrawalsAmount,
    );

    const storeSummaries = stores.map((store) => {
      const orderAgg = orderMap.get(store.id);
      const settlementAgg = settlementMap.get(store.id);

      const ordersCount = this.parseNumber(orderAgg?.ordersCount);
      const completedRevenue = this.parseNumber(orderAgg?.completedRevenue);
      const refundAmount = this.parseNumber(orderAgg?.refundAmount);
      const sharesAmount = this.parseNumber(settlementAgg?.sharesAmount);
      const cashBoxAmount = this.parseNumber(settlementAgg?.cashBoxAmount);
      const cashBoxWithdrawalsAmount = 0;
      const actualCashBoxRemainingAmount = this.toMoney(
        this.parseNumber(settlementAgg?.allTimeCashBoxAmount),
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

    const response = {
      totals: {
        ordersCount: storeSummaries.reduce((sum, item) => sum + item.ordersCount, 0),
        completedRevenue: storeSummaries.reduce(
          (sum, item) => sum + item.completedRevenue,
          0,
        ),
        refundAmount: storeSummaries.reduce((sum, item) => sum + item.refundAmount, 0),
        sharesAmount: storeSummaries.reduce((sum, item) => sum + item.sharesAmount, 0),
        cashBoxAmount: storeSummaries.reduce((sum, item) => sum + item.cashBoxAmount, 0),
        cashBoxWithdrawalsAmount,
        actualCashBoxRemainingAmount: this.toMoney(
          storeSummaries.reduce(
            (sum, item) => sum + item.actualCashBoxRemainingAmount,
            0,
          ) - allTimeCashBoxWithdrawalsAmount,
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

    this.dashboardCache.set(cacheKey, {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      response: this.cloneDashboardResponse(response),
    });

    return response;
  }

  async getStoreSummary(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<StoreSummaryResponse> {
    const [store, orderAgg, settlementAgg] = await Promise.all([
      this.storesService.findById(storeId),
      this.buildOrderAggQuery(query, storeId).getRawOne<OrderAggRow>(),
      this.buildDashboardSettlementAggQuery(query, storeId).getRawOne<SettlementAggRow>(),
    ]);
    const cashBoxWithdrawalsAmount = 0;
    const actualCashBoxRemainingAmount = this.toMoney(
      this.parseNumber(settlementAgg?.allTimeCashBoxAmount),
    );

    const ordersCount = this.parseNumber(orderAgg?.ordersCount);
    const completedRevenue = this.parseNumber(orderAgg?.completedRevenue);
    const refundAmount = this.parseNumber(orderAgg?.refundAmount);
    const sharesAmount = this.parseNumber(settlementAgg?.sharesAmount);
    const cashBoxAmount = this.parseNumber(settlementAgg?.cashBoxAmount);
    const expectedCarryForwardAmount = this.parseNumber(
      settlementAgg?.expectedCarryForwardAmount,
    );
    const expectedRevenue = this.parseNumber(settlementAgg?.expectedRevenue);
    const actualRemainingAmount = this.parseNumber(
      settlementAgg?.actualRemainingAmount,
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

  async listStoreOrders(
    storeId: string,
    query: ListOrdersQueryDto,
    options: { paginate?: boolean } = {},
  ): Promise<Order[]> {
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

    if (options.paginate !== false) {
      const { limit, offset } = resolveListPagination(query);
      qb.skip(offset);
      qb.take(limit);
    }

    return qb.getMany();
  }

  async listStoreDailySettlements(
    storeId: string,
    query: DateRangeQueryDto & ListPaginationQuery,
    options: { paginate?: boolean } = {},
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

    if (options.paginate !== false) {
      const { limit, offset } = resolveListPagination(query);
      qb.skip(offset);
      qb.take(limit);
    }

    return qb.getMany();
  }

  async createCashboxWithdrawal(
    dto: CreateCashboxWithdrawalDto,
    authUser: AuthUser,
  ): Promise<CashboxWithdrawal> {
    const amount = this.toMoney(dto.amount);
    const availableAmount = await this.getTotalActualCashBoxRemainingAmount();

    if (amount > availableAmount) {
      throw new BadRequestException(
        'Withdrawal amount exceeds the available cashbox balance.',
      );
    }

    const withdrawal = this.cashboxWithdrawalRepository.create({
      storeId: null,
      amount,
      note: dto.note?.trim() || null,
      withdrawnAt: dto.withdrawnAt ? new Date(dto.withdrawnAt) : new Date(),
      createdByUserId: authUser.id,
      createdByDisplayName: authUser.displayName,
    });

    const saved = await this.cashboxWithdrawalRepository.save(withdrawal);
    this.invalidateDashboardCache();
    return this.cashboxWithdrawalRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { store: true },
    });
  }

  async listCashboxWithdrawals(
    query: DateRangeQueryDto & ListPaginationQuery,
  ): Promise<CashboxWithdrawal[]> {
    const qb = this.cashboxWithdrawalRepository
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.store', 'store')
      .orderBy('w.withdrawnAt', 'DESC');

    const fromValue = this.toOrderFromBoundary(query.from);
    if (fromValue) {
      qb.andWhere('w.withdrawnAt >= :from', { from: fromValue });
    }

    const toValue = this.toOrderToBoundary(query.to);
    if (toValue) {
      qb.andWhere('w.withdrawnAt <= :to', { to: toValue });
    }

    const { limit, offset } = resolveListPagination(query);
    qb.skip(offset);
    qb.take(limit);

    try {
      return await qb.getMany();
    } catch (error: unknown) {
      if (this.isMissingCashboxWithdrawalsTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  async listStoreProductSales(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<ProductSalesSummaryResponse[]> {
    await this.storesService.findById(storeId);

    const rows = await this.queryStoreProductSales(storeId, query);

    return rows
      .map((row) => ({
        productName: row.productName ?? '',
        soldQty: Number(this.parseNumber(row.soldQty).toFixed(3)),
        refundedQty: Number(this.parseNumber(row.refundedQty).toFixed(3)),
        netQty: Number(this.parseNumber(row.netQty).toFixed(3)),
        netAmount: this.toMoney(this.parseNumber(row.netAmount)),
      }))
      .filter((row) => row.productName.length > 0)
      .sort((a, b) => a.productName.localeCompare(b.productName, 'ar'));
  }

  private async queryStoreProductSales(
    storeId: string,
    query: DateRangeQueryDto,
  ): Promise<ProductSalesAggRow[]> {
    const databaseType = this.getOrderDatabaseType();
    const params: unknown[] = [];
    const addParam = (value: unknown): string => {
      params.push(value);
      return databaseType === 'postgres' ? `$${params.length}` : '?';
    };

    const whereClauses = [`o."storeId" = ${addParam(storeId)}`];
    const fromValue = this.toRawOrderFromBoundary(query.from, databaseType);
    if (fromValue) {
      whereClauses.push(`o."orderedAt" >= ${addParam(fromValue)}`);
    }

    const toValue = this.toRawOrderToBoundary(query.to, databaseType);
    if (toValue) {
      whereClauses.push(`o."orderedAt" <= ${addParam(toValue)}`);
    }

    const refundedStatusForSold = addParam(OrderStatus.REFUNDED);
    const refundedStatusForRefunded = addParam(OrderStatus.REFUNDED);
    const refundedStatusForNetQty = addParam(OrderStatus.REFUNDED);
    const refundedStatusForNetAmount = addParam(OrderStatus.REFUNDED);

    const sql =
      databaseType === 'sqlite'
        ? this.buildSqliteProductSalesQuery({
            whereClause: whereClauses.join(' AND '),
            refundedStatusForSold,
            refundedStatusForRefunded,
            refundedStatusForNetQty,
            refundedStatusForNetAmount,
          })
        : this.buildPostgresProductSalesQuery({
            whereClause: whereClauses.join(' AND '),
            refundedStatusForSold,
            refundedStatusForRefunded,
            refundedStatusForNetQty,
            refundedStatusForNetAmount,
          });

    return this.orderRepository.query(sql, params) as Promise<
      ProductSalesAggRow[]
    >;
  }

  private buildPostgresProductSalesQuery(options: {
    whereClause: string;
    refundedStatusForSold: string;
    refundedStatusForRefunded: string;
    refundedStatusForNetQty: string;
    refundedStatusForNetAmount: string;
  }): string {
    const quantityExpression =
      'COALESCE(NULLIF(item.value ->> \'quantity\', \'\')::double precision, 0)';
    const lineTotalExpression =
      'COALESCE(NULLIF(item.value ->> \'lineTotal\', \'\')::double precision, 0)';

    return `
      WITH expanded AS (
        SELECT
          item.value ->> 'productName' AS "productName",
          LOWER(TRIM(item.value ->> 'productName')) AS "productKey",
          ${quantityExpression} AS "quantity",
          ${lineTotalExpression} AS "lineTotal",
          o."status" AS "status",
          o."orderedAt" AS "orderedAt",
          item.ordinality AS "itemIndex"
        FROM "orders" o
        CROSS JOIN LATERAL jsonb_array_elements(o."items"::jsonb)
          WITH ORDINALITY AS item(value, ordinality)
        WHERE ${options.whereClause}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY "productKey"
            ORDER BY "orderedAt" DESC, "itemIndex" ASC
          ) AS "productRank"
        FROM expanded
        WHERE "productKey" IS NOT NULL AND "productKey" <> ''
      )
      SELECT
        MAX(CASE WHEN "productRank" = 1 THEN "productName" END) AS "productName",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForSold} THEN 0 ELSE "quantity" END), 0) AS "soldQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForRefunded} THEN "quantity" ELSE 0 END), 0) AS "refundedQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForNetQty} THEN ("quantity" * -1) ELSE "quantity" END), 0) AS "netQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForNetAmount} THEN ("lineTotal" * -1) ELSE "lineTotal" END), 0) AS "netAmount"
      FROM ranked
      GROUP BY "productKey"
    `;
  }

  private buildSqliteProductSalesQuery(options: {
    whereClause: string;
    refundedStatusForSold: string;
    refundedStatusForRefunded: string;
    refundedStatusForNetQty: string;
    refundedStatusForNetAmount: string;
  }): string {
    const productNameExpression = `json_extract(item.value, '$.productName')`;
    const quantityExpression = `CAST(COALESCE(NULLIF(json_extract(item.value, '$.quantity'), ''), 0) AS REAL)`;
    const lineTotalExpression = `CAST(COALESCE(NULLIF(json_extract(item.value, '$.lineTotal'), ''), 0) AS REAL)`;

    return `
      WITH expanded AS (
        SELECT
          ${productNameExpression} AS "productName",
          LOWER(TRIM(${productNameExpression})) AS "productKey",
          ${quantityExpression} AS "quantity",
          ${lineTotalExpression} AS "lineTotal",
          o."status" AS "status",
          o."orderedAt" AS "orderedAt",
          CAST(item.key AS INTEGER) AS "itemIndex"
        FROM "orders" o
        JOIN json_each(o."items") AS item
        WHERE ${options.whereClause}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY "productKey"
            ORDER BY "orderedAt" DESC, "itemIndex" ASC
          ) AS "productRank"
        FROM expanded
        WHERE "productKey" IS NOT NULL AND "productKey" <> ''
      )
      SELECT
        MAX(CASE WHEN "productRank" = 1 THEN "productName" END) AS "productName",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForSold} THEN 0 ELSE "quantity" END), 0) AS "soldQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForRefunded} THEN "quantity" ELSE 0 END), 0) AS "refundedQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForNetQty} THEN ("quantity" * -1) ELSE "quantity" END), 0) AS "netQty",
        COALESCE(SUM(CASE WHEN "status" = ${options.refundedStatusForNetAmount} THEN ("lineTotal" * -1) ELSE "lineTotal" END), 0) AS "netAmount"
      FROM ranked
      GROUP BY "productKey"
    `;
  }

  private buildOrderAggQuery(query: DateRangeQueryDto, storeId?: string) {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .select('o.storeId', 'storeId')
      .addSelect('COALESCE(COUNT(o.id), 0)', 'ordersCount')
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status = :completedStatus THEN o.total ELSE 0 END), 0)',
        'completedRevenue',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN o.status = :refundedStatus THEN o.total ELSE 0 END), 0)',
        'refundAmount',
      )
      .setParameters({
        completedStatus: OrderStatus.COMPLETED,
        refundedStatus: OrderStatus.REFUNDED,
      })
      .groupBy('o.storeId');

    if (storeId) {
      qb.andWhere('o.storeId = :storeId', { storeId });
    }

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

  private buildDashboardSettlementAggQuery(
    query: DateRangeQueryDto,
    storeId?: string,
  ) {
    const periodFilters: string[] = [];
    const params: Record<string, string> = {};

    const fromDate = this.toDateOnly(query.from);
    if (fromDate) {
      periodFilters.push('s.businessDate >= :fromDate');
      params.fromDate = fromDate;
    }

    const toDate = this.toDateOnly(query.to);
    if (toDate) {
      periodFilters.push('s.businessDate <= :toDate');
      params.toDate = toDate;
    }

    const periodPredicate =
      periodFilters.length > 0 ? periodFilters.join(' AND ') : '1 = 1';
    const periodSum = (expression: string) =>
      `COALESCE(SUM(CASE WHEN ${periodPredicate} THEN ${expression} ELSE 0 END), 0)`;

    const carryForwardExpression =
      'CASE WHEN (s.actualRemainingAmount - s.cashBoxAmount - s.sharesAmount) > 0 THEN (s.actualRemainingAmount - s.cashBoxAmount - s.sharesAmount) ELSE 0 END';

    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .select('s.storeId', 'storeId')
      .addSelect(periodSum('s.cashBoxAmount'), 'cashBoxAmount')
      .addSelect(periodSum('s.sharesAmount'), 'sharesAmount')
      .addSelect(periodSum('s.expectedRevenue'), 'expectedRevenue')
      .addSelect(
        periodSum(carryForwardExpression),
        'expectedCarryForwardAmount',
      )
      .addSelect(periodSum('s.actualRemainingAmount'), 'actualRemainingAmount')
      .addSelect('COALESCE(SUM(s.cashBoxAmount), 0)', 'allTimeCashBoxAmount')
      .groupBy('s.storeId');

    if (storeId) {
      qb.andWhere('s.storeId = :storeId', { storeId });
    }

    if (Object.keys(params).length > 0) {
      qb.setParameters(params);
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

  private buildCashboxWithdrawalTotalQuery(query: DateRangeQueryDto) {
    const qb = this.cashboxWithdrawalRepository
      .createQueryBuilder('w')
      .select('SUM(w.amount)', 'cashBoxWithdrawalsAmount');

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

  private buildCashboxWithdrawalDashboardTotalsQuery(query: DateRangeQueryDto) {
    const periodFilters: string[] = [];
    const params: Record<string, string> = {};

    const fromValue = this.toOrderFromBoundary(query.from);
    if (fromValue) {
      periodFilters.push('w.withdrawnAt >= :from');
      params.from = fromValue;
    }

    const toValue = this.toOrderToBoundary(query.to);
    if (toValue) {
      periodFilters.push('w.withdrawnAt <= :to');
      params.to = toValue;
    }

    const periodPredicate =
      periodFilters.length > 0 ? periodFilters.join(' AND ') : '1 = 1';

    const qb = this.cashboxWithdrawalRepository
      .createQueryBuilder('w')
      .select(
        `COALESCE(SUM(CASE WHEN ${periodPredicate} THEN w.amount ELSE 0 END), 0)`,
        'cashBoxWithdrawalsAmount',
      )
      .addSelect(
        'COALESCE(SUM(w.amount), 0)',
        'allTimeCashBoxWithdrawalsAmount',
      );

    if (Object.keys(params).length > 0) {
      qb.setParameters(params);
    }

    return qb;
  }

  private async getCashboxWithdrawalTotalOrEmpty(
    query: DateRangeQueryDto,
  ): Promise<CashboxWithdrawalAggRow | undefined> {
    try {
      return await this.buildCashboxWithdrawalTotalQuery(query).getRawOne<
        CashboxWithdrawalAggRow
      >();
    } catch (error: unknown) {
      if (this.isMissingCashboxWithdrawalsTableError(error)) {
        return { cashBoxWithdrawalsAmount: '0' };
      }

      throw error;
    }
  }

  private async getCashboxWithdrawalDashboardTotalsOrEmpty(
    query: DateRangeQueryDto,
  ): Promise<CashboxWithdrawalAggRow | undefined> {
    try {
      return await this.buildCashboxWithdrawalDashboardTotalsQuery(query).getRawOne<
        CashboxWithdrawalAggRow
      >();
    } catch (error: unknown) {
      if (this.isMissingCashboxWithdrawalsTableError(error)) {
        return {
          cashBoxWithdrawalsAmount: '0',
          allTimeCashBoxWithdrawalsAmount: '0',
        };
      }

      throw error;
    }
  }

  private async getStoreActualCashBoxRemainingAmount(
    storeId: string,
  ): Promise<number> {
    const cashBoxRow = await this.buildSettlementAggQuery({})
      .andWhere('s.storeId = :storeId', { storeId })
      .getRawOne<SettlementAggRow>();

    return this.toMoney(this.parseNumber(cashBoxRow?.cashBoxAmount));
  }

  private async getTotalActualCashBoxRemainingAmount(): Promise<number> {
    const cashBoxRows = await this
      .buildSettlementAggQuery({})
      .getRawMany<SettlementAggRow>();
    const withdrawalRows = await this.getCashboxWithdrawalTotalOrEmpty({});

    return this.toMoney(
      cashBoxRows.reduce(
        (sum, row) => sum + this.parseNumber(row.cashBoxAmount),
        0,
      ) -
        this.parseNumber(withdrawalRows?.cashBoxWithdrawalsAmount),
    );
  }

  private parseNumber(value: string | number | null | undefined): number {
    if (value === undefined || value === null) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getOrderDatabaseType(): string {
    const manager = this.orderRepository.manager as {
      connection?: { options?: { type?: string } };
      dataSource?: { options?: { type?: string } };
    } | undefined;

    return (
      manager?.connection?.options?.type ??
      manager?.dataSource?.options?.type ??
      'postgres'
    );
  }

  private toMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private getDashboardCacheKey(query: DateRangeQueryDto): string {
    return [
      this.normalizeDateInput(query.from) ?? '',
      this.normalizeDateInput(query.to) ?? '',
    ].join(':');
  }

  private cloneDashboardResponse(
    response: AdminDashboardResponse,
  ): AdminDashboardResponse {
    return {
      totals: { ...response.totals },
      stores: response.stores.map((store) => ({ ...store })),
    };
  }

  private invalidateDashboardCache(): void {
    this.dashboardCache.clear();
  }

  private normalizeDateInput(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toDateOnly(value: string | undefined): string | undefined {
    return toDateOnly(value);
  }

  private toOrderFromBoundary(value: string | undefined): string | undefined {
    return toBusinessDayStartBoundary(value);
  }

  private toOrderToBoundary(value: string | undefined): string | undefined {
    return toBusinessDayEndBoundary(value);
  }

  private toRawOrderFromBoundary(
    value: string | undefined,
    databaseType: string,
  ): string | undefined {
    return this.toRawOrderBoundary(this.toOrderFromBoundary(value), databaseType);
  }

  private toRawOrderToBoundary(
    value: string | undefined,
    databaseType: string,
  ): string | undefined {
    return this.toRawOrderBoundary(this.toOrderToBoundary(value), databaseType);
  }

  private toRawOrderBoundary(
    value: string | undefined,
    databaseType: string,
  ): string | undefined {
    if (!value || databaseType !== 'sqlite') {
      return value;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().replace('T', ' ').replace('Z', '');
    }

    return value.replace('T', ' ').replace('Z', '');
  }

  private isMissingCashboxWithdrawalsTableError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const message = String(error.message ?? '').toLowerCase();
    return (
      message.includes('cashbox_withdrawals') &&
      (message.includes('does not exist') ||
        message.includes('no such table') ||
        message.includes('undefined table'))
    );
  }
}
