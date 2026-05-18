import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { DailySettlement } from '../daily-settlements/entities/daily-settlement.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Order } from '../orders/entities/order.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Store } from '../stores/entities/store.entity';
import { User } from '../users/entities/user.entity';

type DatabaseConfigOverrides = {
  migrations?: DataSourceOptions['migrations'];
  synchronize?: boolean;
};

const entities = [Store, Order, DailySettlement, Expense, Purchase, User];

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
      migrations,
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

