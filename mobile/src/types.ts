export type OrderStatus = 'COMPLETED' | 'REFUNDED';

export type PaymentMethod = 'CASH' | 'CARD' | 'MIXED';

export type UserRole = 'ADMIN' | 'CASHIER';
export type ExpenseCategory = 'CLEANING' | 'DRINKS' | 'OTHER' | (string & {});

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  storeId: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  expiresIn: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashCarryAmount?: number;
}

export interface ProductTemplate {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  unitType: 'PIECE' | 'KG';
}

export interface CreateProductPayload {
  clientProductId: string;
  name: string;
  unitType: 'PIECE' | 'KG';
  price: number;
  costPrice: number;
  syncedAt: string;
}

export interface UpdateProductPayload {
  name?: string;
  unitType?: 'PIECE' | 'KG';
  price?: number;
  costPrice?: number;
  syncedAt?: string;
}

export interface LocalProduct extends ProductTemplate {
  clientProductId: string;
  synced: boolean;
  createdLocallyAt: string;
  updatedLocallyAt: string;
}

export interface ApiProduct extends CreateProductPayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CreateOrderPayload {
  clientOrderId: string;
  storeId: string;
  cashierName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: OrderItem[];
  orderedAt: string;
  note?: string;
}

export interface LocalOrder extends CreateOrderPayload {
  synced: boolean;
  createdLocallyAt: string;
}

