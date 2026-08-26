import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardAggregationIndexes1796000000000
  implements MigrationInterface
{
  name = 'AddDashboardAggregationIndexes1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_orders_ordered_at_store" ON "orders" ("orderedAt", "storeId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_daily_settlements_business_date_store" ON "daily_settlements" ("businessDate", "storeId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_cashbox_withdrawals_withdrawn_at" ON "cashbox_withdrawals" ("withdrawnAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_cashbox_withdrawals_withdrawn_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_daily_settlements_business_date_store"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_orders_ordered_at_store"');
  }
}
