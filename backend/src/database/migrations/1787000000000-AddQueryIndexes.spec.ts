import { QueryRunner } from 'typeorm';
import { AddQueryIndexes1787000000000 } from './1787000000000-AddQueryIndexes';

describe('AddQueryIndexes1787000000000', () => {
  it('creates and removes the query indexes', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new AddQueryIndexes1787000000000();

    await migration.up(queryRunner);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_orders_store_ordered_at'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_purchases_store_date_created'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_expenses_store_expense_date'),
    );

    query.mockClear();
    await migration.down(queryRunner);
    expect(query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "IDX_expenses_store_expense_date"',
    );
    expect(query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "IDX_purchases_store_date_created"',
    );
    expect(query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "IDX_orders_store_ordered_at"',
    );
  });
});