export interface ApiOrder extends CreateOrderPayload {
  id: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailySettlementPayload {
  clientClosureId: string;
  storeId: string;
  businessDate: string;
  cashBoxAmount: number;
  sharesAmount: number;
  actualRemainingAmount: number;
  expectedRevenue?: number;
  carryInAmount?: number;
  note?: string;
  syncedAt: string;
}

export type PurchaseKind = 'SUPPLY' | 'TAWASI' | 'PAYMENT';

export interface LocalDailySettlement extends CreateDailySettlementPayload {
  synced: boolean;
  createdLocallyAt: string;
}

export interface ApiDailySettlement extends CreateDailySettlementPayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashboxWithdrawalPayload {
  storeId?: string | null;
  amount: number;
  note?: string;
  withdrawnAt?: string;
}

export interface ApiCashboxWithdrawal extends CreateCashboxWithdrawalPayload {
  id: string;
  store?: Store | null;
  createdByUserId?: string | null;
  createdByDisplayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProductSalesSummaryRow {
  productName: string;
  soldQty: number;
  refundedQty: number;
  netQty: number;
  netAmount: number;
}

export interface CreateExpensePayload {
  clientExpenseId: string;
  storeId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  imageUrl?: string;
  note?: string;
  syncedAt: string;
}

export interface UpdateExpensePayload {
  expenseDate?: string;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  imageUrl?: string;
  note?: string;
  syncedAt?: string;
}

export interface LocalExpense extends CreateExpensePayload {
  synced: boolean;
  localImageUri?: string;
  createdLocallyAt: string;
  updatedLocallyAt: string;
}

export interface ApiExpense extends CreateExpensePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudinarySignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  uploadUrl: string;
}

export interface CreatePurchasePayload {
  clientPurchaseId: string;
  storeId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseKind?: PurchaseKind;
  sellPrice?: number;
  paymentAmount?: number;
  purchaseDate: string;
  note?: string;
  syncedAt: string;
}

export interface UpdatePurchasePayload {
  productName?: string;
  quantity?: number;
  unitCost?: number;
  totalCost?: number;
  purchaseKind?: PurchaseKind;
  sellPrice?: number;
  paymentAmount?: number;
  purchaseDate?: string;
  note?: string;
  syncedAt?: string;
}

export interface LocalPurchase extends CreatePurchasePayload {
  synced: boolean;
  createdLocallyAt: string;
  updatedLocallyAt: string;
}

export interface ApiPurchase extends CreatePurchasePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryAdjustmentPayload {
  clientAdjustmentId: string;
  storeId: string;
  productClientId: string;
  actualQuantity: number;
  adjustedAt: string;
  syncedAt: string;
}

export interface LocalInventoryAdjustment
  extends CreateInventoryAdjustmentPayload {
  synced: boolean;
  createdLocallyAt: string;
}

export interface ApiInventoryAdjustment
  extends CreateInventoryAdjustmentPayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryDestructionPayload {
  clientDestructionId: string;
  storeId: string;
  productClientId: string;
  quantity: number;
  note?: string;
  destroyedAt: string;
  syncedAt: string;
}

export interface LocalInventoryDestruction
  extends CreateInventoryDestructionPayload {
  synced: boolean;
  createdLocallyAt: string;
}

export interface ApiInventoryDestruction
  extends CreateInventoryDestructionPayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiInventoryStockRow {
  storeId: string;
  productId: string;
  productClientId: string;
  name: string;
  unitType: ProductTemplate['unitType'];
  sellPrice: number;
  costPrice: number;
  remainingQty: number;
  previousRemainingQty: number;
  loggedToday: number;
  calculatedAt: string;
}

export interface Employee {
  id: string;
  storeId: string;
  name: string;
  weeklySalary: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface EmployeeAbsenceEntry {
  id: string;
  employeeId: string;
  storeId: string;
  absenceDate: string;
  note?: string;
  createdAt: string;
  synced?: boolean;
}

export interface EmployeeWithdrawalEntry {
  id: string;
  employeeId: string;
  storeId: string;
  amount: number;
  withdrawalDate: string;
  note?: string;
  createdAt: string;
  synced?: boolean;
}

export interface CreateEmployeePayload {
  clientEmployeeId: string;
  storeId: string;
  name: string;
  weeklySalary: number;
  isActive: boolean;
  syncedAt: string;
}

export interface UpdateEmployeePayload {
  name?: string;
  weeklySalary?: number;
  isActive?: boolean;
  syncedAt?: string;
}

export interface ApiEmployee extends CreateEmployeePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeAbsencePayload {
  clientAbsenceId: string;
  employeeClientId: string;
  storeId: string;
  absenceDate: string;
  note?: string;
  syncedAt: string;
}

export interface ApiEmployeeAbsence extends CreateEmployeeAbsencePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeWithdrawalPayload {
  clientWithdrawalId: string;
  employeeClientId: string;
  storeId: string;
  amount: number;
  withdrawalDate: string;
  note?: string;
  syncedAt: string;
}

export interface ApiEmployeeWithdrawal extends CreateEmployeeWithdrawalPayload {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWeeklySnapshot {
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  weekEndDate: string;
  weeklySalary: number;
  absenceDays: number;
  attendanceDays: number;
  earnedAmount: number;
  withdrawalsAmount: number;
  balance: number;
}

interface SyncJobBase {
  id: string;
  referenceId: string;
  retries: number;
  permanentFailure?: boolean;
  createdAt: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  entity?:
    | 'ORDER'
    | 'DAILY_SETTLEMENT'
    | 'EXPENSE'
    | 'PURCHASE'
    | 'PRODUCT'
    | 'INVENTORY_ADJUSTMENT'
    | 'INVENTORY_DESTRUCTION'
    | 'EMPLOYEE'
    | 'EMPLOYEE_ABSENCE'
    | 'EMPLOYEE_WITHDRAWAL';
}

export interface OrderCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'ORDER';
  payload: CreateOrderPayload;
}

export interface DailySettlementCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'DAILY_SETTLEMENT';
  payload: CreateDailySettlementPayload;
}

export interface LegacyOrderSyncJob extends SyncJobBase {
  type: 'ORDER';
  payload: CreateOrderPayload;
}

export interface LegacyDailySettlementSyncJob extends SyncJobBase {
  type: 'DAILY_SETTLEMENT';
  payload: CreateDailySettlementPayload;
}

export interface ExpenseCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'EXPENSE';
  payload: CreateExpensePayload;
}

export interface ExpenseUpdateSyncJob extends SyncJobBase {
  action: 'UPDATE';
  entity: 'EXPENSE';
  payload: UpdateExpensePayload;
}

export interface ExpenseDeleteSyncJob extends SyncJobBase {
  action: 'DELETE';
  entity: 'EXPENSE';
  payload: { clientExpenseId: string };
}

export interface PurchaseCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'PURCHASE';
  payload: CreatePurchasePayload;
}

export interface PurchaseUpdateSyncJob extends SyncJobBase {
  action: 'UPDATE';
  entity: 'PURCHASE';
  payload: UpdatePurchasePayload;
}

