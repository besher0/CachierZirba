import {
  CreateOrderPayload,
  LocalOrder,
  LocalProduct,
  SyncJob,
} from "../types";
import { PieceStockAuditRow } from "../models/settlement";

interface BuildSettlementAdjustmentOrdersParams {
  adjustmentRows: PieceStockAuditRow[];
  products: LocalProduct[];
  storeId: string;
  cashierName: string;
  createdAt: string;
  makeId: (prefix: string) => string;
}

interface SettlementAdjustmentOrdersResult {
  adjustmentRecords: LocalOrder[];
  adjustmentJobs: SyncJob[];
}

export function buildSettlementAdjustmentOrders({
  adjustmentRows,
  products,
  storeId,
  cashierName,
  createdAt,
  makeId,
}: BuildSettlementAdjustmentOrdersParams): SettlementAdjustmentOrdersResult {
  const adjustmentRecords: LocalOrder[] = [];
  const adjustmentJobs: SyncJob[] = [];

  adjustmentRows.forEach((row) => {
    if (row.diffQty === null) {
      return;
    }

    const product = products.find((entry) => entry.id === row.productId);
    if (!product || product.price <= 0) {
      return;
    }

    const quantity = Number(Math.abs(row.diffQty).toFixed(3));
    if (quantity <= 0) {
      return;
    }

    const status = row.diffQty > 0 ? "REFUNDED" : "COMPLETED";
    const clientOrderId = makeId("audit");
    const totalAmount = Number((quantity * product.price).toFixed(2));
    const orderPayload: CreateOrderPayload = {
      clientOrderId,
      storeId,
      cashierName,
      status,
      paymentMethod: "CASH",
      subtotal: totalAmount,
      discount: 0,
      tax: 0,
      total: totalAmount,
      orderedAt: createdAt,
      note: `\u062a\u0633\u0648\u064a\u0629 \u062c\u0631\u062f \u062a\u0644\u0642\u0627\u0626\u064a\u0629 (${row.diffQty > 0 ? "\u0625\u0631\u062c\u0627\u0639" : "\u0628\u064a\u0639"})`,
      items: [
        {
          productName: product.name,
          quantity,
          unitPrice: product.price,
          lineTotal: totalAmount,
        },
      ],
    };

    adjustmentRecords.push({
      ...orderPayload,
      synced: false,
      createdLocallyAt: createdAt,
    });
    adjustmentJobs.push({
      id: makeId("job"),
      referenceId: clientOrderId,
      retries: 0,
      createdAt,
      entity: "ORDER",
      action: "CREATE",
      payload: orderPayload,
    });
  });

  return { adjustmentRecords, adjustmentJobs };
}
