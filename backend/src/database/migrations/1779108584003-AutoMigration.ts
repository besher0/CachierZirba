import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1779108584003 implements MigrationInterface {
    name = 'AutoMigration1779108584003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientExpenseId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "expenseDate" character varying(10) NOT NULL, "category" character varying(40) NOT NULL, "description" character varying(300) NOT NULL, "amount" real NOT NULL, "note" text, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_expense_id" UNIQUE ("clientExpenseId"), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientPurchaseId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "productName" character varying(120) NOT NULL, "quantity" real NOT NULL, "unitCost" real NOT NULL, "totalCost" real NOT NULL, "purchaseDate" character varying(10) NOT NULL, "note" text, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_purchase_id" UNIQUE ("clientPurchaseId"), CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_4dfda4b7af7b7dac0abec73bf3f" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "FK_d849ecc4c79f81d130ad33d6eb3" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_d849ecc4c79f81d130ad33d6eb3"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_4dfda4b7af7b7dac0abec73bf3f"`);
        await queryRunner.query(`DROP TABLE "purchases"`);
        await queryRunner.query(`DROP TABLE "expenses"`);
    }

}
