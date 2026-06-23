import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryDestructions1788000000000
  implements MigrationInterface
{
  name = 'CreateInventoryDestructions1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_destructions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientDestructionId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "productClientId" character varying(100) NOT NULL, "quantity" real NOT NULL, "note" character varying(500), "destroyedAt" TIMESTAMP NOT NULL, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_inventory_destruction_id" UNIQUE ("clientDestructionId"), CONSTRAINT "PK_inventory_destructions_id" PRIMARY KEY ("id"), CONSTRAINT "FK_inventory_destructions_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_destructions_store_product_destroyed" ON "inventory_destructions" ("storeId", "productClientId", "destroyedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_destructions_store_product_destroyed"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_destructions"`);
  }
}
