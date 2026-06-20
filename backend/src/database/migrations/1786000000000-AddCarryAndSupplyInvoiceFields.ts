import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCarryAndSupplyInvoiceFields1786000000000 implements MigrationInterface {
  name = 'AddCarryAndSupplyInvoiceFields1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "cashCarryAmount" real NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "carryInAmount" real NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "purchaseKind" character varying(20) NOT NULL DEFAULT 'SUPPLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "sellPrice" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paymentAmount" real NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "stores" AS store SET "cashCarryAmount" = COALESCE((SELECT GREATEST(settlement."actualRemainingAmount" - settlement."cashBoxAmount" - settlement."sharesAmount", 0) FROM "daily_settlements" AS settlement WHERE settlement."storeId" = store."id" ORDER BY settlement."businessDate" DESC, settlement."syncedAt" DESC LIMIT 1), 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP COLUMN IF EXISTS "paymentAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP COLUMN IF EXISTS "sellPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP COLUMN IF EXISTS "purchaseKind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "carryInAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" DROP COLUMN IF EXISTS "cashCarryAmount"`,
    );
  }
}
