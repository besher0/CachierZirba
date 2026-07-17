import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { isUniqueConstraintError } from '../database/is-unique-constraint-error';
import { EmployeeWithdrawal } from '../employees/entities/employee-withdrawal.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Purchase } from '../purchases/entities/purchase.entity';
import { StoresService } from '../stores/stores.service';
import { CreateDailySettlementDto } from './dto/create-daily-settlement.dto';
import { ListDailySettlementsQueryDto } from './dto/list-daily-settlements-query.dto';
import { DailySettlement } from './entities/daily-settlement.entity';

type SettlementCycleSnapshots = {
  cycleStartedAt: Date | null;
  salesAmount: number;
  refundAmount: number;
  expensesAmount: number;
  purchasesAmount: number;
  tawasiAmount: number;
  employeeWithdrawalsAmount: number;
  ordersCount: number;
  expensesCount: number;
  purchasesCount: number;
  withdrawalsCount: number;
  paymentsAmount: number;
};

@Injectable()
export class DailySettlementsService {
  constructor(
    @InjectRepository(DailySettlement)
    private readonly dailySettlementRepository: Repository<DailySettlement>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(EmployeeWithdrawal)
    private readonly employeeWithdrawalRepository: Repository<EmployeeWithdrawal>,
    private readonly storesService: StoresService,
  ) {}

  async createOrUpdate(
    dto: CreateDailySettlementDto,
    authUser: AuthUser,
  ): Promise<DailySettlement> {
    const scopedStoreId = this.resolveStoreForWrite(dto.storeId, authUser);
    await this.storesService.findById(scopedStoreId);

    const existingClientRecord = await this.dailySettlementRepository.findOne({
      where: { clientClosureId: dto.clientClosureId },
      relations: { store: true },
    });

    if (existingClientRecord) {
      return existingClientRecord;
    }

    const sameDayRecord = await this.dailySettlementRepository.findOne({
      where: {
        storeId: scopedStoreId,
        businessDate: dto.businessDate,
      },
      relations: { store: true },
    });

    if (sameDayRecord) {
      throw new ConflictException(
        'Daily settlement already exists for this store and business date.',
      );
    }

    try {
      const syncedAt = dto.syncedAt ? new Date(dto.syncedAt) : new Date();
      const snapshots = await this.buildCycleSnapshots(
        scopedStoreId,
        syncedAt,
        dto.cycleStartedAt ? new Date(dto.cycleStartedAt) : undefined,
      );
      const record = this.dailySettlementRepository.create({
        ...dto,
        storeId: scopedStoreId,
        actualRemainingAmount: dto.actualRemainingAmount,
        expectedRevenue: dto.expectedRevenue ?? 0,
        carryInAmount: dto.carryInAmount ?? 0,
        cycleStartedAt: dto.cycleStartedAt
          ? new Date(dto.cycleStartedAt)
          : snapshots.cycleStartedAt,
        salesAmount: dto.salesAmount ?? snapshots.salesAmount,
        refundAmount: dto.refundAmount ?? snapshots.refundAmount,
        expensesAmount: dto.expensesAmount ?? snapshots.expensesAmount,
        purchasesAmount: dto.purchasesAmount ?? snapshots.purchasesAmount,
        tawasiAmount: dto.tawasiAmount ?? snapshots.tawasiAmount,
        employeeWithdrawalsAmount:
          dto.employeeWithdrawalsAmount ?? snapshots.employeeWithdrawalsAmount,
        ordersCount: dto.ordersCount ?? snapshots.ordersCount,
        expensesCount: dto.expensesCount ?? snapshots.expensesCount,
        purchasesCount: dto.purchasesCount ?? snapshots.purchasesCount,
        withdrawalsCount: dto.withdrawalsCount ?? snapshots.withdrawalsCount,
        paymentsAmount: dto.paymentsAmount ?? snapshots.paymentsAmount,
        note: dto.note ?? null,
        syncedAt,
      });

      const saved = await this.dailySettlementRepository.save(record);
      await this.updateStoreCashCarry(saved);
      return this.findById(saved.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        const byClientClosure = await this.dailySettlementRepository.findOne({
          where: { clientClosureId: dto.clientClosureId },
          relations: { store: true },
        });

        if (byClientClosure) {
          return byClientClosure;
        }

        const byStoreDate = await this.dailySettlementRepository.findOne({
          where: {
            storeId: scopedStoreId,
            businessDate: dto.businessDate,
          },
          relations: { store: true },
        });

        if (byStoreDate) {
          throw new ConflictException(
            'Daily settlement already exists for this store and business date.',
          );
        }
      }

      throw error;
    }
  }

