import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryAdjustments1784000000000 implements MigrationInterface {
  name = 'CreateInventoryAdjustments1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_adjustments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientAdjustmentId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "productClientId" character varying(100) NOT NULL, "actualQuantity" real NOT NULL, "adjustedAt" TIMESTAMP NOT NULL, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_inventory_adjustment_id" UNIQUE ("clientAdjustmentId"), CONSTRAINT "PK_inventory_adjustments_id" PRIMARY KEY ("id"), CONSTRAINT "FK_inventory_adjustments_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_adjustments_store_product_adjusted" ON "inventory_adjustments" ("storeId", "productClientId", "adjustedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_adjustments_store_product_adjusted"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_adjustments"`);
  }
}
