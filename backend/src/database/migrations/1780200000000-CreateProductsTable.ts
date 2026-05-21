import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductsTable1780200000000 implements MigrationInterface {
  name = 'CreateProductsTable1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientProductId" character varying(100) NOT NULL, "name" character varying(120) NOT NULL, "unitType" character varying(10) NOT NULL, "price" real NOT NULL, "costPrice" real NOT NULL, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_product_id" UNIQUE ("clientProductId"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
