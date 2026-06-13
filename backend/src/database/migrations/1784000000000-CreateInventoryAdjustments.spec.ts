import { QueryRunner } from 'typeorm';
import { CreateInventoryAdjustments1784000000000 } from './1784000000000-CreateInventoryAdjustments';

describe('CreateInventoryAdjustments1784000000000', () => {
  it('creates and removes the inventory adjustment schema', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new CreateInventoryAdjustments1784000000000();

    await migration.up(queryRunner);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE TABLE IF NOT EXISTS "inventory_adjustments"',
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE INDEX IF NOT EXISTS "IDX_inventory_adjustments_store_product_adjusted"',
      ),
    );

    query.mockClear();
    await migration.down(queryRunner);
    expect(query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "IDX_inventory_adjustments_store_product_adjusted"',
    );
    expect(query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "inventory_adjustments"',
    );
  });
});
