export const SYNC_RETRY_BASE_DELAY_MS = 10000;
export const SYNC_RETRY_MAX_DELAY_MS = 300000;

export function getNextSyncRetryDelayMs(currentDelayMs: number): number {
  const normalizedDelay = Math.max(currentDelayMs, SYNC_RETRY_BASE_DELAY_MS);
  return Math.min(normalizedDelay * 2, SYNC_RETRY_MAX_DELAY_MS);
}
