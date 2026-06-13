import { QueryRunner } from 'typeorm';
import { CorrectPurchaseDatesForDamascus1785000000000 } from './1785000000000-CorrectPurchaseDatesForDamascus';

describe('CorrectPurchaseDatesForDamascus1785000000000', () => {
  it('backs up and corrects legacy UTC purchase dates', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new CorrectPurchaseDatesForDamascus1785000000000();

    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE TABLE IF NOT EXISTS "purchase_date_timezone_corrections"',
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("AT TIME ZONE 'Asia/Damascus'"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "purchases" AS purchase'),
    );
  });

  it('restores the backed-up dates when reverted', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;
    const migration = new CorrectPurchaseDatesForDamascus1785000000000();

    await migration.down(queryRunner);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'SET "purchaseDate" = correction."previousPurchaseDate"',
      ),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'DROP TABLE IF EXISTS "purchase_date_timezone_corrections"',
    );
  });
});
