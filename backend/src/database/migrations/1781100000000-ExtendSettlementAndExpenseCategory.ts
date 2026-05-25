import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendSettlementAndExpenseCategory1781100000000 implements MigrationInterface {
  name = 'ExtendSettlementAndExpenseCategory1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ALTER COLUMN "category" TYPE character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "actualRemainingAmount" real NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "actualRemainingAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ALTER COLUMN "category" TYPE character varying(40)`,
    );
  }
}

