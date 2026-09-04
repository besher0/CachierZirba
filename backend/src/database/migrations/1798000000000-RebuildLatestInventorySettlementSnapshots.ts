import { MigrationInterface, QueryRunner } from 'typeorm';

type ProductRow = {
  clientProductId: string;
  name: string;
};

type PurchaseRow = {
  productName: string;
  quantity: number;
  purchaseKind: string;
  syncedAt: Date | string | null;
  createdAt: Date | string;
};

type OrderRow = {
  status: string;
  items: string | Array<{ productName: string; quantity: number }>;
  orderedAt: Date | string;
};

type AdjustmentRow = {
  productClientId: string;
  actualQuantity: number;
  adjustedAt: Date | string;
  createdAt: Date | string;
};

type DestructionRow = {
  productClientId: string;
  quantity: number;
  destroyedAt: Date | string;
};

type SettlementRow = {
  id: string;
  storeId: string;
  syncedAt: Date | string | null;
  createdAt: Date | string;
};

export class RebuildLatestInventorySettlementSnapshots1798000000000
  implements MigrationInterface
{
  name = 'RebuildLatestInventorySettlementSnapshots1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const products = (await queryRunner.query(
      `SELECT "clientProductId", "name" FROM "products" ORDER BY "name" ASC, "createdAt" ASC`,
    )) as ProductRow[];
    const stores = (await queryRunner.query(
      `SELECT "id" FROM "stores"`,
    )) as Array<{ id: string }>;
    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product.clientProductId,
      ]),
    );

    for (const store of stores) {
      const latestSettlements = (await queryRunner.query(
        `SELECT "id", "storeId", "syncedAt", "createdAt" FROM "daily_settlements" WHERE "storeId" = $1 ORDER BY "businessDate" DESC, "syncedAt" DESC, "createdAt" DESC LIMIT 1`,
        [store.id],
      )) as SettlementRow[];
      const latestSettlement = latestSettlements[0] ?? null;
      if (!latestSettlement) {
        continue;
      }

      const settlementAt = this.toDate(
        latestSettlement.syncedAt ?? latestSettlement.createdAt,
      );
      const purchases = (await queryRunner.query(
        `SELECT "productName", "quantity", "purchaseKind", "syncedAt", "createdAt" FROM "purchases" WHERE "storeId" = $1`,
        [store.id],
      )) as PurchaseRow[];
      const orders = (await queryRunner.query(
        `SELECT "status", "items", "orderedAt" FROM "orders" WHERE "storeId" = $1`,
        [store.id],
      )) as OrderRow[];
      const adjustments = (await queryRunner.query(
        `SELECT "productClientId", "actualQuantity", "adjustedAt", "createdAt" FROM "inventory_adjustments" WHERE "storeId" = $1`,
        [store.id],
      )) as AdjustmentRow[];
      const destructions = (await queryRunner.query(
        `SELECT "productClientId", "quantity", "destroyedAt" FROM "inventory_destructions" WHERE "storeId" = $1`,
        [store.id],
      )) as DestructionRow[];

      const balances = this.calculateSnapshotBalances(
        products,
        productsByName,
        adjustments,
        purchases,
        orders,
        destructions,
        settlementAt,
      );

      for (const [productClientId, quantity] of balances.entries()) {
        await queryRunner.query(
          `INSERT INTO "inventory_settlement_snapshots" ("settlementId", "storeId", "productClientId", "quantity") VALUES ($1, $2, $3, $4) ON CONFLICT ("settlementId", "productClientId") DO UPDATE SET "quantity" = EXCLUDED."quantity"`,
          [latestSettlement.id, store.id, productClientId, quantity],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Data repair only. There is no safe generic rollback for corrected snapshots.
  }

  private calculateSnapshotBalances(
    products: ProductRow[],
    productsByName: Map<string, string>,
    adjustments: AdjustmentRow[],
    purchases: PurchaseRow[],
    orders: OrderRow[],
    destructions: DestructionRow[],
    settlementAt: Date,
  ): Map<string, number> {
    const latestAdjustmentByProduct = this.getLatestAdjustmentByProduct(
      adjustments.filter(
        (adjustment) => this.toDate(adjustment.adjustedAt) <= settlementAt,
      ),
    );
    const balances = new Map<string, number>();
    products.forEach((product) => {
      balances.set(
        product.clientProductId,
        Number(
          latestAdjustmentByProduct.get(product.clientProductId)
            ?.actualQuantity ?? 0,
        ),
      );
    });

    purchases.forEach((purchase) => {
      if (purchase.purchaseKind === 'PAYMENT') {
        return;
      }
      const purchaseOccurredAt = this.toDate(
        purchase.syncedAt ?? purchase.createdAt,
      );
      if (purchaseOccurredAt > settlementAt) {
        return;
      }
      const productClientId = productsByName.get(
        this.normalizeProductKey(purchase.productName),
      );
      if (!productClientId) {
        return;
      }
      const adjustment = latestAdjustmentByProduct.get(productClientId);
      if (!adjustment || purchaseOccurredAt > this.toDate(adjustment.adjustedAt)) {
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + Number(purchase.quantity),
        );
      }
    });

    orders.forEach((order) => {
      const orderedAt = this.toDate(order.orderedAt);
      if (orderedAt > settlementAt) {
        return;
      }
      this.parseOrderItems(order.items).forEach((item) => {
        const productClientId = productsByName.get(
          this.normalizeProductKey(item.productName),
        );
        if (!productClientId) {
          return;
        }
        const adjustment = latestAdjustmentByProduct.get(productClientId);
        if (adjustment && orderedAt <= this.toDate(adjustment.adjustedAt)) {
          return;
        }
        const direction = order.status === 'REFUNDED' ? 1 : -1;
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) +
            Number(item.quantity) * direction,
        );
      });
    });

    destructions.forEach((destruction) => {
      const destroyedAt = this.toDate(destruction.destroyedAt);
      if (destroyedAt > settlementAt) {
        return;
      }
      const adjustment = latestAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (adjustment && destroyedAt <= this.toDate(adjustment.adjustedAt)) {
        return;
      }
      balances.set(
        destruction.productClientId,
        (balances.get(destruction.productClientId) ?? 0) -
          Number(destruction.quantity),
      );
    });

    balances.forEach((quantity, productClientId) => {
      balances.set(productClientId, this.roundQuantity(quantity));
    });
    return balances;
  }

  private getLatestAdjustmentByProduct(
    adjustments: AdjustmentRow[],
  ): Map<string, AdjustmentRow> {
    const result = new Map<string, AdjustmentRow>();
    adjustments
      .sort(
        (a, b) =>
          this.toDate(b.adjustedAt).getTime() -
            this.toDate(a.adjustedAt).getTime() ||
          this.toDate(b.createdAt).getTime() -
            this.toDate(a.createdAt).getTime(),
      )
      .forEach((adjustment) => {
        if (!result.has(adjustment.productClientId)) {
          result.set(adjustment.productClientId, adjustment);
        }
      });
    return result;
  }

  private parseOrderItems(
    items: OrderRow['items'],
  ): Array<{ productName: string; quantity: number }> {
    if (typeof items !== 'string') {
      return items;
    }

    try {
      return JSON.parse(items) as Array<{
        productName: string;
        quantity: number;
      }>;
    } catch {
      return [];
    }
  }

  private normalizeProductKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(3));
  }
}
