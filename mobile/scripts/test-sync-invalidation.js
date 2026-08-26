const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const { getSyncInvalidationPlan } = require(path.join(
  __dirname,
  "../src/controllers/syncQueueInvalidation.ts",
));
const {
  getNextSyncRetryDelayMs,
  SYNC_RETRY_BASE_DELAY_MS,
  SYNC_RETRY_MAX_DELAY_MS,
} = require(path.join(__dirname, "../src/controllers/syncQueueRetry.ts"));

function job(entity, action = "CREATE", payload = { storeId: "store-1" }) {
  return {
    id: `${entity}:${action}`,
    referenceId: "ref-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    retries: 0,
    entity,
    action,
    payload,
  };
}

assert.deepEqual(getSyncInvalidationPlan(job("ORDER", "CREATE")), {
  keys: ["orders:store-1", "settlement:store-1"],
  prefixes: ["dashboard:", "product-sales:store-1:"],
});

assert.deepEqual(getSyncInvalidationPlan(job("EXPENSE", "UPDATE")), {
  keys: ["expenses:store-1", "settlement:store-1"],
  prefixes: [],
});

assert.deepEqual(getSyncInvalidationPlan(job("EXPENSE", "DELETE")), {
  keys: ["expenses:store-1", "settlement:store-1"],
  prefixes: [],
});

assert.deepEqual(getSyncInvalidationPlan(job("PURCHASE", "CREATE")), {
  keys: ["inventory:store-1", "settlement:store-1"],
  prefixes: [],
});

assert.deepEqual(getSyncInvalidationPlan(job("PURCHASE", "DELETE")), {
  keys: ["inventory:store-1", "settlement:store-1"],
  prefixes: [],
});

assert.deepEqual(getSyncInvalidationPlan(job("EMPLOYEE", "CREATE")), {
  keys: ["employees:store-1"],
  prefixes: [],
});

assert.deepEqual(
  getSyncInvalidationPlan(job("EMPLOYEE_WITHDRAWAL", "DELETE")),
  {
    keys: ["employees:store-1", "settlement:store-1"],
    prefixes: [],
  },
);

assert.deepEqual(getSyncInvalidationPlan(job("PRODUCT", "UPDATE")), {
  keys: ["products:global"],
  prefixes: [],
});

assert.equal(getNextSyncRetryDelayMs(SYNC_RETRY_BASE_DELAY_MS), 20000);
assert.equal(getNextSyncRetryDelayMs(20000), 40000);
assert.equal(
  getNextSyncRetryDelayMs(SYNC_RETRY_MAX_DELAY_MS),
  SYNC_RETRY_MAX_DELAY_MS,
);

console.log("sync invalidation tests passed");
