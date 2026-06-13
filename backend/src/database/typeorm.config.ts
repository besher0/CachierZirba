import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { CreateEmployeeTables1783000000000 } from './migrations/1783000000000-CreateEmployeeTables';
import { Expense } from '../expenses/entities/expense.entity';
import { EmployeeAbsence } from '../employees/entities/employee-absence.entity';
import { EmployeeWithdrawal } from '../employees/entities/employee-withdrawal.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Store } from '../stores/entities/store.entity';
import { User } from '../users/entities/user.entity';

type DatabaseConfigOverrides = {
  migrations?: DataSourceOptions['migrations'];
  synchronize?: boolean;
};

const entities = [
  Store,
  Order,
  DailySettlement,
  Expense,
  Purchase,
  Product,
  User,
  Employee,
  EmployeeAbsence,
  EmployeeWithdrawal,
];

export function createTypeOrmOptions(
  overrides: DatabaseConfigOverrides = {},
): TypeOrmModuleOptions {
  const synchronize = overrides.synchronize ?? process.env.TYPEORM_SYNCHRONIZE !== 'false';
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const migrations = overrides.migrations;

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      entities,
      migrations: migrations ?? [CreateEmployeeTables1783000000000],
      migrationsRun: migrations === undefined,
      synchronize,
    };
  }

  return {
    type: 'sqlite',
    database: process.env.SQLITE_DB_PATH ?? 'zirba.db',
    entities,
    migrations,
    synchronize,
  };
}
