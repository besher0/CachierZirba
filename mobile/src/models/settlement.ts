import { ProductTemplate } from "../types";

export interface PieceStockAuditInput {
  productId: string;
  name: string;
  unitType: ProductTemplate["unitType"];
  sellPrice: number;
  remainingQty: number;
}

export interface PieceStockAuditRow {
  productId: string;
  productName: string;
  expectedQty: number;
  actualQty: number | null;
  diffQty: number | null;
  unitPrice: number;
  adjustmentAmount: number | null;
}

export function getExpectedSettlementCarryForwardAmount(
  expectedRevenue: number,
  cashBoxAmount: number,
  sharesAmount: number,
): number {
  return Number(Math.max(expectedRevenue - cashBoxAmount - sharesAmount, 0).toFixed(2));
}

export function getActualSettlementCarryForwardAmount(
  actualRemainingAmount: number,
  cashBoxAmount: number,
  sharesAmount: number,
): number {
  return Number(Math.max(actualRemainingAmount - cashBoxAmount - sharesAmount, 0).toFixed(2));
}

export function getSettlementDifferenceAmount(
  actualRemainingAmount: number,
  expectedRevenue: number,
): number {
  return Number((actualRemainingAmount - expectedRevenue).toFixed(2));
}

export function buildPieceStockAuditRows(
  productSupplyRows: PieceStockAuditInput[],
  settlementActualInputs: Record<string, string>,
  parseNumberInput: (value: string) => number,
): PieceStockAuditRow[] {
  return productSupplyRows
    .filter((item) => item.unitType === "PIECE")
    .map((item) => {
      const rawInput = settlementActualInputs[item.productId] ?? "";
      const hasInput = rawInput.trim().length > 0;
      const actualQty = hasInput ? Number(parseNumberInput(rawInput).toFixed(3)) : null;
      const diffQty =
        actualQty === null ? null : Number((actualQty - item.remainingQty).toFixed(3));
      const adjustmentAmount =
        diffQty === null ? null : Number((-diffQty * item.sellPrice).toFixed(2));

      return {
        productId: item.productId,
        productName: item.name,
        expectedQty: item.remainingQty,
        actualQty,
        diffQty,
        unitPrice: item.sellPrice,
        adjustmentAmount,
      };
    });
}

export function getAuditNetSalesAmount(rows: PieceStockAuditRow[]): number {
  return Number(rows.reduce((sum, row) => sum + (row.adjustmentAmount ?? 0), 0).toFixed(2));
}

export function getSettlementExpectedRevenueAmount(
  todayExpectedRemaining: number,
  auditNetSalesAmount: number,
): number {
  return Number((todayExpectedRemaining + auditNetSalesAmount).toFixed(2));
}
