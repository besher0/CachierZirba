import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { OrderItem } from '../orders/interfaces/order-item.interface';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventorySettlementSnapshot } from './entities/inventory-settlement-snapshot.entity';

type ProductQuantityDelta = {
  storeId: string;
  productClientId: string;
  delta: number;
};

type LatestSnapshotContext = {
  settlementId: string;
  syncedAt: Date;
  snapshots: Array<
    Pick<InventorySettlementSnapshot, 'productClientId' | 'quantity'>
  >;
};

type PurchaseStockRow = Pick<
  Purchase,
  'productName' | 'quantity' | 'purchaseKind'
> & { createdAt?: Date; syncedAt?: Date };
type OrderStockRow = Pick<Order, 'status' | 'items' | 'orderedAt'>;
type AdjustmentStockRow = Pick<
  InventoryAdjustment,
  'productClientId' | 'actualQuantity' | 'adjustedAt' | 'createdAt'
>;
type DestructionStockRow = Pick<
  InventoryDestruction,
  'productClientId' | 'quantity' | 'destroyedAt'
>;

type InventoryMovementRows = {
  purchases: PurchaseStockRow[];
  orders: OrderStockRow[];
  adjustments: AdjustmentStockRow[];
  destructions: DestructionStockRow[];
};

export interface InventoryReconciliationRow {
  storeId: string;
  productClientId: string;
  calculatedFromHistory: number;
  currentBalance: number;
  difference: number;
}

export interface InventorySnapshotQuantity {
  productClientId: string;
  quantity: number;
}

