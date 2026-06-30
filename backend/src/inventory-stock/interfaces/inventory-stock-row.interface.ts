export interface InventoryStockRow {
  storeId: string;
  productId: string;
  productClientId: string;
  name: string;
  unitType: 'PIECE' | 'KG';
  sellPrice: number;
  costPrice: number;
  remainingQty: number;
  previousRemainingQty: number;
  loggedToday: number;
  calculatedAt: string;
}
