import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillSettlementCycleSnapshots1791000000000 implements MigrationInterface {
  name = 'BackfillSettlementCycleSnapshots1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          ) AS cycle_start
        FROM "daily_settlements" settlement
      ),
      totals AS (
        SELECT
          cycle."id",
          cycle.cycle_start,
          ROUND(COALESCE((
            SELECT SUM(CASE WHEN orders."status" = 'COMPLETED' THEN orders."total" ELSE 0 END)
            FROM "orders" orders
            WHERE orders."storeId" = cycle."storeId"
              AND orders."orderedAt" <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR orders."orderedAt" > cycle.cycle_start)
          ), 0)::numeric, 2)::real AS sales_amount,
          ROUND(COALESCE((
            SELECT SUM(CASE WHEN orders."status" = 'REFUNDED' THEN orders."total" ELSE 0 END)
            FROM "orders" orders
            WHERE orders."storeId" = cycle."storeId"
              AND orders."orderedAt" <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR orders."orderedAt" > cycle.cycle_start)
          ), 0)::numeric, 2)::real AS refund_amount,
          ROUND(COALESCE((
            SELECT SUM(expense."amount")
            FROM "expenses" expense
            WHERE expense."storeId" = cycle."storeId"
              AND LEAST(expense."syncedAt", expense."createdAt") <= cycle."syncedAt"
              AND (
                cycle.cycle_start IS NULL
                OR LEAST(expense."syncedAt", expense."createdAt") > cycle.cycle_start
              )
          ), 0)::numeric, 2)::real AS expenses_amount,
          ROUND(COALESCE((
            SELECT SUM(purchase."totalCost")
            FROM "purchases" purchase
            WHERE purchase."storeId" = cycle."storeId"
              AND LEAST(purchase."syncedAt", purchase."createdAt") <= cycle."syncedAt"
              AND (
                cycle.cycle_start IS NULL
                OR LEAST(purchase."syncedAt", purchase."createdAt") > cycle.cycle_start
              )
          ), 0)::numeric, 2)::real AS purchases_amount,
          ROUND(COALESCE((
            SELECT SUM(CASE WHEN purchase."purchaseKind" = 'TAWASI' THEN purchase."totalCost" ELSE 0 END)
            FROM "purchases" purchase
            WHERE purchase."storeId" = cycle."storeId"
              AND LEAST(purchase."syncedAt", purchase."createdAt") <= cycle."syncedAt"
              AND (
                cycle.cycle_start IS NULL
                OR LEAST(purchase."syncedAt", purchase."createdAt") > cycle.cycle_start
              )
          ), 0)::numeric, 2)::real AS tawasi_amount,
          ROUND(COALESCE((
            SELECT SUM(withdrawal."amount")
            FROM "employee_withdrawals" withdrawal
            WHERE withdrawal."storeId" = cycle."storeId"
              AND withdrawal."createdAt" <= cycle."syncedAt"
              AND (cycle.cycle_start IS NULL OR withdrawal."createdAt" > cycle.cycle_start)
          ), 0)::numeric, 2)::real AS employee_withdrawals_amount
        FROM cycles cycle
      )
      UPDATE "daily_settlements" settlement
      SET
        "cycleStartedAt" = COALESCE(settlement."cycleStartedAt", totals.cycle_start),
        "salesAmount" = COALESCE(settlement."salesAmount", totals.sales_amount),
        "refundAmount" = COALESCE(settlement."refundAmount", totals.refund_amount),
        "expensesAmount" = COALESCE(settlement."expensesAmount", totals.expenses_amount),
        "purchasesAmount" = COALESCE(settlement."purchasesAmount", totals.purchases_amount),
        "tawasiAmount" = COALESCE(settlement."tawasiAmount", totals.tawasi_amount),
        "employeeWithdrawalsAmount" = COALESCE(
          settlement."employeeWithdrawalsAmount",
          totals.employee_withdrawals_amount
        )
      FROM totals
      WHERE settlement."id" = totals."id"
        AND (
          settlement."cycleStartedAt" IS NULL
          OR settlement."salesAmount" IS NULL
          OR settlement."refundAmount" IS NULL
          OR settlement."expensesAmount" IS NULL
          OR settlement."purchasesAmount" IS NULL
          OR settlement."tawasiAmount" IS NULL
          OR settlement."employeeWithdrawalsAmount" IS NULL
        )
    `);
  }

  public async down(): Promise<void> {
    // Data backfills are intentionally not reversed.
  }
}
