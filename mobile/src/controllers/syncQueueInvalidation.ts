import type { SyncJob } from "../types";

export interface SyncInvalidationPlan {
  keys: string[];
  prefixes: string[];
}

type SyncPayloadWithStore = {
  storeId?: string | null;
};

function addStoreResource(
  keys: Set<string>,
  resource: string,
  storeId: string | null | undefined,
) {
  if (storeId) {
    keys.add(`${resource}:${storeId}`);
  }
}

function addStorePrefix(
  prefixes: Set<string>,
  resource: string,
  storeId: string | null | undefined,
) {
  if (storeId) {
    prefixes.add(`${resource}:${storeId}:`);
  }
}

export function getSyncInvalidationPlan(
  job: SyncJob,
  fallbackStoreId?: string | null,
): SyncInvalidationPlan {
  const entity = job.entity ?? job.type;
  const payload = job.payload as SyncPayloadWithStore | undefined;
  const storeId = payload?.storeId ?? fallbackStoreId ?? null;
  const keys = new Set<string>();
  const prefixes = new Set<string>();

  switch (entity) {
    case "ORDER":
      addStoreResource(keys, "orders", storeId);
      addStoreResource(keys, "settlement", storeId);
      prefixes.add("dashboard:");
      addStorePrefix(prefixes, "product-sales", storeId);
      break;

    case "DAILY_SETTLEMENT":
      addStoreResource(keys, "settlement", storeId);
      keys.add("stores:global");
      prefixes.add("dashboard:");
      break;

    case "EXPENSE":
      addStoreResource(keys, "expenses", storeId);
      addStoreResource(keys, "settlement", storeId);
      break;

    case "PURCHASE":
      addStoreResource(keys, "inventory", storeId);
      addStoreResource(keys, "settlement", storeId);
      break;

    case "PRODUCT":
      keys.add("products:global");
      break;

    case "INVENTORY_ADJUSTMENT":
    case "INVENTORY_DESTRUCTION":
      addStoreResource(keys, "inventory", storeId);
      addStoreResource(keys, "settlement", storeId);
      break;

    case "EMPLOYEE":
    case "EMPLOYEE_ABSENCE":
      addStoreResource(keys, "employees", storeId);
      break;

    case "EMPLOYEE_WITHDRAWAL":
      addStoreResource(keys, "employees", storeId);
      addStoreResource(keys, "settlement", storeId);
      break;
  }

  return {
    keys: Array.from(keys).sort(),
    prefixes: Array.from(prefixes).sort(),
  };
}
