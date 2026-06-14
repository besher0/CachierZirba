import { QueryFailedError } from 'typeorm';

export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const candidate = error as QueryFailedError & {
    code?: string;
    message?: string;
  };
  return (
    candidate.code === '23505' ||
    candidate.message?.includes('UNIQUE constraint failed') === true
  );
}
