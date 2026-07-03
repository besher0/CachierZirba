import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCashboxWithdrawals1789000000000
  implements MigrationInterface
{
  name = 'CreateCashboxWithdrawals1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "cashbox_withdrawals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storeId" uuid, "amount" real NOT NULL, "note" text, "withdrawnAt" TIMESTAMP NOT NULL, "createdByUserId" uuid, "createdByDisplayName" character varying(120), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cashbox_withdrawals_id" PRIMARY KEY ("id"), CONSTRAINT "FK_cashbox_withdrawals_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL)`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_cashbox_withdrawals_store_withdrawn" ON "cashbox_withdrawals" ("storeId", "withdrawnAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_cashbox_withdrawals_store_withdrawn"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "cashbox_withdrawals"');
  }
}
