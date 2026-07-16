import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeePayrollWeekStartDay1792000000000 implements MigrationInterface {
  name = 'AddEmployeePayrollWeekStartDay1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "payrollWeekStartDay" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN IF EXISTS "payrollWeekStartDay"`,
    );
  }
}
