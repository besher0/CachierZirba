import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenseSettlementCycleAnchor1793000000000 implements MigrationInterface {
  name = 'AddExpenseSettlementCycleAnchor1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "cycleStartClosureId" character varying(100)`,
    );
    await queryRunner.query(`
      UPDATE "expenses" expense
      SET "cycleStartClosureId" = (
        SELECT settlement."clientClosureId"
        FROM "daily_settlements" settlement
        WHERE settlement."storeId" = expense."storeId"
          AND settlement."createdAt" <= expense."createdAt"
        ORDER BY settlement."createdAt" DESC, settlement."id" DESC
        LIMIT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_expenses_store_cycle_start" ON "expenses" ("storeId", "cycleStartClosureId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_expenses_store_cycle_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "cycleStartClosureId"`,
    );
  }
}
