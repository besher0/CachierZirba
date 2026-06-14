import { QueryFailedError } from 'typeorm';
import { isUniqueConstraintError } from './is-unique-constraint-error';

describe('isUniqueConstraintError', () => {
  it('recognizes PostgreSQL unique violations', () => {
    const error = new QueryFailedError('INSERT', [], {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });

    expect(isUniqueConstraintError(error)).toBe(true);
  });

  it('recognizes SQLite unique violations', () => {
    const error = new QueryFailedError('INSERT', [], {
      message: 'UNIQUE constraint failed: orders.client_order_id',
    });

    expect(isUniqueConstraintError(error)).toBe(true);
  });

  it('does not classify unrelated query failures as unique violations', () => {
    const error = new QueryFailedError('SELECT', [], {
      code: '08006',
      message: 'connection failure',
    });

    expect(isUniqueConstraintError(error)).toBe(false);
  });
});
