import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettlementArchiveSnapshots1794000000000
  implements MigrationInterface
{
  name = 'AddSettlementArchiveSnapshots1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "ordersCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "expensesCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "purchasesCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "withdrawalsCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD COLUMN IF NOT EXISTS "paymentsAmount" real`,
    );

    await queryRunner.query(`
      WITH cycles AS (
        SELECT
          settlement."id",
          settlement."storeId",
          settlement."syncedAt",
          COALESCE(
            settlement."cycleStartedAt",
            LAG(settlement."syncedAt") OVER (
              PARTITION BY settlement."storeId"
              ORDER BY settlement."syncedAt" ASC, settlement."createdAt" ASC, settlement."id" ASC
            )
          ) AS cycle_start,
          LAG(settlement."clientClosureId") OVER (
            PARTITION BY settlement."storeId"
            ORDER BY settlement."syncedAt" ASC, settlement."createdAt" ASC, settlement."id" ASC
          ) AS previous_closure_id
        FROM "daily_settlements" settlement
      ),
      totals AS (
        SELECT
          cycle."id",
          (
            SELECT COUNT(orders."id")
            FROM "orders" orders
            WHERE orders."storeId" = cycle."storeId"
              AND orders."orderedAt" <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR orders."orderedAt" > cycle.cycle_start)
          )::integer AS orders_count,
          (
            SELECT COUNT(expense."id")
            FROM "expenses" expense
            WHERE expense."storeId" = cycle."storeId"
              AND (
                (
                  cycle.previous_closure_id IS NOT NULL
                  AND expense."cycleStartClosureId" = cycle.previous_closure_id
                )
                OR (
                  cycle.previous_closure_id IS NULL
                  AND expense."cycleStartClosureId" IS NULL
                  AND LEAST(expense."syncedAt", expense."createdAt") <= cycle."syncedAt"
                  AND (
                    cycle.cycle_start IS NULL
                    OR LEAST(expense."syncedAt", expense."createdAt") > cycle.cycle_start
                  )
                )
              )
          )::integer AS expenses_count,
          (
            SELECT COUNT(purchase."id")
            FROM "purchases" purchase
            WHERE purchase."storeId" = cycle."storeId"
              AND purchase."purchaseKind" <> 'PAYMENT'
              AND LEAST(purchase."syncedAt", purchase."createdAt") <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR LEAST(purchase."syncedAt", purchase."createdAt") > cycle.cycle_start)
          )::integer AS purchases_count,
          (
            SELECT COUNT(withdrawal."id")
            FROM "employee_withdrawals" withdrawal
            WHERE withdrawal."storeId" = cycle."storeId"
              AND withdrawal."createdAt" <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR withdrawal."createdAt" > cycle.cycle_start)
          )::integer AS withdrawals_count,
          ROUND(COALESCE((
            SELECT SUM(purchase."paymentAmount")
            FROM "purchases" purchase
            WHERE purchase."storeId" = cycle."storeId"
              AND LEAST(purchase."syncedAt", purchase."createdAt") <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR LEAST(purchase."syncedAt", purchase."createdAt") > cycle.cycle_start)
          ), 0)::numeric, 2)::real AS payments_amount
        FROM cycles cycle
      )
      UPDATE "daily_settlements" settlement
      SET
        "ordersCount" = COALESCE(settlement."ordersCount", totals.orders_count),
        "expensesCount" = COALESCE(settlement."expensesCount", totals.expenses_count),
        "purchasesCount" = COALESCE(settlement."purchasesCount", totals.purchases_count),
        "withdrawalsCount" = COALESCE(settlement."withdrawalsCount", totals.withdrawals_count),
        "paymentsAmount" = COALESCE(settlement."paymentsAmount", totals.payments_amount)
      FROM totals
      WHERE settlement."id" = totals."id"
        AND (
          settlement."ordersCount" IS NULL
          OR settlement."expensesCount" IS NULL
          OR settlement."purchasesCount" IS NULL
          OR settlement."withdrawalsCount" IS NULL
          OR settlement."paymentsAmount" IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "paymentsAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "withdrawalsCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "purchasesCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "expensesCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN IF EXISTS "ordersCount"`,
    );
  }
}
