import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
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

export interface InventoryReconciliationRow {
  storeId: string;
  productClientId: string;
  calculatedFromHistory: number;
  currentBalance: number;
  difference: number;
}

@Injectable()
export class InventoryBalancesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
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
    > & { createdAt?: Date },
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
  ): Promise<void> {
    const balances = await manager.find(InventoryBalance, {
      where: { storeId: settlement.storeId },
    });
    if (balances.length === 0) {
      return;
    }

    await manager.upsert(
      InventorySettlementSnapshot,
      balances.map((balance) => ({
        settlementId: settlement.id,
        storeId: settlement.storeId,
        productClientId: balance.productClientId,
        quantity: this.roundQuantity(balance.quantity),
      })),
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
    const [calculated, balances] = await Promise.all([
      this.calculateCurrentStockFromHistory(storeId),
      this.findBalancesByStore(storeId),
    ]);
    const current = new Map(
      balances.map((balance) => [
        balance.productClientId,
        this.roundQuantity(balance.quantity),
      ]),
    );
    const productIds = new Set([
      ...calculated.keys(),
      ...current.keys(),
    ]);

    return Array.from(productIds)
      .map((productClientId) => {
        const calculatedFromHistory = calculated.get(productClientId) ?? 0;
        const currentBalance = current.get(productClientId) ?? 0;
        return {
          storeId,
          productClientId,
          calculatedFromHistory,
          currentBalance,
          difference: this.roundQuantity(currentBalance - calculatedFromHistory),
        };
      })
      .filter((row) => row.difference !== 0);
  }

  async repairStore(
    storeId: string,
    manager: EntityManager,
  ): Promise<InventoryReconciliationRow[]> {
    const discrepancies = await this.reconcileStore(storeId);
    const calculated = await this.calculateCurrentStockFromHistory(storeId);
    for (const discrepancy of discrepancies) {
      await this.setAbsoluteQuantity(
        manager,
        storeId,
        discrepancy.productClientId,
        calculated.get(discrepancy.productClientId) ?? 0,
      );
    }
    return discrepancies;
  }

  private async getPurchaseDelta(
    manager: EntityManager,
    purchase: Pick<
      Purchase,
      'storeId' | 'productName' | 'quantity' | 'purchaseKind'
    > & { createdAt?: Date },
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
    if (
      latestAdjustment &&
      purchase.createdAt &&
      purchase.createdAt <= latestAdjustment.adjustedAt
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
      const productClientId = productIds.get(this.normalizeProductKey(item.productName));
      if (!productClientId) {
        return;
      }
      const latestAdjustment = latestAdjustments.get(productClientId);
      if (latestAdjustment && order.orderedAt <= latestAdjustment.adjustedAt) {
        return;
      }
      byProduct.set(
        productClientId,
        (byProduct.get(productClientId) ?? 0) + item.quantity * direction * sign,
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
      productNames.map((name) => this.normalizeProductKey(name)).filter(Boolean),
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
        quantity: () =>
          absolute ? ':quantity' : '"quantity" + :quantity',
        updatedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('"storeId" = :storeId', { storeId })
      .andWhere('"productClientId" = :productClientId', { productClientId })
      .setParameters({ quantity: this.roundQuantity(quantity) })
      .execute();
  }

  private async calculateCurrentStockFromHistory(
    storeId: string,
  ): Promise<Map<string, number>> {
    const manager = this.dataSource.manager;
    const products = await this.productRepository.find({
      order: { name: 'ASC', createdAt: 'ASC' },
    });
    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product.clientProductId,
      ]),
    );
    const [purchases, orders, adjustments, destructions] = await Promise.all([
      manager.find(Purchase, { where: { storeId } }),
      manager.find(Order, { where: { storeId } }),
      manager.find(InventoryAdjustment, { where: { storeId } }),
      manager.find(InventoryDestruction, { where: { storeId } }),
    ]);

    const latestAdjustmentByProduct = new Map<
      string,
      {
        actualQuantity: number;
        adjustedAt: Date;
      }
    >();
    adjustments
      .sort(
        (a, b) =>
          b.adjustedAt.getTime() - a.adjustedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .forEach((adjustment) => {
        if (!latestAdjustmentByProduct.has(adjustment.productClientId)) {
          latestAdjustmentByProduct.set(adjustment.productClientId, adjustment);
        }
      });

    const balances = new Map<string, number>();
    products.forEach((product) => {
      balances.set(
        product.clientProductId,
        latestAdjustmentByProduct.get(product.clientProductId)?.actualQuantity ??
          0,
      );
    });

    purchases.forEach((purchase) => {
      if (purchase.purchaseKind === 'PAYMENT') {
        return;
      }
      const productClientId = productsByName.get(
        this.normalizeProductKey(purchase.productName),
      );
      if (!productClientId) {
        return;
      }
      const adjustment = latestAdjustmentByProduct.get(productClientId);
      if (!adjustment || purchase.createdAt > adjustment.adjustedAt) {
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + purchase.quantity,
        );
      }
    });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const productClientId = productsByName.get(
          this.normalizeProductKey(item.productName),
        );
        if (!productClientId) {
          return;
        }
        const adjustment = latestAdjustmentByProduct.get(productClientId);
        if (adjustment && order.orderedAt <= adjustment.adjustedAt) {
          return;
        }
        const direction = order.status === OrderStatus.REFUNDED ? 1 : -1;
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + item.quantity * direction,
        );
      });
    });

    destructions.forEach((destruction) => {
      const adjustment = latestAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (adjustment && destruction.destroyedAt <= adjustment.adjustedAt) {
        return;
      }
      balances.set(
        destruction.productClientId,
        (balances.get(destruction.productClientId) ?? 0) -
          destruction.quantity,
      );
    });

    balances.forEach((quantity, productClientId) => {
      balances.set(productClientId, this.roundQuantity(quantity));
    });
    return balances;
  }

  private normalizeProductKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(3));
  }
}
