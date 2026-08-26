import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailySettlementLatestIndex1795000000000
  implements MigrationInterface
{
  name = 'AddDailySettlementLatestIndex1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_daily_settlements_store_latest" ON "daily_settlements" ("storeId", "businessDate", "syncedAt", "createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_daily_settlements_store_latest"',
    );
  }
}