@Injectable()
export class InventoryBalancesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryBalance)
    private readonly balanceRepository: Repository<InventoryBalance>,
    @InjectRepository(InventorySettlementSnapshot)
    private readonly snapshotRepository: Repository<InventorySettlementSnapshot>,
  ) {}

  runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  async applyPurchaseDelta(
    manager: EntityManager,
    purchase: Pick<
      Purchase,
      'storeId' | 'productName' | 'quantity' | 'purchaseKind'
    > & { createdAt?: Date; syncedAt?: Date },
    sign = 1,
  ): Promise<void> {
    const delta = await this.getPurchaseDelta(manager, purchase, sign);
    await this.incrementBalances(manager, delta);
  }

  async applyOrderDelta(
    manager: EntityManager,
    order: Pick<Order, 'storeId' | 'status' | 'items' | 'orderedAt'>,
    sign = 1,
  ): Promise<void> {
    const deltas = await this.getOrderDeltas(manager, order, sign);
    await this.incrementBalances(manager, deltas);
  }

  async applyDestructionDelta(
    manager: EntityManager,
    destruction: Pick<
      InventoryDestruction,
      'storeId' | 'productClientId' | 'quantity' | 'destroyedAt'
    >,
    sign = 1,
  ): Promise<void> {
    const latestAdjustment = await this.getLatestAdjustment(
      manager,
      destruction.storeId,
      destruction.productClientId,
    );
    if (
      latestAdjustment &&
      destruction.destroyedAt <= latestAdjustment.adjustedAt
    ) {
      return;
    }

    await this.incrementBalances(manager, [
      {
        storeId: destruction.storeId,
        productClientId: destruction.productClientId,
        delta: -destruction.quantity * sign,
      },
    ]);
  }

  async setAbsoluteQuantity(
    manager: EntityManager,
    storeId: string,
    productClientId: string,
    quantity: number,
  ): Promise<void> {
    await this.upsertBalance(manager, storeId, productClientId, quantity, true);
  }

  async snapshotSettlement(
    manager: EntityManager,
    settlement: DailySettlement,
    snapshotQuantities: InventorySnapshotQuantity[] = [],
  ): Promise<void> {
    const balances = await manager.find(InventoryBalance, {
      where: { storeId: settlement.storeId },
    });

    const snapshotByProduct = new Map(
      balances.map((balance) => [
        balance.productClientId,
        this.roundQuantity(balance.quantity),
      ]),
    );
    snapshotQuantities.forEach((item) => {
      snapshotByProduct.set(
        item.productClientId,
        this.roundQuantity(item.quantity),
      );
    });

    if (snapshotByProduct.size === 0) {
      return;
    }

    await manager.upsert(
      InventorySettlementSnapshot,
      Array.from(snapshotByProduct.entries()).map(
        ([productClientId, quantity]) => ({
          settlementId: settlement.id,
          storeId: settlement.storeId,
          productClientId,
          quantity,
        }),
      ),
      ['settlementId', 'productClientId'],
    );
  }

  async findBalancesByStore(storeId: string): Promise<InventoryBalance[]> {
    return this.balanceRepository.find({ where: { storeId } });
  }

  async findLatestSnapshotsByStore(
    storeId: string,
  ): Promise<InventorySettlementSnapshot[]> {
    const latestSettlement = await this.snapshotRepository
      .createQueryBuilder('snapshot')
      .select('snapshot.settlementId', 'settlementId')
      .innerJoin(
        DailySettlement,
        'settlement',
        'settlement.id = snapshot.settlementId',
      )
      .where('snapshot.storeId = :storeId', { storeId })
      .orderBy('settlement.businessDate', 'DESC')
      .addOrderBy('settlement.syncedAt', 'DESC')
      .addOrderBy('settlement.createdAt', 'DESC')
      .groupBy('snapshot.settlementId')
      .addGroupBy('settlement.businessDate')
      .addGroupBy('settlement.syncedAt')
      .addGroupBy('settlement.createdAt')
      .limit(1)
      .getRawOne<{ settlementId: string }>();

    if (!latestSettlement?.settlementId) {
      return [];
    }

    return this.snapshotRepository.find({
      where: { storeId, settlementId: latestSettlement.settlementId },
    });
  }

  async reconcileStore(storeId: string): Promise<InventoryReconciliationRow[]> {
    return (await this.buildReconciliation(storeId, this.dataSource.manager))
      .discrepancies;
  }

  async repairStore(
    storeId: string,
    manager: EntityManager,
  ): Promise<InventoryReconciliationRow[]> {
    const { discrepancies } = await this.buildReconciliation(storeId, manager);
    if (discrepancies.length > 0) {
      await manager.upsert(
        InventoryBalance,
        discrepancies.map((discrepancy) => ({
          storeId,
          productClientId: discrepancy.productClientId,
          quantity: discrepancy.calculatedFromHistory,
        })),
        ['storeId', 'productClientId'],
      );
    }
    return discrepancies;
  }

  private async getPurchaseDelta(
    manager: EntityManager,
    purchase: Pick<
      Purchase,
      'storeId' | 'productName' | 'quantity' | 'purchaseKind'
    > & { createdAt?: Date; syncedAt?: Date },
    sign: number,
  ): Promise<ProductQuantityDelta[]> {
    if (purchase.purchaseKind === 'PAYMENT') {
      return [];
    }

    const productId = await this.resolveProductClientId(
      manager,
      purchase.productName,
    );
    const latestAdjustment = productId
      ? await this.getLatestAdjustment(manager, purchase.storeId, productId)
      : null;
    const purchaseOccurredAt = this.getPurchaseOccurredAt(purchase);
    if (
      latestAdjustment &&
      purchaseOccurredAt &&
      purchaseOccurredAt <= latestAdjustment.adjustedAt
    ) {
      return [];
    }

    return productId
      ? [
          {
            storeId: purchase.storeId,
            productClientId: productId,
            delta: purchase.quantity * sign,
          },
        ]
      : [];
  }

  private async getOrderDeltas(
    manager: EntityManager,
    order: Pick<Order, 'storeId' | 'status' | 'items' | 'orderedAt'>,
    sign: number,
  ): Promise<ProductQuantityDelta[]> {
    const productIds = await this.resolveProductClientIds(
      manager,
      order.items.map((item) => item.productName),
    );
    const byProduct = new Map<string, number>();
    const direction = order.status === OrderStatus.REFUNDED ? 1 : -1;
    const latestAdjustments = await this.getLatestAdjustments(
      manager,
      order.storeId,
      Array.from(productIds.values()),
    );

    order.items.forEach((item: OrderItem) => {
      const productClientId = productIds.get(
        this.normalizeProductKey(item.productName),
      );
      if (!productClientId) {
        return;
      }
      const latestAdjustment = latestAdjustments.get(productClientId);
      if (latestAdjustment && order.orderedAt <= latestAdjustment.adjustedAt) {
        return;
      }
      byProduct.set(
        productClientId,
        (byProduct.get(productClientId) ?? 0) +
          item.quantity * direction * sign,
      );
    });

    return Array.from(byProduct.entries()).map(([productClientId, delta]) => ({
      storeId: order.storeId,
      productClientId,
      delta,
    }));
  }

  private async resolveProductClientId(
    manager: EntityManager,
    productName: string,
  ): Promise<string | null> {
    const products = await this.resolveProductClientIds(manager, [productName]);
    return products.get(this.normalizeProductKey(productName)) ?? null;
  }

  private async resolveProductClientIds(
    manager: EntityManager,
    productNames: string[],
  ): Promise<Map<string, string>> {
    const keys = new Set(
      productNames
        .map((name) => this.normalizeProductKey(name))
        .filter(Boolean),
    );
    if (keys.size === 0) {
      return new Map();
    }

    const products = await manager.find(Product, {
      order: { name: 'ASC', createdAt: 'ASC' },
    });
    const result = new Map<string, string>();
    products.forEach((product) => {
      const key = this.normalizeProductKey(product.name);
      if (keys.has(key)) {
        result.set(key, product.clientProductId);
      }
    });
    return result;
  }

  private async getLatestAdjustment(
    manager: EntityManager,
    storeId: string,
    productClientId: string,
  ): Promise<InventoryAdjustment | null> {
    const adjustments = await this.getLatestAdjustments(manager, storeId, [
      productClientId,
    ]);
    return adjustments.get(productClientId) ?? null;
  }

  private async getLatestAdjustments(
    manager: EntityManager,
    storeId: string,
    productClientIds: string[],
  ): Promise<Map<string, InventoryAdjustment>> {
    const ids = Array.from(new Set(productClientIds));
    if (ids.length === 0) {
      return new Map();
    }

    const adjustments = await manager.find(InventoryAdjustment, {
      where: { storeId, productClientId: In(ids) },
      order: { adjustedAt: 'DESC', createdAt: 'DESC' },
    });
    const result = new Map<string, InventoryAdjustment>();
    adjustments.forEach((adjustment) => {
      if (!result.has(adjustment.productClientId)) {
        result.set(adjustment.productClientId, adjustment);
      }
    });
    return result;
  }

  private async incrementBalances(
    manager: EntityManager,
    deltas: ProductQuantityDelta[],
  ): Promise<void> {
    for (const delta of deltas) {
      if (delta.delta === 0) {
        continue;
      }
      await this.upsertBalance(
        manager,
        delta.storeId,
        delta.productClientId,
        this.roundQuantity(delta.delta),
        false,
      );
    }
  }

  private async upsertBalance(
    manager: EntityManager,
    storeId: string,
    productClientId: string,
    quantity: number,
    absolute: boolean,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(InventoryBalance)
      .values({
        storeId,
        productClientId,
        quantity: 0,
      })
      .orIgnore()
      .execute();

    await manager
      .createQueryBuilder()
      .update(InventoryBalance)
      .set({
        quantity: () => (absolute ? ':quantity' : '"quantity" + :quantity'),
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('"storeId" = :storeId', { storeId })
      .andWhere('"productClientId" = :productClientId', { productClientId })
      .setParameters({ quantity: this.roundQuantity(quantity) })
      .execute();
  }

  private async buildReconciliation(
    storeId: string,
    manager: EntityManager,
  ): Promise<{
    calculated: Map<string, number>;
    discrepancies: InventoryReconciliationRow[];
  }> {
    const [calculated, balances] = await Promise.all([
      this.calculateCurrentStock(storeId, manager),
      this.findBalanceRowsByStore(storeId, manager),
    ]);
    const current = new Map(
      balances.map((balance) => [
        balance.productClientId,
        this.roundQuantity(balance.quantity),
      ]),
    );
    const productIds = new Set([...calculated.keys(), ...current.keys()]);
    const discrepancies = Array.from(productIds)
      .map((productClientId) => {
        const calculatedFromHistory = calculated.get(productClientId) ?? 0;
        const currentBalance = current.get(productClientId) ?? 0;
        return {
          storeId,
          productClientId,
          calculatedFromHistory,
          currentBalance,
          difference: this.roundQuantity(
            currentBalance - calculatedFromHistory,
          ),
        };
      })
      .filter((row) => row.difference !== 0);

    return { calculated, discrepancies };
  }

  private async calculateCurrentStock(
    storeId: string,
    manager: EntityManager,
  ): Promise<Map<string, number>> {
    const snapshotContext = await this.findLatestSnapshotContextByStore(
      storeId,
      manager,
    );
    const [products, movements] = await Promise.all([
      this.findProductLookupRows(manager),
      this.findInventoryMovementRows(
        storeId,
        manager,
        snapshotContext?.syncedAt,
      ),
    ]);
    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product.clientProductId,
      ]),
    );
    const latestAdjustmentByProduct = this.getLatestAdjustmentByProduct(
      movements.adjustments,
    );
    const balances = this.createStartingBalances(
      products.map((product) => product.clientProductId),
      snapshotContext,
      latestAdjustmentByProduct,
    );
    const movementBoundaries = this.createMovementBoundaries(
      balances,
      snapshotContext?.syncedAt,
      latestAdjustmentByProduct,
    );

    this.applyPurchaseRowsToBalances(
      movements.purchases,
      productsByName,
      balances,
      movementBoundaries,
    );
    this.applyOrderRowsToBalances(
      movements.orders,
      productsByName,
      balances,
      movementBoundaries,
    );
    this.applyDestructionRowsToBalances(
      movements.destructions,
      balances,
      movementBoundaries,
    );

    this.roundBalances(balances);
    return balances;
  }

  private async findBalanceRowsByStore(
    storeId: string,
    manager: EntityManager,
  ): Promise<Array<Pick<InventoryBalance, 'productClientId' | 'quantity'>>> {
    return manager.find(InventoryBalance, {
      select: {
        productClientId: true,
        quantity: true,
      },
      where: { storeId },
    });
  }

  private async findProductLookupRows(
    manager: EntityManager,
  ): Promise<Array<Pick<Product, 'clientProductId' | 'name'>>> {
    return manager.find(Product, {
      select: {
        clientProductId: true,
        name: true,
      },
      order: { name: 'ASC', createdAt: 'ASC' },
    });
  }

  private async findLatestSnapshotContextByStore(
    storeId: string,
    manager: EntityManager,
  ): Promise<LatestSnapshotContext | null> {
    const latestSettlement = await manager
      .getRepository(InventorySettlementSnapshot)
      .createQueryBuilder('snapshot')
      .select('snapshot.settlementId', 'settlementId')
      .addSelect('settlement.syncedAt', 'settlementSyncedAt')
      .innerJoin(
        DailySettlement,
        'settlement',
        'settlement.id = snapshot.settlementId',
      )
      .where('snapshot.storeId = :storeId', { storeId })
      .orderBy('settlement.businessDate', 'DESC')
      .addOrderBy('settlement.syncedAt', 'DESC')
      .addOrderBy('settlement.createdAt', 'DESC')
      .groupBy('snapshot.settlementId')
      .addGroupBy('settlement.businessDate')
      .addGroupBy('settlement.syncedAt')
      .addGroupBy('settlement.createdAt')
      .limit(1)
      .getRawOne<{
        settlementId: string;
        settlementSyncedAt: Date | string;
      }>();

    if (!latestSettlement?.settlementId) {
      return null;
    }

    const snapshots = await manager.find(InventorySettlementSnapshot, {
      select: {
        productClientId: true,
        quantity: true,
      },
      where: { storeId, settlementId: latestSettlement.settlementId },
    });

    if (snapshots.length === 0) {
      return null;
    }

    return {
      settlementId: latestSettlement.settlementId,
      syncedAt: new Date(latestSettlement.settlementSyncedAt),
      snapshots,
    };
  }

  private async findInventoryMovementRows(
    storeId: string,
    manager: EntityManager,
    since?: Date,
  ): Promise<InventoryMovementRows> {
    const [purchases, orders, adjustments, destructions] = await Promise.all([
      manager.find(Purchase, {
        select: {
          productName: true,
          quantity: true,
          purchaseKind: true,
          syncedAt: true,
          createdAt: true,
        },
        where: since ? { storeId, syncedAt: MoreThan(since) } : { storeId },
      }),
      manager.find(Order, {
        select: {
          status: true,
          items: true,
          orderedAt: true,
        },
        where: since ? { storeId, orderedAt: MoreThan(since) } : { storeId },
      }),
      manager.find(InventoryAdjustment, {
        select: {
          productClientId: true,
          actualQuantity: true,
          adjustedAt: true,
          createdAt: true,
        },
        where: since ? { storeId, adjustedAt: MoreThan(since) } : { storeId },
        order: { adjustedAt: 'DESC', createdAt: 'DESC' },
      }),
      manager.find(InventoryDestruction, {
        select: {
          productClientId: true,
          quantity: true,
          destroyedAt: true,
        },
        where: since ? { storeId, destroyedAt: MoreThan(since) } : { storeId },
      }),
    ]);

    return { purchases, orders, adjustments, destructions };
  }

  private createStartingBalances(
    productClientIds: string[],
    snapshotContext: LatestSnapshotContext | null,
    latestAdjustmentByProduct: Map<
      string,
      Pick<InventoryAdjustment, 'actualQuantity' | 'adjustedAt'>
    >,
  ): Map<string, number> {
    const snapshotByProduct = new Map(
      snapshotContext?.snapshots.map((snapshot) => [
        snapshot.productClientId,
        this.roundQuantity(snapshot.quantity),
      ]) ?? [],
    );
    const productIds = new Set([
      ...productClientIds,
      ...snapshotByProduct.keys(),
      ...latestAdjustmentByProduct.keys(),
    ]);
    const balances = new Map<string, number>();

    productIds.forEach((productClientId) => {
      const latestAdjustment = latestAdjustmentByProduct.get(productClientId);
      balances.set(
        productClientId,
        latestAdjustment
          ? this.roundQuantity(latestAdjustment.actualQuantity)
          : (snapshotByProduct.get(productClientId) ?? 0),
      );
    });

    return balances;
  }

  private createMovementBoundaries(
    balances: Map<string, number>,
    snapshotSyncedAt: Date | undefined,
    latestAdjustmentByProduct: Map<
      string,
      Pick<InventoryAdjustment, 'actualQuantity' | 'adjustedAt'>
    >,
  ): Map<string, Date> {
    const boundaries = new Map<string, Date>();
    balances.forEach((_, productClientId) => {
      const latestAdjustment = latestAdjustmentByProduct.get(productClientId);
      if (latestAdjustment) {
        boundaries.set(productClientId, latestAdjustment.adjustedAt);
      } else if (snapshotSyncedAt) {
        boundaries.set(productClientId, snapshotSyncedAt);
      }
    });
    return boundaries;
  }

  private getLatestAdjustmentByProduct(
    adjustments: AdjustmentStockRow[],
  ): Map<string, Pick<InventoryAdjustment, 'actualQuantity' | 'adjustedAt'>> {
    return adjustments
      .sort(
        (a, b) =>
          b.adjustedAt.getTime() - a.adjustedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .reduce(
        (latest, adjustment) =>
          latest.has(adjustment.productClientId)
            ? latest
            : latest.set(adjustment.productClientId, adjustment),
        new Map<
          string,
          Pick<InventoryAdjustment, 'actualQuantity' | 'adjustedAt'>
        >(),
      );
  }

  private applyPurchaseRowsToBalances(
    purchases: PurchaseStockRow[],
    productsByName: Map<string, string>,
    balances: Map<string, number>,
    movementBoundaries: Map<string, Date>,
  ): void {
    purchases.forEach((purchase) => {
      if (purchase.purchaseKind === 'PAYMENT') {
        return;
      }

      const productClientId = productsByName.get(
        this.normalizeProductKey(purchase.productName),
      );
      if (
        !productClientId ||
        !this.isAfterMovementBoundary(
          productClientId,
          this.getPurchaseOccurredAt(purchase),
          movementBoundaries,
        )
      ) {
        return;
      }

      balances.set(
        productClientId,
        (balances.get(productClientId) ?? 0) + purchase.quantity,
      );
    });
  }

  private applyOrderRowsToBalances(
    orders: OrderStockRow[],
    productsByName: Map<string, string>,
    balances: Map<string, number>,
    movementBoundaries: Map<string, Date>,
  ): void {
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const productClientId = productsByName.get(
          this.normalizeProductKey(item.productName),
        );
        if (
          !productClientId ||
          !this.isAfterMovementBoundary(
            productClientId,
            order.orderedAt,
            movementBoundaries,
          )
        ) {
          return;
        }

        const direction = order.status === OrderStatus.REFUNDED ? 1 : -1;
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + item.quantity * direction,
        );
      });
    });
  }

  private applyDestructionRowsToBalances(
    destructions: DestructionStockRow[],
    balances: Map<string, number>,
    movementBoundaries: Map<string, Date>,
  ): void {
    destructions.forEach((destruction) => {
      if (
        !this.isAfterMovementBoundary(
          destruction.productClientId,
          destruction.destroyedAt,
          movementBoundaries,
        )
      ) {
        return;
      }

      balances.set(
        destruction.productClientId,
        (balances.get(destruction.productClientId) ?? 0) - destruction.quantity,
      );
    });
  }

  private isAfterMovementBoundary(
    productClientId: string,
    occurredAt: Date | undefined,
    movementBoundaries: Map<string, Date>,
  ): boolean {
    const boundary = movementBoundaries.get(productClientId);
    return boundary ? !!occurredAt && occurredAt > boundary : true;
  }

  private roundBalances(balances: Map<string, number>): void {
    balances.forEach((quantity, productClientId) => {
      balances.set(productClientId, this.roundQuantity(quantity));
    });
  }

  private normalizeProductKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private getPurchaseOccurredAt(purchase: {
    syncedAt?: Date;
    createdAt?: Date;
  }): Date | undefined {
    return purchase.syncedAt ?? purchase.createdAt;
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(3));
  }
}
