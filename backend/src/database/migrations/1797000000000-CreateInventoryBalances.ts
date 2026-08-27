import { MigrationInterface, QueryRunner } from 'typeorm';

type ProductRow = {
  clientProductId: string;
  name: string;
};

type PurchaseRow = {
  productName: string;
  quantity: number;
  purchaseKind: string;
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

export class CreateInventoryBalances1797000000000
  implements MigrationInterface
{
  name = 'CreateInventoryBalances1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storeId" uuid NOT NULL, "productClientId" character varying(100) NOT NULL, "quantity" real NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_inventory_balances_store_product" UNIQUE ("storeId", "productClientId"), CONSTRAINT "PK_inventory_balances_id" PRIMARY KEY ("id"), CONSTRAINT "FK_inventory_balances_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_balances_store_product" ON "inventory_balances" ("storeId", "productClientId")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_settlement_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "settlementId" uuid NOT NULL, "storeId" uuid NOT NULL, "productClientId" character varying(100) NOT NULL, "quantity" real NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_inventory_snapshot_settlement_product" UNIQUE ("settlementId", "productClientId"), CONSTRAINT "PK_inventory_settlement_snapshots_id" PRIMARY KEY ("id"), CONSTRAINT "FK_inventory_snapshots_settlement" FOREIGN KEY ("settlementId") REFERENCES "daily_settlements"("id") ON DELETE CASCADE, CONSTRAINT "FK_inventory_snapshots_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_snapshots_store_settlement" ON "inventory_settlement_snapshots" ("storeId", "settlementId")`,
    );

    await this.backfillBalances(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_snapshots_store_settlement"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "inventory_settlement_snapshots"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_balances_store_product"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_balances"`);
  }

  private async backfillBalances(queryRunner: QueryRunner): Promise<void> {
    const products = await queryRunner.query(
      `SELECT "clientProductId", "name" FROM "products" ORDER BY "name" ASC, "createdAt" ASC`,
    ) as ProductRow[];
    const stores = await queryRunner.query(`SELECT "id" FROM "stores"`) as Array<{
      id: string;
    }>;
    const productsByName = new Map(
      products.map((product) => [
        this.normalizeProductKey(product.name),
        product.clientProductId,
      ]),
    );

    for (const store of stores) {
      const purchases = (await queryRunner.query(
        `SELECT "productName", "quantity", "purchaseKind", "createdAt" FROM "purchases" WHERE "storeId" = $1`,
        [store.id],
      )) as PurchaseRow[];
      const orders = (await queryRunner.query(
        `SELECT "status", "items", "orderedAt" FROM "orders" WHERE "storeId" = $1`,
        [store.id],
      )) as OrderRow[];
      const adjustments = (await queryRunner.query(
        `SELECT "productClientId", "actualQuantity", "adjustedAt", "createdAt" FROM "inventory_adjustments" WHERE "storeId" = $1 ORDER BY "adjustedAt" DESC, "createdAt" DESC`,
        [store.id],
      )) as AdjustmentRow[];
      const destructions = (await queryRunner.query(
        `SELECT "productClientId", "quantity", "destroyedAt" FROM "inventory_destructions" WHERE "storeId" = $1`,
        [store.id],
      )) as DestructionRow[];
      const latestSettlements = (await queryRunner.query(
        `SELECT "id", "storeId", "syncedAt", "createdAt" FROM "daily_settlements" WHERE "storeId" = $1 ORDER BY "businessDate" DESC, "syncedAt" DESC, "createdAt" DESC LIMIT 1`,
        [store.id],
      )) as SettlementRow[];

      const latestAdjustmentByProduct =
        this.getLatestAdjustmentByProduct(adjustments);
      const balances = this.calculateCurrentBalances(
        products,
        productsByName,
        latestAdjustmentByProduct,
        purchases,
        orders,
        destructions,
      );

      for (const [productClientId, quantity] of balances.entries()) {
        await queryRunner.query(
          `INSERT INTO "inventory_balances" ("storeId", "productClientId", "quantity") VALUES ($1, $2, $3) ON CONFLICT ("storeId", "productClientId") DO UPDATE SET "quantity" = EXCLUDED."quantity", "updatedAt" = now()`,
          [store.id, productClientId, quantity],
        );
      }

      const latestSettlement = latestSettlements[0] ?? null;
      if (!latestSettlement) {
        continue;
      }

      const latestSettlementAt = latestSettlement.syncedAt
        ? new Date(latestSettlement.syncedAt)
        : new Date(latestSettlement.createdAt);
      const snapshotBalances = this.calculateSettlementSnapshotBalances(
        products,
        productsByName,
        adjustments,
        purchases,
        orders,
        destructions,
        latestSettlementAt,
      );

      for (const [productClientId, quantity] of snapshotBalances.entries()) {
        await queryRunner.query(
          `INSERT INTO "inventory_settlement_snapshots" ("settlementId", "storeId", "productClientId", "quantity") VALUES ($1, $2, $3, $4) ON CONFLICT ("settlementId", "productClientId") DO UPDATE SET "quantity" = EXCLUDED."quantity"`,
          [latestSettlement.id, store.id, productClientId, quantity],
        );
      }
    }
  }

  private calculateCurrentBalances(
    products: ProductRow[],
    productsByName: Map<string, string>,
    latestAdjustmentByProduct: Map<string, AdjustmentRow>,
    purchases: PurchaseRow[],
    orders: OrderRow[],
    destructions: DestructionRow[],
  ): Map<string, number> {
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
      const productClientId = productsByName.get(
        this.normalizeProductKey(purchase.productName),
      );
      if (!productClientId) {
        return;
      }
      const adjustment = latestAdjustmentByProduct.get(productClientId);
      if (!adjustment || new Date(purchase.createdAt) > new Date(adjustment.adjustedAt)) {
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + Number(purchase.quantity),
        );
      }
    });

    orders.forEach((order) => {
      this.parseOrderItems(order.items).forEach((item) => {
        const productClientId = productsByName.get(
          this.normalizeProductKey(item.productName),
        );
        if (!productClientId) {
          return;
        }
        const adjustment = latestAdjustmentByProduct.get(productClientId);
        if (adjustment && new Date(order.orderedAt) <= new Date(adjustment.adjustedAt)) {
          return;
        }
        const direction = order.status === 'REFUNDED' ? 1 : -1;
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + Number(item.quantity) * direction,
        );
      });
    });

    destructions.forEach((destruction) => {
      const adjustment = latestAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (
        adjustment &&
        new Date(destruction.destroyedAt) <= new Date(adjustment.adjustedAt)
      ) {
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

  private calculateSettlementSnapshotBalances(
    products: ProductRow[],
    productsByName: Map<string, string>,
    adjustments: AdjustmentRow[],
    purchases: PurchaseRow[],
    orders: OrderRow[],
    destructions: DestructionRow[],
    settlementAt: Date,
  ): Map<string, number> {
    const settlementAdjustmentByProduct = this.getLatestAdjustmentByProduct(
      adjustments.filter(
        (adjustment) => new Date(adjustment.adjustedAt) <= settlementAt,
      ),
    );
    const balances = new Map<string, number>();
    products.forEach((product) => {
      balances.set(
        product.clientProductId,
        Number(
          settlementAdjustmentByProduct.get(product.clientProductId)
            ?.actualQuantity ?? 0,
        ),
      );
    });

    purchases.forEach((purchase) => {
      if (purchase.purchaseKind === 'PAYMENT' || new Date(purchase.createdAt) > settlementAt) {
        return;
      }
      const productClientId = productsByName.get(
        this.normalizeProductKey(purchase.productName),
      );
      if (!productClientId) {
        return;
      }
      const adjustment = settlementAdjustmentByProduct.get(productClientId);
      if (!adjustment || new Date(purchase.createdAt) > new Date(adjustment.adjustedAt)) {
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + Number(purchase.quantity),
        );
      }
    });

    orders.forEach((order) => {
      if (new Date(order.orderedAt) > settlementAt) {
        return;
      }
      this.parseOrderItems(order.items).forEach((item) => {
        const productClientId = productsByName.get(
          this.normalizeProductKey(item.productName),
        );
        if (!productClientId) {
          return;
        }
        const adjustment = settlementAdjustmentByProduct.get(productClientId);
        if (adjustment && new Date(order.orderedAt) <= new Date(adjustment.adjustedAt)) {
          return;
        }
        const direction = order.status === 'REFUNDED' ? 1 : -1;
        balances.set(
          productClientId,
          (balances.get(productClientId) ?? 0) + Number(item.quantity) * direction,
        );
      });
    });

    destructions.forEach((destruction) => {
      if (new Date(destruction.destroyedAt) > settlementAt) {
        return;
      }
      const adjustment = settlementAdjustmentByProduct.get(
        destruction.productClientId,
      );
      if (
        adjustment &&
        new Date(destruction.destroyedAt) <= new Date(adjustment.adjustedAt)
      ) {
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
          new Date(b.adjustedAt).getTime() -
            new Date(a.adjustedAt).getTime() ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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

  private roundQuantity(value: number): number {
    return Number(value.toFixed(3));
  }
}
