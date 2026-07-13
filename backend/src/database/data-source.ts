import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createTypeOrmOptions } from './typeorm.config';

const options = createTypeOrmOptions({
  synchronize: false,
  migrations: ['src/database/migrations/*{.ts,.js}'],
});

if (options.type !== 'postgres') {
  throw new Error(
    'PostgreSQL migration datasource requires DATABASE_URL. Set DATABASE_URL before running migration commands.',
  );
}

const dataSource = new DataSource(options as ConstructorParameters<typeof DataSource>[0]);

export default dataSource;
