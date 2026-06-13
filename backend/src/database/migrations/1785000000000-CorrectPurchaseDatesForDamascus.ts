import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorrectPurchaseDatesForDamascus1785000000000 implements MigrationInterface {
  name = 'CorrectPurchaseDatesForDamascus1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "purchase_date_timezone_corrections" ("purchaseId" uuid NOT NULL, "previousPurchaseDate" character varying(10) NOT NULL, "correctedPurchaseDate" character varying(10) NOT NULL, CONSTRAINT "PK_purchase_date_timezone_corrections" PRIMARY KEY ("purchaseId"), CONSTRAINT "FK_purchase_date_timezone_corrections_purchase" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `INSERT INTO "purchase_date_timezone_corrections" ("purchaseId", "previousPurchaseDate", "correctedPurchaseDate") SELECT "id", "purchaseDate", to_char("syncedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Damascus', 'YYYY-MM-DD') FROM "purchases" WHERE "purchaseDate" = to_char("syncedAt", 'YYYY-MM-DD') AND "purchaseDate" <> to_char("syncedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Damascus', 'YYYY-MM-DD') ON CONFLICT ("purchaseId") DO NOTHING`,
    );
    await queryRunner.query(
      `UPDATE "purchases" AS purchase SET "purchaseDate" = correction."correctedPurchaseDate" FROM "purchase_date_timezone_corrections" AS correction WHERE purchase."id" = correction."purchaseId" AND purchase."purchaseDate" = correction."previousPurchaseDate"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "purchases" AS purchase SET "purchaseDate" = correction."previousPurchaseDate" FROM "purchase_date_timezone_corrections" AS correction WHERE purchase."id" = correction."purchaseId" AND purchase."purchaseDate" = correction."correctedPurchaseDate"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "purchase_date_timezone_corrections"`,
    );
  }
}
