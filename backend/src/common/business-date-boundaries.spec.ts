import {
  toBusinessDayEndBoundary,
  toBusinessDayStartBoundary,
  toDateOnly,
} from './business-date-boundaries';

describe('business date boundaries', () => {
  it('converts date-only ranges to full Damascus business days in UTC', () => {
    expect(toBusinessDayStartBoundary('2026-09-01')).toBe(
      '2026-08-31T21:00:00.000Z',
    );
    expect(toBusinessDayEndBoundary('2026-09-12')).toBe(
      '2026-09-12T20:59:59.999Z',
    );
  });

  it('keeps explicit date-time filters unchanged', () => {
    expect(toBusinessDayStartBoundary('2026-09-01T10:15:00.000Z')).toBe(
      '2026-09-01T10:15:00.000Z',
    );
    expect(toBusinessDayEndBoundary('2026-09-12T18:30:00.000Z')).toBe(
      '2026-09-12T18:30:00.000Z',
    );
  });

  it('normalizes date-only values for purchase-date filters', () => {
    expect(toDateOnly('2026-09-01T10:15:00.000Z')).toBe('2026-09-01');
    expect(toDateOnly('2026-09-12')).toBe('2026-09-12');
  });
});
