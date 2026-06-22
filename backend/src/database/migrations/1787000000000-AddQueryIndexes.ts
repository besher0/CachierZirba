import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueryIndexes1787000000000 implements MigrationInterface {
  name = 'AddQueryIndexes1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_orders_store_ordered_at" ON "orders" ("storeId", "orderedAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_purchases_store_date_created" ON "purchases" ("storeId", "purchaseDate", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_expenses_store_expense_date" ON "expenses" ("storeId", "expenseDate")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_expenses_store_expense_date"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_purchases_store_date_created"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_orders_store_ordered_at"',
    );
  }
}
