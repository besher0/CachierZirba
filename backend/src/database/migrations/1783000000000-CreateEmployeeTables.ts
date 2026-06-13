import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeTables1783000000000 implements MigrationInterface {
  name = 'CreateEmployeeTables1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientEmployeeId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "name" character varying(120) NOT NULL, "weeklySalary" real NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_employee_id" UNIQUE ("clientEmployeeId"), CONSTRAINT "PK_employees_id" PRIMARY KEY ("id"), CONSTRAINT "FK_employees_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "employee_absences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientAbsenceId" character varying(100) NOT NULL, "employeeClientId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "absenceDate" character varying(10) NOT NULL, "note" text, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_employee_absence_id" UNIQUE ("clientAbsenceId"), CONSTRAINT "PK_employee_absences_id" PRIMARY KEY ("id"), CONSTRAINT "FK_employee_absences_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "employee_withdrawals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientWithdrawalId" character varying(100) NOT NULL, "employeeClientId" character varying(100) NOT NULL, "storeId" uuid NOT NULL, "amount" real NOT NULL, "withdrawalDate" character varying(10) NOT NULL, "note" text, "syncedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_client_employee_withdrawal_id" UNIQUE ("clientWithdrawalId"), CONSTRAINT "PK_employee_withdrawals_id" PRIMARY KEY ("id"), CONSTRAINT "FK_employee_withdrawals_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "employee_withdrawals"`);
    await queryRunner.query(`DROP TABLE "employee_absences"`);
    await queryRunner.query(`DROP TABLE "employees"`);
  }
}
