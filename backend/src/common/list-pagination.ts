export const DEFAULT_LIST_LIMIT = 200;
export const MAX_LIST_LIMIT = 500;

export interface ListPaginationQuery {
  limit?: number;
  offset?: number;
}

export function resolveListPagination(query: ListPaginationQuery = {}): {
  limit: number;
  offset: number;
} {
  const requestedLimit =
    query.limit !== undefined && Number.isInteger(query.limit)
      ? query.limit
      : DEFAULT_LIST_LIMIT;
  const requestedOffset =
    query.offset !== undefined && Number.isInteger(query.offset)
      ? query.offset
      : 0;

  return {
    limit: Math.min(Math.max(requestedLimit, 1), MAX_LIST_LIMIT),
    offset: Math.max(requestedOffset, 0),
  };
}
