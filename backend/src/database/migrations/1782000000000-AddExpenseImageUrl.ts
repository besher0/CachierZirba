import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenseImageUrl1782000000000 implements MigrationInterface {
  name = 'AddExpenseImageUrl1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "imageUrl" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP COLUMN IF EXISTS "imageUrl"`,
    );
  }
}