  async findAll(
    query: ListDailySettlementsQueryDto,
    authUser: AuthUser,
  ): Promise<DailySettlement[]> {
    const qb = this.dailySettlementRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.store', 'store')
      .orderBy('s.businessDate', 'DESC');

    const scopedStoreId = this.resolveStoreForRead(query.storeId, authUser);
    if (scopedStoreId) {
      qb.andWhere('s.storeId = :storeId', { storeId: scopedStoreId });
    }

    if (query.from) {
      qb.andWhere('s.businessDate >= :fromDate', {
        fromDate: query.from.slice(0, 10),
      });
    }

    if (query.to) {
      qb.andWhere('s.businessDate <= :toDate', {
        toDate: query.to.slice(0, 10),
      });
    }

    return qb.getMany();
  }

  private async findById(id: string): Promise<DailySettlement> {
    const record = await this.dailySettlementRepository.findOne({
      where: { id },
      relations: { store: true },
    });

    if (!record) {
      throw new Error(`Daily settlement ${id} was not found.`);
    }

    return record;
  }

  private resolveStoreForWrite(
    requestedStoreId: string,
    authUser: AuthUser,
  ): string {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId) {
        throw new ForbiddenException('Cashier account has no assigned store.');
      }

      if (requestedStoreId !== authUser.storeId) {
        throw new ForbiddenException(
          'Cashier can only create daily settlement for assigned store.',
        );
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }

  private async updateStoreCashCarry(
    settlement: DailySettlement,
  ): Promise<void> {
    const carryForward = Math.max(
      settlement.actualRemainingAmount -
        settlement.cashBoxAmount -
        settlement.sharesAmount,
      0,
    );
    await this.storesService.setCashCarry(settlement.storeId, carryForward);
  }

  private async buildCycleSnapshots(
    storeId: string,
    cycleEndedAt: Date,
    requestedCycleStartedAt?: Date,
  ): Promise<SettlementCycleSnapshots> {
    const previousSettlement = await this.dailySettlementRepository.findOne({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
    const cycleStartedAt =
      requestedCycleStartedAt ?? previousSettlement?.syncedAt ?? null;
    const [
      orderTotals,
      expenseTotals,
      purchaseTotals,
      employeeWithdrawalTotals,
    ] = await Promise.all([
      this.getOrderCycleTotals(storeId, cycleStartedAt, cycleEndedAt),
      this.getExpenseCycleTotal(
        storeId,
        previousSettlement?.clientClosureId ?? null,
      ),
      this.getPurchaseCycleTotals(storeId, cycleStartedAt, cycleEndedAt),
      this.getEmployeeWithdrawalCycleTotal(
        storeId,
        cycleStartedAt,
        cycleEndedAt,
      ),
    ]);

    return {
      cycleStartedAt,
      salesAmount: orderTotals.salesAmount,
      refundAmount: orderTotals.refundAmount,
      expensesAmount: expenseTotals.expensesAmount,
      purchasesAmount: purchaseTotals.purchasesAmount,
      tawasiAmount: purchaseTotals.tawasiAmount,
      employeeWithdrawalsAmount:
        employeeWithdrawalTotals.employeeWithdrawalsAmount,
      ordersCount: orderTotals.ordersCount,
      expensesCount: expenseTotals.expensesCount,
      purchasesCount: purchaseTotals.purchasesCount,
      withdrawalsCount: employeeWithdrawalTotals.withdrawalsCount,
      paymentsAmount: purchaseTotals.paymentsAmount,
    };
  }

  private applyCycleWindow<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    dateExpression: string,
    cycleStartedAt: Date | null,
    cycleEndedAt: Date,
  ): SelectQueryBuilder<T> {
    qb.andWhere(`${dateExpression} <= :cycleEndedAt`, { cycleEndedAt });

    if (cycleStartedAt) {
      qb.andWhere(`${dateExpression} > :cycleStartedAt`, { cycleStartedAt });
    }

    return qb;
  }

  private async getOrderCycleTotals(
    storeId: string,
    cycleStartedAt: Date | null,
    cycleEndedAt: Date,
  ): Promise<{
    salesAmount: number;
    refundAmount: number;
    ordersCount: number;
  }> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select(
        'COALESCE(SUM(CASE WHEN order.status = :completedStatus THEN order.total ELSE 0 END), 0)',
        'salesAmount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.status = :refundedStatus THEN order.total ELSE 0 END), 0)',
        'refundAmount',
      )
      .addSelect('COUNT(order.id)', 'ordersCount')
      .where('order.storeId = :storeId', { storeId })
      .setParameters({
        completedStatus: OrderStatus.COMPLETED,
        refundedStatus: OrderStatus.REFUNDED,
      });

    const row = await this.applyCycleWindow(
      qb,
      'order.orderedAt',
      cycleStartedAt,
      cycleEndedAt,
    ).getRawOne<{
      salesAmount: string | number;
      refundAmount: string | number;
      ordersCount: string | number;
    }>();

    return {
      salesAmount: this.toMoney(row?.salesAmount),
      refundAmount: this.toMoney(row?.refundAmount),
      ordersCount: this.toCount(row?.ordersCount),
    };
  }

