import { QueryRunner } from 'typeorm';
import { CreateInventoryDestructions1788000000000 } from './1788000000000-CreateInventoryDestructions';

describe('CreateInventoryDestructions1788000000000', () => {
  it('creates and removes the inventory destruction schema', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new CreateInventoryDestructions1788000000000();

    await migration.up(queryRunner);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "inventory_destructions"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE INDEX IF NOT EXISTS "IDX_inventory_destructions_store_product_destroyed"',
      ),
    );

    query.mockClear();
    await migration.down(queryRunner);
    expect(query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "IDX_inventory_destructions_store_product_destroyed"',
    );
    expect(query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "inventory_destructions"',
    );
  });
});
