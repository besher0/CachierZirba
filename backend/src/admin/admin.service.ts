import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { ListOrdersQueryDto } from '../orders/dto/list-orders-query.dto';
import { Store } from '../stores/entities/store.entity';
import { StoresService } from '../stores/stores.service';

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
}

export interface StoreDashboardSummary {
  storeId: string;
  storeName: string;
  ordersCount: number;
  completedRevenue: number;
  refundAmount: number;
  sharesAmount: number;
  cashBoxAmount: number;
  netProfit: number;
}

export interface AdminDashboardResponse {
  totals: {
    ordersCount: number;
    completedRevenue: number;
    refundAmount: number;
    sharesAmount: number;
    cashBoxAmount: number;
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
    private readonly storesService: StoresService,
  ) {}

  async getDashboard(query: DateRangeQueryDto): Promise<AdminDashboardResponse> {
    const stores = await this.storeRepository.find({ order: { name: 'ASC' } });

    const orderAggRows = await this.buildOrderAggQuery(query).getRawMany<OrderAggRow>();
    const settlementAggRows = await this
      .buildSettlementAggQuery(query)
      .getRawMany<SettlementAggRow>();

    const orderMap = new Map<string, OrderAggRow>(
      orderAggRows.map((row) => [row.storeId, row]),
    );
    const settlementMap = new Map<string, SettlementAggRow>(
      settlementAggRows.map((row) => [row.storeId, row]),
    );

    const storeSummaries = stores.map((store) => {
      const orderAgg = orderMap.get(store.id);
      const settlementAgg = settlementMap.get(store.id);

      const ordersCount = this.parseNumber(orderAgg?.ordersCount);
      const completedRevenue = this.parseNumber(orderAgg?.completedRevenue);
      const refundAmount = this.parseNumber(orderAgg?.refundAmount);
      const sharesAmount = this.parseNumber(settlementAgg?.sharesAmount);
      const cashBoxAmount = this.parseNumber(settlementAgg?.cashBoxAmount);
      const netProfit = completedRevenue - refundAmount - sharesAmount;

      return {
        storeId: store.id,
        storeName: store.name,
        ordersCount,
        completedRevenue,
        refundAmount,
        sharesAmount,
        cashBoxAmount,
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

    const ordersCount = orders.length;
    const completedRevenue = orders
      .filter((item) => item.status === OrderStatus.COMPLETED)
      .reduce((sum, item) => sum + item.total, 0);
    const refundAmount = orders
      .filter((item) => item.status === OrderStatus.REFUNDED)
      .reduce((sum, item) => sum + item.total, 0);
    const sharesAmount = settlements.reduce((sum, item) => sum + item.sharesAmount, 0);
    const cashBoxAmount = settlements.reduce((sum, item) => sum + item.cashBoxAmount, 0);

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

    if (query.from) {
      qb.andWhere('o.orderedAt >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('o.orderedAt <= :to', { to: query.to });
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

    if (query.from) {
      qb.andWhere('s.businessDate >= :fromDate', { fromDate: query.from.slice(0, 10) });
    }

    if (query.to) {
      qb.andWhere('s.businessDate <= :toDate', { toDate: query.to.slice(0, 10) });
    }

    return qb.getMany();
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

    if (query.from) {
      qb.andWhere('o.orderedAt >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('o.orderedAt <= :to', { to: query.to });
    }

    return qb;
  }

  private buildSettlementAggQuery(query: DateRangeQueryDto) {
    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .select('s.storeId', 'storeId')
      .addSelect('SUM(s.cashBoxAmount)', 'cashBoxAmount')
      .addSelect('SUM(s.sharesAmount)', 'sharesAmount')
      .groupBy('s.storeId');

    if (query.from) {
      qb.andWhere('s.businessDate >= :fromDate', { fromDate: query.from.slice(0, 10) });
    }

    if (query.to) {
      qb.andWhere('s.businessDate <= :toDate', { toDate: query.to.slice(0, 10) });
    }

    return qb;
  }

  private parseNumber(value: string | number | undefined): number {
    if (value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}