  private async getExpenseCycleTotal(
    storeId: string,
    cycleStartClosureId: string | null,
  ): Promise<{ expensesAmount: number; expensesCount: number }> {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .addSelect('COUNT(expense.id)', 'expensesCount')
      .where('expense.storeId = :storeId', { storeId });

    if (cycleStartClosureId) {
      qb.andWhere('expense.cycleStartClosureId = :cycleStartClosureId', {
        cycleStartClosureId,
      });
    } else {
      qb.andWhere('expense.cycleStartClosureId IS NULL');
    }

    const row = await qb.getRawOne<{
      total: string | number;
      expensesCount: string | number;
    }>();

    return {
      expensesAmount: this.toMoney(row?.total),
      expensesCount: this.toCount(row?.expensesCount),
    };
  }

  private async getPurchaseCycleTotals(
    storeId: string,
    cycleStartedAt: Date | null,
    cycleEndedAt: Date,
  ): Promise<{
    purchasesAmount: number;
    tawasiAmount: number;
    purchasesCount: number;
    paymentsAmount: number;
  }> {
    const occurredAtExpression =
      'CASE WHEN purchase.syncedAt < purchase.createdAt THEN purchase.syncedAt ELSE purchase.createdAt END';
    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .select('COALESCE(SUM(purchase.totalCost), 0)', 'purchasesAmount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN purchase.purchaseKind = 'TAWASI' THEN purchase.totalCost ELSE 0 END), 0)`,
        'tawasiAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN purchase.purchaseKind <> 'PAYMENT' THEN 1 END)`,
        'purchasesCount',
      )
      .addSelect('COALESCE(SUM(purchase.paymentAmount), 0)', 'paymentsAmount')
      .where('purchase.storeId = :storeId', { storeId });

    const row = await this.applyCycleWindow(
      qb,
      occurredAtExpression,
      cycleStartedAt,
      cycleEndedAt,
    ).getRawOne<{
      purchasesAmount: string | number;
      tawasiAmount: string | number;
      purchasesCount: string | number;
      paymentsAmount: string | number;
    }>();

    return {
      purchasesAmount: this.toMoney(row?.purchasesAmount),
      tawasiAmount: this.toMoney(row?.tawasiAmount),
      purchasesCount: this.toCount(row?.purchasesCount),
      paymentsAmount: this.toMoney(row?.paymentsAmount),
    };
  }

  private async getEmployeeWithdrawalCycleTotal(
    storeId: string,
    cycleStartedAt: Date | null,
    cycleEndedAt: Date,
  ): Promise<{
    employeeWithdrawalsAmount: number;
    withdrawalsCount: number;
  }> {
    const qb = this.employeeWithdrawalRepository
      .createQueryBuilder('withdrawal')
      .select('COALESCE(SUM(withdrawal.amount), 0)', 'total')
      .addSelect('COUNT(withdrawal.id)', 'withdrawalsCount')
      .where('withdrawal.storeId = :storeId', { storeId });

    const row = await this.applyCycleWindow(
      qb,
      'withdrawal.createdAt',
      cycleStartedAt,
      cycleEndedAt,
    ).getRawOne<{
      total: string | number;
      withdrawalsCount: string | number;
    }>();

    return {
      employeeWithdrawalsAmount: this.toMoney(row?.total),
      withdrawalsCount: this.toCount(row?.withdrawalsCount),
    };
  }

  private toMoney(value: string | number | null | undefined): number {
    return Number(Number(value ?? 0).toFixed(2));
  }

  private toCount(value: string | number | null | undefined): number {
    return Number.parseInt(String(value ?? 0), 10) || 0;
  }

  private resolveStoreForRead(
    requestedStoreId: string | undefined,
    authUser: AuthUser,
  ): string | undefined {
    if (authUser.role === UserRole.CASHIER) {
      if (!authUser.storeId) {
        throw new ForbiddenException('Cashier account has no assigned store.');
      }

      if (requestedStoreId && requestedStoreId !== authUser.storeId) {
        throw new ForbiddenException(
          'Cashier can only view daily settlements for assigned store.',
        );
      }

      return authUser.storeId;
    }

    return requestedStoreId;
  }
}
