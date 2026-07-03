import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { CashboxWithdrawal } from '../admin/entities/cashbox-withdrawal.entity';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { CreateEmployeeTables1783000000000 } from './migrations/1783000000000-CreateEmployeeTables';
import { CreateInventoryAdjustments1784000000000 } from './migrations/1784000000000-CreateInventoryAdjustments';
import { CorrectPurchaseDatesForDamascus1785000000000 } from './migrations/1785000000000-CorrectPurchaseDatesForDamascus';
import { AddCarryAndSupplyInvoiceFields1786000000000 } from './migrations/1786000000000-AddCarryAndSupplyInvoiceFields';
import { AddQueryIndexes1787000000000 } from './migrations/1787000000000-AddQueryIndexes';
import { Expense } from '../expenses/entities/expense.entity';
import { EmployeeAbsence } from '../employees/entities/employee-absence.entity';
import { EmployeeWithdrawal } from '../employees/entities/employee-withdrawal.entity';
import { Employee } from '../employees/entities/employee.entity';
import { InventoryAdjustment } from '../inventory-adjustments/entities/inventory-adjustment.entity';
import { InventoryDestruction } from '../inventory-destructions/entities/inventory-destruction.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Store } from '../stores/entities/store.entity';
import { User } from '../users/entities/user.entity';
import { CreateInventoryDestructions1788000000000 } from './migrations/1788000000000-CreateInventoryDestructions';
import { CreateCashboxWithdrawals1789000000000 } from './migrations/1789000000000-CreateCashboxWithdrawals';

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
  InventoryAdjustment,
  InventoryDestruction,
  CashboxWithdrawal,
];

export function createTypeOrmOptions(
  overrides: DatabaseConfigOverrides = {},
): TypeOrmModuleOptions {
  const synchronize =
    overrides.synchronize ?? process.env.TYPEORM_SYNCHRONIZE !== 'false';
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const migrations = overrides.migrations;

  if (!databaseUrl && process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL is required in production. Configure PostgreSQL before starting the API.',
    );
  }

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      entities,
      migrations: migrations ?? [
        CreateEmployeeTables1783000000000,
        CreateInventoryAdjustments1784000000000,
        CorrectPurchaseDatesForDamascus1785000000000,
        AddCarryAndSupplyInvoiceFields1786000000000,
        AddQueryIndexes1787000000000,
        CreateInventoryDestructions1788000000000,
        CreateCashboxWithdrawals1789000000000,
      ],
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
