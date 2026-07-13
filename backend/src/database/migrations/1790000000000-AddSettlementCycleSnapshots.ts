import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettlementCycleSnapshots1790000000000
  implements MigrationInterface
{
  name = 'AddSettlementCycleSnapshots1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "cycleStartedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "salesAmount" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "refundAmount" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "expensesAmount" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "purchasesAmount" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "tawasiAmount" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" ADD "employeeWithdrawalsAmount" real`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "employeeWithdrawalsAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "tawasiAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "purchasesAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "expensesAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "refundAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "salesAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_settlements" DROP COLUMN "cycleStartedAt"`,
    );
  }
}
