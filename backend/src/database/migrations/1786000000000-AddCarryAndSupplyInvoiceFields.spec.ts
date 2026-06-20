import { QueryRunner } from 'typeorm';
import { AddCarryAndSupplyInvoiceFields1786000000000 } from './1786000000000-AddCarryAndSupplyInvoiceFields';

describe('AddCarryAndSupplyInvoiceFields1786000000000', () => {
  it('adds carry, tawasi, and supply payment fields and backfills carry', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new AddCarryAndSupplyInvoiceFields1786000000000();

    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"cashCarryAmount"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"carryInAmount"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"purchaseKind"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "stores"'),
    );
  });

  it('removes the added fields when reverted', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new AddCarryAndSupplyInvoiceFields1786000000000();

    await migration.down(queryRunner);

    expect(query).toHaveBeenLastCalledWith(
      'ALTER TABLE "stores" DROP COLUMN IF EXISTS "cashCarryAmount"',
    );
  });
});