export interface PurchaseDeleteSyncJob extends SyncJobBase {
  action: 'DELETE';
  entity: 'PURCHASE';
  payload: { clientPurchaseId: string };
}

export interface ProductCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'PRODUCT';
  payload: CreateProductPayload;
}

export interface ProductUpdateSyncJob extends SyncJobBase {
  action: 'UPDATE';
  entity: 'PRODUCT';
  payload: UpdateProductPayload;
}

export interface ProductDeleteSyncJob extends SyncJobBase {
  action: 'DELETE';
  entity: 'PRODUCT';
  payload: { clientProductId: string };
}

export interface InventoryAdjustmentCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'INVENTORY_ADJUSTMENT';
  payload: CreateInventoryAdjustmentPayload;
}

export interface InventoryDestructionCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'INVENTORY_DESTRUCTION';
  payload: CreateInventoryDestructionPayload;
}

export interface EmployeeCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'EMPLOYEE';
  payload: CreateEmployeePayload;
}

export interface EmployeeUpdateSyncJob extends SyncJobBase {
  action: 'UPDATE';
  entity: 'EMPLOYEE';
  payload: UpdateEmployeePayload;
}

export interface EmployeeAbsenceCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'EMPLOYEE_ABSENCE';
  payload: CreateEmployeeAbsencePayload;
}

export interface EmployeeAbsenceDeleteSyncJob extends SyncJobBase {
  action: 'DELETE';
  entity: 'EMPLOYEE_ABSENCE';
  payload: { clientAbsenceId: string };
}

export interface EmployeeWithdrawalCreateSyncJob extends SyncJobBase {
  action: 'CREATE';
  entity: 'EMPLOYEE_WITHDRAWAL';
  payload: CreateEmployeeWithdrawalPayload;
}

export interface EmployeeWithdrawalDeleteSyncJob extends SyncJobBase {
  action: 'DELETE';
  entity: 'EMPLOYEE_WITHDRAWAL';
  payload: { clientWithdrawalId: string };
}

export type SyncJob =
  | LegacyOrderSyncJob
  | LegacyDailySettlementSyncJob
  | OrderCreateSyncJob
  | DailySettlementCreateSyncJob
  | ExpenseCreateSyncJob
  | ExpenseUpdateSyncJob
  | ExpenseDeleteSyncJob
  | PurchaseCreateSyncJob
  | PurchaseUpdateSyncJob
  | PurchaseDeleteSyncJob
  | ProductCreateSyncJob
  | ProductUpdateSyncJob
  | ProductDeleteSyncJob
  | InventoryAdjustmentCreateSyncJob
  | InventoryDestructionCreateSyncJob
  | EmployeeCreateSyncJob
  | EmployeeUpdateSyncJob
  | EmployeeAbsenceCreateSyncJob
  | EmployeeAbsenceDeleteSyncJob
  | EmployeeWithdrawalCreateSyncJob
  | EmployeeWithdrawalDeleteSyncJob;

export interface DashboardStoreSummary {
  storeId: string;
  storeName: string;
  ordersCount: number;
  completedRevenue: number;
  refundAmount: number;
  sharesAmount: number;
  cashBoxAmount: number;
  cashBoxWithdrawalsAmount: number;
  actualCashBoxRemainingAmount: number;
  expectedCarryForwardAmount: number;
  actualRemainingAmount: number;
  settlementDifferenceAmount: number;
  netProfit: number;
}

export interface DashboardResponse {
  totals: {
    ordersCount: number;
    completedRevenue: number;
    refundAmount: number;
    sharesAmount: number;
    cashBoxAmount: number;
    cashBoxWithdrawalsAmount: number;
    actualCashBoxRemainingAmount: number;
    expectedCarryForwardAmount: number;
    actualRemainingAmount: number;
    settlementDifferenceAmount: number;
    netProfit: number;
  };
  stores: DashboardStoreSummary[];
}

export interface CartItem extends ProductTemplate {
  quantity: number;
  lineTotal?: number;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export type AppScreenKey =
  | 'pos'
  | 'orders'
  | 'settlement'
  | 'admin'
  | 'purchases'
  | 'expenses'
  | 'employees';
