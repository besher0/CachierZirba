import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  API_BASE_URL,
  DEFAULT_EXPENSE_CATEGORY_OPTIONS,
  FALLBACK_STORES,
  PRODUCT_CATALOG,
  STORAGE_KEYS,
} from './src/config';
import {
  ApiError,
  deleteExpense,
  deletePurchase,
  fetchDashboard,
  fetchDailySettlements,
  fetchExpenses,
  fetchMe,
  fetchOrders,
  fetchProducts,
  fetchPurchases,
  fetchStores,
  login,
  patchProduct,
  patchExpense,
  patchPurchase,
  postDailySettlement,
  postExpense,
  postOrder,
  postProduct,
  postPurchase,
  deleteProduct,
} from './src/services/api';
import {
  ApiDailySettlement,
  ApiExpense,
  ApiOrder,
  ApiProduct,
  ApiPurchase,
  AppScreenKey,
  AuthSession,
  CartItem,
  CreateDailySettlementPayload,
  CreateExpensePayload,
  CreateOrderPayload,
  CreateProductPayload,
  CreatePurchasePayload,
  DashboardResponse,
  DashboardStoreSummary,
  Employee,
  EmployeeAbsenceEntry,
  EmployeeWeeklySnapshot,
  EmployeeWithdrawalEntry,
  ExpenseCategory,
  LocalDailySettlement,
  LocalExpense,
  LocalOrder,
  LocalProduct,
  LocalPurchase,
  LoginPayload,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  ProductTemplate,
  Store,
  SyncJob,
  UpdateProductPayload,
  UpdateExpensePayload,
  UpdatePurchasePayload,
} from './src/types';
import { exportCsv, toCsv } from './src/utils/csv';

interface OrderHistoryRow {
  clientOrderId: string;
  cashierName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  orderedAt: string;
  itemsCount: number;
  items: OrderItem[];
  note?: string;
  synced: boolean;
  source: 'LOCAL' | 'SERVER';
}

interface SettlementHistoryRow {
  businessDate: string;
  cashBoxAmount: number;
  sharesAmount: number;
  actualRemainingAmount: number;
  expectedRemainingAmount: number;
  differenceAmount: number;
  synced: boolean;
  source: 'LOCAL' | 'SERVER';
}

interface ExpenseRow {
  clientExpenseId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  note?: string;
  synced: boolean;
}

interface PurchaseRow {
  clientPurchaseId: string;
  purchaseDate: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  note?: string;
  synced: boolean;
}

interface ExpenseCategoryOption {
  value: ExpenseCategory;
  label: string;
}

interface NavItem {
  key: AppScreenKey;
  label: string;
  subtitle: string;
}

interface ProductSupplyRow {
  productId: string;
  name: string;
  unitType: ProductTemplate['unitType'];
  sellPrice: number;
  costPrice: number;
  remainingQty: number;
  receivedToday: number;
  loggedToday: number;
}

interface ProductSalesSummaryRow {
  productId: string;
  name: string;
  unitType: ProductTemplate['unitType'];
  soldQty: number;
  refundedQty: number;
  netQty: number;
  netAmount: number;
}

interface PieceStockAuditRow {
  productId: string;
  productName: string;
  expectedQty: number;
  actualQty: number | null;
  diffQty: number | null;
}

const moneyFormatter = new Intl.NumberFormat('ar-SY', {
  style: 'currency',
  currency: 'SYP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const BRAND_NAME = 'ZERBE';
const BRAND_SIGNATURE = 'SKEIKE HANNA';
const BRAND_CATEGORY = 'PATISSERIE';
const BRAND_FULL = `${BRAND_SIGNATURE} ${BRAND_CATEGORY}`;
const EXPORT_FILE_PREFIX = 'zerbe';

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeNumericInputText(value: string): string {
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicDigits = '۰۱۲۳۴۵۶۷۸۹';

  let normalized = value
    .trim()
    .replace(/\u00A0/g, '')
    .replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/\s+/g, '');

  if (normalized.includes(',') && !normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^0-9.+-]/g, '');
  return normalized;
}

function parseNumberInput(value: string): number {
  const normalized = normalizeNumericInputText(value);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Number(value.toFixed(3));
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return String(rounded).replace(/\.?0+$/, '');
}

function normalizeIsoTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeQuantityForUnit(unitType: ProductTemplate['unitType'], value: number): number {
  if (unitType === 'KG') {
    return Number(value.toFixed(3));
  }

  return Math.floor(value);
}

function normalizeProductKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildProductsFromHistory(
  purchases: Array<Pick<LocalPurchase, 'productName' | 'unitCost'>>,
  orders: Array<Pick<LocalOrder, 'items'>>,
): ProductTemplate[] {
  const byKey = new Map<string, ProductTemplate>();

  purchases.forEach((item) => {
    const name = item.productName.trim();
    if (!name) {
      return;
    }

    const key = normalizeProductKey(name);
    const existing = byKey.get(key);
    if (existing) {
      if (item.unitCost > 0) {
        existing.costPrice = item.unitCost;
        if (existing.price <= 0) {
          existing.price = item.unitCost;
        }
      }
      return;
    }

    byKey.set(key, {
      id: makeId('prd'),
      name,
      unitType: 'PIECE',
      costPrice: item.unitCost > 0 ? item.unitCost : 0,
      price: item.unitCost > 0 ? item.unitCost : 0,
    });
  });

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const name = item.productName.trim();
      if (!name) {
        return;
      }

      const key = normalizeProductKey(name);
      const existing = byKey.get(key);
      if (existing) {
        if (item.unitPrice > 0) {
          existing.price = item.unitPrice;
        }
        return;
      }

      byKey.set(key, {
        id: makeId('prd'),
        name,
        unitType: 'PIECE',
        costPrice: item.unitPrice > 0 ? item.unitPrice : 0,
        price: item.unitPrice > 0 ? item.unitPrice : 0,
      });
    });
  });

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function mapApiProductToLocal(product: ApiProduct): LocalProduct {
  return {
    id: product.clientProductId,
    clientProductId: product.clientProductId,
    name: product.name,
    unitType: product.unitType,
    price: product.price,
    costPrice: product.costPrice,
    synced: true,
    createdLocallyAt: product.createdAt,
    updatedLocallyAt: product.updatedAt,
  };
}

function toLocalProduct(product: ProductTemplate, fallbackCreatedAt?: string): LocalProduct {
  const nowIso = new Date().toISOString();
  const clientProductId = (product as LocalProduct).clientProductId ?? product.id;
  const createdLocallyAt = (product as LocalProduct).createdLocallyAt ?? fallbackCreatedAt ?? nowIso;
  const updatedLocallyAt = (product as LocalProduct).updatedLocallyAt ?? createdLocallyAt;

  return {
    id: clientProductId,
    clientProductId,
    name: product.name,
    unitType: product.unitType,
    price: product.price,
    costPrice: product.costPrice,
    synced: (product as LocalProduct).synced ?? false,
    createdLocallyAt,
    updatedLocallyAt,
  };
}

function mergeProductsWithRemote(
  remoteProducts: ApiProduct[],
  localProducts: LocalProduct[],
): LocalProduct[] {
  const merged = new Map<string, LocalProduct>();

  remoteProducts.forEach((product) => {
    const mapped = mapApiProductToLocal(product);
    merged.set(mapped.clientProductId, mapped);
  });

  localProducts.forEach((product) => {
    if (!product.synced) {
      merged.set(product.clientProductId, product);
    }
  });

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function isLikelyNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('timeout')
    );
  }

  return false;
}

function extractApiMessage(error: ApiError): string | null {
  if (!error.bodyText) {
    return null;
  }

  try {
    const parsed = JSON.parse(error.bodyText) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(' - ');
    }

    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message.trim();
    }
  } catch {
    const raw = error.bodyText.trim();
    return raw.length > 0 ? raw : null;
  }

  return null;
}

async function loadArray<T>(key: string): Promise<T[]> {
  let rawValue: string | null = null;

  try {
    rawValue = await AsyncStorage.getItem(key);
  } catch {
    return [];
  }

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function saveArray<T>(key: string, value: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failure to keep app usable.
  }
}

async function loadObject<T>(key: string): Promise<T | null> {
  let rawValue: string | null = null;

  try {
    rawValue = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

async function saveObject<T>(key: string, value: T | null): Promise<void> {
  try {
    if (value === null) {
      await AsyncStorage.removeItem(key);
      return;
    }

    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failure to keep app usable.
  }
}

function toShortDate(isoDate: string): string {
  if (!isoDate) {
    return '-';
  }

  return isoDate.replace('T', ' ').slice(0, 16);
}

function toOrderStatusLabel(status: OrderStatus): string {
  return status === 'REFUNDED' ? 'مرتجع' : 'مكتمل';
}

function toPaymentMethodLabel(paymentMethod: PaymentMethod): string {
  if (paymentMethod === 'CARD') {
    return 'بطاقة';
  }

  if (paymentMethod === 'MIXED') {
    return 'مختلط';
  }

  return 'كاش';
}

function normalizeExpenseCategoryValue(value: string): string {
  return value.trim();
}

function toExpenseCategoryFallbackLabel(value: string): string {
  const normalized = normalizeExpenseCategoryValue(value);
  if (normalized === 'CLEANING') {
    return 'منظفات';
  }
  if (normalized === 'DRINKS') {
    return 'مشروبات';
  }
  if (normalized === 'OTHER') {
    return 'أخرى';
  }
  if (normalized === 'RAW_MATERIALS') {
    return 'مواد خام';
  }
  if (normalized === 'UTILITIES') {
    return 'مرافق';
  }
  if (normalized === 'SALARIES') {
    return 'رواتب';
  }
  if (normalized === 'MARKETING') {
    return 'تسويق';
  }
  return normalized;
}

function mergeExpenseCategoryOptions(options: ExpenseCategoryOption[]): ExpenseCategoryOption[] {
  const normalizedKeys = new Set<string>();
  const next: ExpenseCategoryOption[] = [];

  options.forEach((option) => {
    const value = normalizeExpenseCategoryValue(option.value);
    if (!value) {
      return;
    }

    const key = value.toLowerCase();
    if (normalizedKeys.has(key)) {
      return;
    }

    normalizedKeys.add(key);
    next.push({
      value,
      label: option.label.trim() || toExpenseCategoryFallbackLabel(value),
    });
  });

  return next;
}

function mapApiOrderToRow(order: ApiOrder): OrderHistoryRow {
  return {
    clientOrderId: order.clientOrderId,
    cashierName: order.cashierName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    orderedAt: order.orderedAt,
    itemsCount: order.items.length,
    items: order.items,
    note: order.note,
    synced: true,
    source: 'SERVER',
  };
}

function mapLocalOrderToRow(order: LocalOrder): OrderHistoryRow {
  return {
    clientOrderId: order.clientOrderId,
    cashierName: order.cashierName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    orderedAt: order.orderedAt,
    itemsCount: order.items.length,
    items: order.items,
    note: order.note,
    synced: order.synced,
    source: 'LOCAL',
  };
}

function mapApiSettlementToRow(item: ApiDailySettlement): SettlementHistoryRow {
  const expectedRemainingAmount = Number(
    Math.max(item.expectedRevenue ?? 0, 0) - item.cashBoxAmount - item.sharesAmount,
  );
  const expectedRemainingClamped = Number(Math.max(expectedRemainingAmount, 0).toFixed(2));
  const actualRemainingAmount = Number((item.actualRemainingAmount ?? 0).toFixed(2));
  return {
    businessDate: item.businessDate,
    cashBoxAmount: item.cashBoxAmount,
    sharesAmount: item.sharesAmount,
    actualRemainingAmount,
    expectedRemainingAmount: expectedRemainingClamped,
    differenceAmount: Number((actualRemainingAmount - expectedRemainingClamped).toFixed(2)),
    synced: true,
    source: 'SERVER',
  };
}

function mapLocalSettlementToRow(item: LocalDailySettlement): SettlementHistoryRow {
  const expectedRemainingAmount = Number(
    Math.max(item.expectedRevenue ?? 0, 0) - item.cashBoxAmount - item.sharesAmount,
  );
  const expectedRemainingClamped = Number(Math.max(expectedRemainingAmount, 0).toFixed(2));
  const actualRemainingAmount = Number((item.actualRemainingAmount ?? 0).toFixed(2));
  return {
    businessDate: item.businessDate,
    cashBoxAmount: item.cashBoxAmount,
    sharesAmount: item.sharesAmount,
    actualRemainingAmount,
    expectedRemainingAmount: expectedRemainingClamped,
    differenceAmount: Number((actualRemainingAmount - expectedRemainingClamped).toFixed(2)),
    synced: item.synced,
    source: 'LOCAL',
  };
}

function mapApiExpenseToRow(item: ApiExpense): ExpenseRow {
  return {
    clientExpenseId: item.clientExpenseId,
    expenseDate: item.expenseDate,
    category: item.category,
    description: item.description,
    amount: item.amount,
    note: item.note,
    synced: true,
  };
}

function mapLocalExpenseToRow(item: LocalExpense): ExpenseRow {
  return {
    clientExpenseId: item.clientExpenseId,
    expenseDate: item.expenseDate,
    category: item.category,
    description: item.description,
    amount: item.amount,
    note: item.note,
    synced: item.synced,
  };
}

function mapApiPurchaseToRow(item: ApiPurchase): PurchaseRow {
  return {
    clientPurchaseId: item.clientPurchaseId,
    purchaseDate: item.purchaseDate,
    productName: item.productName,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    note: item.note,
    synced: true,
  };
}

function mapLocalPurchaseToRow(item: LocalPurchase): PurchaseRow {
  return {
    clientPurchaseId: item.clientPurchaseId,
    purchaseDate: item.purchaseDate,
    productName: item.productName,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    note: item.note,
    synced: item.synced,
  };
}

function mergeSyncJobs(previous: SyncJob[], incoming: SyncJob): SyncJob[] {
  const entity = incoming.entity ?? incoming.type;
  if (entity !== 'EXPENSE' && entity !== 'PURCHASE' && entity !== 'PRODUCT') {
    return [...previous, incoming];
  }

  const lastIndex = [...previous]
    .map((job, index) => ({ job, index }))
    .reverse()
    .find((entry) => {
      const entryEntity = entry.job.entity ?? entry.job.type;
      return entryEntity === entity && entry.job.referenceId === incoming.referenceId;
    })?.index;

  if (lastIndex === undefined) {
    return [...previous, incoming];
  }

  const existing = previous[lastIndex];
  const existingEntity = existing.entity ?? existing.type;
  const withoutExisting = previous.filter((_, index) => index !== lastIndex);

  if (existingEntity !== entity) {
    return [...previous, incoming];
  }

  if (incoming.action === 'UPDATE') {
    if (existing.action === 'CREATE') {
      return [
        ...withoutExisting,
        {
          ...existing,
          payload: {
            ...(existing.payload as object),
            ...(incoming.payload as object),
          },
        } as SyncJob,
      ];
    }

    if (existing.action === 'UPDATE') {
      return [...withoutExisting, incoming];
    }

    return previous;
  }

  if (incoming.action === 'DELETE') {
    if (existing.action === 'CREATE') {
      return withoutExisting;
    }

    return [...withoutExisting, incoming];
  }

  return [...withoutExisting, incoming];
}

function formatDateOnly(dateTimeIso: string): string {
  return dateTimeIso.slice(0, 10);
}

function dateFromIsoOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function getWeekStartMonday(isoDate: string): string {
  const date = dateFromIsoOnly(isoDate);
  const dayIndex = (date.getDay() + 6) % 7;
  return toIsoDateOnly(addDays(date, -dayIndex));
}

function getWeekEndSunday(weekStartIso: string): string {
  return toIsoDateOnly(addDays(dateFromIsoOnly(weekStartIso), 6));
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isDesktop = shortestSide >= 960;
  const isPosSplit = width >= 980;
  const isPortrait = height >= width;
  const isPortraitMobile = !isDesktop && height >= width;
  const showPageSwitchControls = !isDesktop || isPortrait;

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  const [usernameInput, setUsernameInput] = useState('مها');
  const [passwordInput, setPasswordInput] = useState('abcd');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeScreen, setActiveScreen] = useState<AppScreenKey>('pos');
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('جاهز للعمل.');

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [dailySettlements, setDailySettlements] = useState<LocalDailySettlement[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [purchases, setPurchases] = useState<LocalPurchase[]>([]);
  const [queue, setQueue] = useState<SyncJob[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState('0');
  const [taxInput, setTaxInput] = useState('0');
  const [posPadInput, setPosPadInput] = useState('');
  const [pendingMultiplier, setPendingMultiplier] = useState<number | null>(null);
  const [pendingAmountValue, setPendingAmountValue] = useState<number | null>(null);
  const [posCashCarryAmount, setPosCashCarryAmount] = useState(0);
  const [isRefundMode, setIsRefundMode] = useState(false);

  const [cashBoxInput, setCashBoxInput] = useState('');
  const [sharesInput, setSharesInput] = useState('');
  const [actualRemainingInput, setActualRemainingInput] = useState('');
  const [settlementNoteInput, setSettlementNoteInput] = useState('');

  const [dashboardTotals, setDashboardTotals] = useState<DashboardResponse['totals'] | null>(null);
  const [dashboardSummaries, setDashboardSummaries] = useState<DashboardStoreSummary[]>([]);
  const [remoteOrders, setRemoteOrders] = useState<ApiOrder[]>([]);
  const [remoteSettlements, setRemoteSettlements] = useState<ApiDailySettlement[]>([]);
  const [remoteExpenses, setRemoteExpenses] = useState<ApiExpense[]>([]);
  const [remotePurchases, setRemotePurchases] = useState<ApiPurchase[]>([]);
  const [selectedOrderInvoice, setSelectedOrderInvoice] = useState<OrderHistoryRow | null>(null);

  const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null);
  const [expenseDateInput, setExpenseDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useState<ExpenseCategoryOption[]>(
    DEFAULT_EXPENSE_CATEGORY_OPTIONS,
  );
  const [expenseCategoryInput, setExpenseCategoryInput] = useState<ExpenseCategory>('CLEANING');
  const [newExpenseCategoryLabelInput, setNewExpenseCategoryLabelInput] = useState('');
  const [expenseDescriptionInput, setExpenseDescriptionInput] = useState('');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseNoteInput, setExpenseNoteInput] = useState('');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<'ALL' | ExpenseCategory>('ALL');
  const [expenseFilterFrom, setExpenseFilterFrom] = useState('');
  const [expenseFilterTo, setExpenseFilterTo] = useState('');
  const [expenseFilterText, setExpenseFilterText] = useState('');

  const [purchaseFilterProduct, setPurchaseFilterProduct] = useState('');
  const [purchaseFilterFrom, setPurchaseFilterFrom] = useState('');
  const [purchaseFilterTo, setPurchaseFilterTo] = useState('');
  const [tawasiCapitalInput, setTawasiCapitalInput] = useState('');
  const [tawasiSellPriceInput, setTawasiSellPriceInput] = useState('');
  const [products, setProducts] = useState<LocalProduct[]>(
    PRODUCT_CATALOG.map((item) => toLocalProduct(item)),
  );
  const [todaySupplyInputs, setTodaySupplyInputs] = useState<Record<string, string>>({});
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [newProductNameInput, setNewProductNameInput] = useState('');
  const [newProductUnitType, setNewProductUnitType] = useState<ProductTemplate['unitType']>('PIECE');
  const [newProductSellPriceInput, setNewProductSellPriceInput] = useState('');
  const [newProductCostPriceInput, setNewProductCostPriceInput] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeAbsences, setEmployeeAbsences] = useState<EmployeeAbsenceEntry[]>([]);
  const [employeeWithdrawals, setEmployeeWithdrawals] = useState<EmployeeWithdrawalEntry[]>([]);
  const [employeeNameInput, setEmployeeNameInput] = useState('');
  const [employeeWeeklySalaryInput, setEmployeeWeeklySalaryInput] = useState('');
  const [absenceEmployeeIdInput, setAbsenceEmployeeIdInput] = useState('');
  const [absenceDateInput, setAbsenceDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [absenceNoteInput, setAbsenceNoteInput] = useState('');
  const [withdrawalEmployeeIdInput, setWithdrawalEmployeeIdInput] = useState('');
  const [withdrawalDateInput, setWithdrawalDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState('');
  const [withdrawalNoteInput, setWithdrawalNoteInput] = useState('');
  const [settlementActualInputs, setSettlementActualInputs] = useState<Record<string, string>>({});
  const [adminFromDateInput, setAdminFromDateInput] = useState('');
  const [adminToDateInput, setAdminToDateInput] = useState('');
  const [adminDatePickerTarget, setAdminDatePickerTarget] = useState<'from' | 'to' | null>(null);
  const [adminDatePickerValue, setAdminDatePickerValue] = useState(new Date());

  const authToken = session?.accessToken ?? '';
  const isAdmin = session?.user.role === 'ADMIN';
  const isCashier = session?.user.role === 'CASHIER';
  const canManageInventory = isCashier || isAdmin;
  const canManageExpenses = isCashier || isAdmin;
  const assignedStoreId = session?.user.storeId ?? null;

  const navItems = useMemo<NavItem[]>(
    () => [
      { key: 'pos', label: 'نقطة البيع', subtitle: 'بيع مباشر' },
      { key: 'purchases', label: 'المشتريات', subtitle: 'استلام التوريدات' },
      { key: 'expenses', label: 'المصاريف', subtitle: 'إدارة التكاليف' },
      { key: 'employees', label: 'الموظفون', subtitle: 'رواتب وسحوبات' },
      { key: 'settlement', label: 'التسوية', subtitle: 'إغلاق اليوم' },
      { key: 'orders', label: 'سجل الطلبات', subtitle: 'مراجعة اليوم' },
    ],
    [],
  );

  const activeScreenLabel = useMemo(() => {
    if (activeScreen === 'admin') {
      return 'لوحة التسوية';
    }

    return navItems.find((item) => item.key === activeScreen)?.label ?? 'الصفحات';
  }, [activeScreen, navItems]);

  const swipeScreens = useMemo<AppScreenKey[]>(
    () => [...navItems.map((item) => item.key), ...(isAdmin ? (['admin'] as AppScreenKey[]) : [])],
    [isAdmin, navItems],
  );

  const moveScreenBySwipe = useCallback(
    (direction: 'NEXT' | 'PREV') => {
      if (swipeScreens.length === 0) {
        return;
      }

      const currentIndex = swipeScreens.indexOf(activeScreen);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const delta = direction === 'NEXT' ? 1 : -1;
      const nextIndex = (safeIndex + delta + swipeScreens.length) % swipeScreens.length;
      setActiveScreen(swipeScreens[nextIndex]);
    },
    [activeScreen, swipeScreens],
  );

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isDesktop || selectedOrderInvoice !== null) {
            return false;
          }

          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          return absDx > 24 && absDx > absDy * 1.25;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) < 42 || Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) {
            return;
          }

          if (gestureState.dx < 0) {
            moveScreenBySwipe('PREV');
            return;
          }

          moveScreenBySwipe('NEXT');
        },
      }),
    [isDesktop, moveScreenBySwipe, selectedOrderInvoice],
  );

  const canSwitchStore = isAdmin;

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId),
    [selectedStoreId, stores],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const total = useMemo(() => {
    const discountValue = parseNumberInput(discountInput);
    const taxValue = parseNumberInput(taxInput);
    return Math.max(subtotal - discountValue + taxValue, 0);
  }, [discountInput, subtotal, taxInput]);

  const padAmountPreview = useMemo(() => {
    if (pendingAmountValue && pendingAmountValue > 0) {
      return pendingAmountValue;
    }
    return null;
  }, [pendingAmountValue]);

  const selectedStoreOrders = useMemo(
    () => orders.filter((order) => order.storeId === selectedStoreId),
    [orders, selectedStoreId],
  );

  const selectedStoreSettlements = useMemo(
    () => dailySettlements.filter((item) => item.storeId === selectedStoreId),
    [dailySettlements, selectedStoreId],
  );

  const selectedStoreExpenses = useMemo(
    () => expenses.filter((item) => item.storeId === selectedStoreId),
    [expenses, selectedStoreId],
  );

  const selectedStorePurchases = useMemo(
    () => purchases.filter((item) => item.storeId === selectedStoreId),
    [purchases, selectedStoreId],
  );

  const selectedStoreEmployees = useMemo(
    () =>
      employees.filter((item) => item.storeId === selectedStoreId && item.isActive),
    [employees, selectedStoreId],
  );

  const selectedStoreAbsences = useMemo(
    () => employeeAbsences.filter((item) => item.storeId === selectedStoreId),
    [employeeAbsences, selectedStoreId],
  );

  const selectedStoreWithdrawals = useMemo(
    () => employeeWithdrawals.filter((item) => item.storeId === selectedStoreId),
    [employeeWithdrawals, selectedStoreId],
  );

  const selectedStoreRemoteSettlements = useMemo(
    () => remoteSettlements.filter((item) => item.storeId === selectedStoreId),
    [remoteSettlements, selectedStoreId],
  );

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const settlementCycleStartIso = useMemo(() => {
    const candidates: string[] = [];

    selectedStoreSettlements.forEach((item) => {
      const candidate = normalizeIsoTimestamp(item.syncedAt ?? item.createdLocallyAt);
      if (candidate) {
        candidates.push(candidate);
      }
    });

    selectedStoreRemoteSettlements.forEach((item) => {
      const candidate = normalizeIsoTimestamp(item.syncedAt);
      if (candidate) {
        candidates.push(candidate);
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((a, b) => b.localeCompare(a))[0];
  }, [selectedStoreRemoteSettlements, selectedStoreSettlements]);

  const ordersInCurrentCycle = useMemo(
    () =>
      selectedStoreOrders.filter((item) => {
        if (item.orderedAt.slice(0, 10) !== todayDate) {
          return false;
        }

        if (!settlementCycleStartIso) {
          return true;
        }

        const orderedAt = normalizeIsoTimestamp(item.orderedAt);
        return orderedAt ? orderedAt > settlementCycleStartIso : true;
      }),
    [selectedStoreOrders, settlementCycleStartIso, todayDate],
  );

  const expensesInCurrentCycle = useMemo(
    () =>
      selectedStoreExpenses.filter((item) => {
        if (item.expenseDate !== todayDate) {
          return false;
        }

        if (!settlementCycleStartIso) {
          return true;
        }

        const createdAt = normalizeIsoTimestamp(item.createdLocallyAt);
        return createdAt ? createdAt > settlementCycleStartIso : true;
      }),
    [selectedStoreExpenses, settlementCycleStartIso, todayDate],
  );

  const purchasesInCurrentCycle = useMemo(
    () =>
      selectedStorePurchases.filter((item) => {
        if (item.purchaseDate !== todayDate) {
          return false;
        }

        if (!settlementCycleStartIso) {
          return true;
        }

        const createdAt = normalizeIsoTimestamp(item.createdLocallyAt);
        return createdAt ? createdAt > settlementCycleStartIso : true;
      }),
    [selectedStorePurchases, settlementCycleStartIso, todayDate],
  );

  const withdrawalsInCurrentCycle = useMemo(
    () =>
      selectedStoreWithdrawals.filter((item) => {
        if (item.withdrawalDate !== todayDate) {
          return false;
        }

        if (!settlementCycleStartIso) {
          return true;
        }

        const createdAt = normalizeIsoTimestamp(item.createdAt);
        return createdAt ? createdAt > settlementCycleStartIso : true;
      }),
    [selectedStoreWithdrawals, settlementCycleStartIso, todayDate],
  );

  const carryInAmount = useMemo(
    () => Number(Math.abs(posCashCarryAmount).toFixed(2)),
    [posCashCarryAmount],
  );

  const recentAbsenceRows = useMemo(
    () =>
      [...selectedStoreAbsences]
        .sort((a, b) => b.absenceDate.localeCompare(a.absenceDate))
        .slice(0, 10),
    [selectedStoreAbsences],
  );

  const recentWithdrawalRows = useMemo(
    () =>
      [...selectedStoreWithdrawals]
        .sort((a, b) => b.withdrawalDate.localeCompare(a.withdrawalDate))
        .slice(0, 10),
    [selectedStoreWithdrawals],
  );

  const mergedOrderRows = useMemo(() => {
    const rows = new Map<string, OrderHistoryRow>();

    remoteOrders
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.clientOrderId, mapApiOrderToRow(item)));

    selectedStoreOrders.forEach((item) => rows.set(item.clientOrderId, mapLocalOrderToRow(item)));

    return Array.from(rows.values())
      .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))
      .slice(0, 12);
  }, [remoteOrders, selectedStoreId, selectedStoreOrders]);

  const mergedSettlementRows = useMemo(() => {
    const rows = new Map<string, SettlementHistoryRow>();

    remoteSettlements
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.businessDate, mapApiSettlementToRow(item)));

    selectedStoreSettlements.forEach((item) =>
      rows.set(item.businessDate, mapLocalSettlementToRow(item)),
    );

    return Array.from(rows.values()).sort((a, b) => b.businessDate.localeCompare(a.businessDate));
  }, [remoteSettlements, selectedStoreId, selectedStoreSettlements]);

  const pendingExpenseDeletes = useMemo(
    () =>
      new Set(
        queue
          .filter((job) => (job.entity ?? job.type) === 'EXPENSE' && job.action === 'DELETE')
          .map((job) => job.referenceId),
      ),
    [queue],
  );

  const pendingPurchaseDeletes = useMemo(
    () =>
      new Set(
        queue
          .filter((job) => (job.entity ?? job.type) === 'PURCHASE' && job.action === 'DELETE')
          .map((job) => job.referenceId),
      ),
    [queue],
  );

  const mergedExpenseRows = useMemo(() => {
    const rows = new Map<string, ExpenseRow>();

    remoteExpenses
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => {
        if (!pendingExpenseDeletes.has(item.clientExpenseId)) {
          rows.set(item.clientExpenseId, mapApiExpenseToRow(item));
        }
      });

    selectedStoreExpenses.forEach((item) => rows.set(item.clientExpenseId, mapLocalExpenseToRow(item)));

    return Array.from(rows.values()).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [pendingExpenseDeletes, remoteExpenses, selectedStoreExpenses, selectedStoreId]);

  const effectiveExpenseCategoryOptions = useMemo(() => {
    const fromRecords = mergedExpenseRows.map((item) => ({
      value: normalizeExpenseCategoryValue(item.category),
      label: toExpenseCategoryFallbackLabel(item.category),
    }));

    return mergeExpenseCategoryOptions([...expenseCategoryOptions, ...fromRecords]);
  }, [expenseCategoryOptions, mergedExpenseRows]);

  const expenseCategoryLabelMap = useMemo(
    () =>
      new Map(
        effectiveExpenseCategoryOptions.map((option) => [
          normalizeExpenseCategoryValue(option.value),
          option.label,
        ]),
      ),
    [effectiveExpenseCategoryOptions],
  );

  const toExpenseCategoryLabel = useCallback(
    (category: string): string =>
      expenseCategoryLabelMap.get(normalizeExpenseCategoryValue(category)) ??
      toExpenseCategoryFallbackLabel(category),
    [expenseCategoryLabelMap],
  );

  const mergedPurchaseRows = useMemo(() => {
    const rows = new Map<string, PurchaseRow>();

    remotePurchases
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => {
        if (!pendingPurchaseDeletes.has(item.clientPurchaseId)) {
          rows.set(item.clientPurchaseId, mapApiPurchaseToRow(item));
        }
      });

    selectedStorePurchases.forEach((item) =>
      rows.set(item.clientPurchaseId, mapLocalPurchaseToRow(item)),
    );

    return Array.from(rows.values()).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [pendingPurchaseDeletes, remotePurchases, selectedStoreId, selectedStorePurchases]);

  const filteredExpenseRows = useMemo(
    () =>
      mergedExpenseRows.filter((item) => {
        if (expenseFilterCategory !== 'ALL' && item.category !== expenseFilterCategory) {
          return false;
        }

        if (expenseFilterFrom && item.expenseDate < expenseFilterFrom) {
          return false;
        }

        if (expenseFilterTo && item.expenseDate > expenseFilterTo) {
          return false;
        }

        if (
          expenseFilterText &&
          !item.description.toLowerCase().includes(expenseFilterText.toLowerCase())
        ) {
          return false;
        }

        return true;
      }),
    [expenseFilterCategory, expenseFilterFrom, expenseFilterText, expenseFilterTo, mergedExpenseRows],
  );

  const filteredPurchaseRows = useMemo(
    () =>
      mergedPurchaseRows.filter((item) => {
        if (purchaseFilterFrom && item.purchaseDate < purchaseFilterFrom) {
          return false;
        }

        if (purchaseFilterTo && item.purchaseDate > purchaseFilterTo) {
          return false;
        }

        if (
          purchaseFilterProduct &&
          !item.productName.toLowerCase().includes(purchaseFilterProduct.toLowerCase())
        ) {
          return false;
        }

        return true;
      }),
    [mergedPurchaseRows, purchaseFilterFrom, purchaseFilterProduct, purchaseFilterTo],
  );

  const productSupplyRows = useMemo<ProductSupplyRow[]>(() => {
    const purchasedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();
    const refundedByProduct = new Map<string, number>();
    const todayReceivedByProduct = new Map<string, number>();

    mergedPurchaseRows.forEach((entry) => {
      const key = normalizeProductKey(entry.productName);
      purchasedByProduct.set(key, (purchasedByProduct.get(key) ?? 0) + entry.quantity);

      if (entry.purchaseDate === todayDate) {
        todayReceivedByProduct.set(key, (todayReceivedByProduct.get(key) ?? 0) + entry.quantity);
      }
    });

    selectedStoreOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = normalizeProductKey(item.productName);
        if (order.status === 'REFUNDED') {
          refundedByProduct.set(key, (refundedByProduct.get(key) ?? 0) + item.quantity);
        } else {
          soldByProduct.set(key, (soldByProduct.get(key) ?? 0) + item.quantity);
        }
      });
    });

    return products.map((product) => {
      const key = normalizeProductKey(product.name);
      const purchased = purchasedByProduct.get(key) ?? 0;
      const sold = soldByProduct.get(key) ?? 0;
      const refunded = refundedByProduct.get(key) ?? 0;
      const remainingQty = Number((purchased - sold + refunded).toFixed(3));
      const loggedToday = Number((todayReceivedByProduct.get(key) ?? 0).toFixed(3));
      const receivedToday = Number(parseNumberInput(todaySupplyInputs[product.id] ?? '0').toFixed(3));

      return {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty,
        receivedToday,
        loggedToday,
      };
    });
  }, [mergedPurchaseRows, products, selectedStoreOrders, todayDate, todaySupplyInputs]);

  const todaySalesTotal = useMemo(
    () =>
      ordersInCurrentCycle
        .filter((item) => item.status === 'COMPLETED')
        .reduce((sum, item) => sum + item.total, 0),
    [ordersInCurrentCycle],
  );

  const todayRefundTotal = useMemo(
    () =>
      ordersInCurrentCycle
        .filter((item) => item.status === 'REFUNDED')
        .reduce((sum, item) => sum + item.total, 0),
    [ordersInCurrentCycle],
  );

  const todayNetSales = useMemo(
    () => Number((todaySalesTotal - todayRefundTotal).toFixed(2)),
    [todayRefundTotal, todaySalesTotal],
  );

  const todayExpensesTotal = useMemo(
    () => expensesInCurrentCycle.reduce((sum, item) => sum + item.amount, 0),
    [expensesInCurrentCycle],
  );

  const todayPurchasesTotal = useMemo(
    () => purchasesInCurrentCycle.reduce((sum, item) => sum + item.totalCost, 0),
    [purchasesInCurrentCycle],
  );

  const weekStartDate = useMemo(() => getWeekStartMonday(todayDate), [todayDate]);
  const weekEndDate = useMemo(() => getWeekEndSunday(weekStartDate), [weekStartDate]);

  const todayEmployeeWithdrawalsTotal = useMemo(
    () => withdrawalsInCurrentCycle.reduce((sum, item) => sum + item.amount, 0),
    [withdrawalsInCurrentCycle],
  );

  const employeeWeeklySnapshots = useMemo<EmployeeWeeklySnapshot[]>(
    () =>
      selectedStoreEmployees.map((employee) => {
        const weekAbsenceDays = new Set(
          selectedStoreAbsences
            .filter(
              (entry) =>
                entry.employeeId === employee.id &&
                entry.absenceDate >= weekStartDate &&
                entry.absenceDate <= weekEndDate,
            )
            .map((entry) => entry.absenceDate),
        ).size;
        const absenceDays = Math.min(7, weekAbsenceDays);
        const attendanceDays = Math.max(0, 7 - absenceDays);
        const earnedAmount = Number(((attendanceDays / 7) * employee.weeklySalary).toFixed(2));
        const withdrawalsAmount = Number(
          selectedStoreWithdrawals
            .filter(
              (entry) =>
                entry.employeeId === employee.id &&
                entry.withdrawalDate >= weekStartDate &&
                entry.withdrawalDate <= weekEndDate,
            )
            .reduce((sum, entry) => sum + entry.amount, 0)
            .toFixed(2),
        );
        const balance = Number((earnedAmount - withdrawalsAmount).toFixed(2));

        return {
          employeeId: employee.id,
          employeeName: employee.name,
          weekStartDate,
          weekEndDate,
          weeklySalary: employee.weeklySalary,
          absenceDays,
          attendanceDays,
          earnedAmount,
          withdrawalsAmount,
          balance,
        };
      }),
    [
      selectedStoreAbsences,
      selectedStoreEmployees,
      selectedStoreWithdrawals,
      weekEndDate,
      weekStartDate,
    ],
  );

  const todayExpectedRemaining = useMemo(
    () =>
      Number(
        (
          todayNetSales -
          todayExpensesTotal -
          todayPurchasesTotal -
          todayEmployeeWithdrawalsTotal +
          carryInAmount
        ).toFixed(2),
      ),
    [
      carryInAmount,
      todayEmployeeWithdrawalsTotal,
      todayExpensesTotal,
      todayNetSales,
      todayPurchasesTotal,
    ],
  );

  const settlementDistributedAmount = useMemo(
    () => Number((parseNumberInput(cashBoxInput) + parseNumberInput(sharesInput)).toFixed(2)),
    [cashBoxInput, sharesInput],
  );

  const settlementCarryForwardAmount = useMemo(
    () => Number(Math.max(todayExpectedRemaining - settlementDistributedAmount, 0).toFixed(2)),
    [settlementDistributedAmount, todayExpectedRemaining],
  );

  const settlementOverDistributedAmount = useMemo(
    () => Number(Math.max(settlementDistributedAmount - todayExpectedRemaining, 0).toFixed(2)),
    [settlementDistributedAmount, todayExpectedRemaining],
  );

  const settlementActualRemainingAmount = useMemo(
    () => Number(parseNumberInput(actualRemainingInput).toFixed(2)),
    [actualRemainingInput],
  );

  const settlementDifferenceAmount = useMemo(
    () => Number((settlementActualRemainingAmount - settlementCarryForwardAmount).toFixed(2)),
    [settlementActualRemainingAmount, settlementCarryForwardAmount],
  );

  const productSalesSummaryRows = useMemo<ProductSalesSummaryRow[]>(() => {
    const byProduct = new Map<string, ProductSalesSummaryRow>();

    ordersInCurrentCycle.forEach((order) => {
        order.items.forEach((item) => {
          const key = normalizeProductKey(item.productName);
          const fromCatalog = products.find((entry) => normalizeProductKey(entry.name) === key);
          const base = byProduct.get(key) ?? {
            productId: fromCatalog?.id ?? key,
            name: item.productName,
            unitType: fromCatalog?.unitType ?? 'PIECE',
            soldQty: 0,
            refundedQty: 0,
            netQty: 0,
            netAmount: 0,
          };

          if (order.status === 'REFUNDED') {
            base.refundedQty += item.quantity;
            base.netQty -= item.quantity;
            base.netAmount -= item.lineTotal;
          } else {
            base.soldQty += item.quantity;
            base.netQty += item.quantity;
            base.netAmount += item.lineTotal;
          }

          byProduct.set(key, base);
        });
      });

    return Array.from(byProduct.values()).map((item) => ({
      ...item,
      soldQty: Number(item.soldQty.toFixed(3)),
      refundedQty: Number(item.refundedQty.toFixed(3)),
      netQty: Number(item.netQty.toFixed(3)),
      netAmount: Number(item.netAmount.toFixed(2)),
    }));
  }, [ordersInCurrentCycle, products]);

  const pieceStockAuditRows = useMemo<PieceStockAuditRow[]>(
    () =>
      productSupplyRows
        .filter((item) => item.unitType === 'PIECE')
        .map((item) => {
          const rawInput = settlementActualInputs[item.productId] ?? '';
          const hasInput = rawInput.trim().length > 0;
          const actualQty = hasInput ? Number(parseNumberInput(rawInput).toFixed(3)) : null;
          const diffQty =
            actualQty === null ? null : Number((actualQty - item.remainingQty).toFixed(3));

          return {
            productId: item.productId,
            productName: item.name,
            expectedQty: item.remainingQty,
            actualQty,
            diffQty,
          };
        }),
    [productSupplyRows, settlementActualInputs],
  );

  const effectiveDashboardTotals = useMemo(
    () =>
      dashboardTotals ?? {
        ordersCount: dashboardSummaries.reduce((sum, item) => sum + item.ordersCount, 0),
        completedRevenue: dashboardSummaries.reduce(
          (sum, item) => sum + item.completedRevenue,
          0,
        ),
        refundAmount: dashboardSummaries.reduce((sum, item) => sum + item.refundAmount, 0),
        sharesAmount: dashboardSummaries.reduce((sum, item) => sum + item.sharesAmount, 0),
        cashBoxAmount: dashboardSummaries.reduce((sum, item) => sum + item.cashBoxAmount, 0),
        expectedCarryForwardAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.expectedCarryForwardAmount,
          0,
        ),
        actualRemainingAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.actualRemainingAmount,
          0,
        ),
        settlementDifferenceAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.settlementDifferenceAmount,
          0,
        ),
        netProfit: dashboardSummaries.reduce((sum, item) => sum + item.netProfit, 0),
      },
    [dashboardSummaries, dashboardTotals],
  );

  const logout = useCallback((message: string) => {
    setSession(null);
    setDashboardTotals(null);
    setDashboardSummaries([]);
    setRemoteOrders([]);
    setRemoteSettlements([]);
    setRemoteExpenses([]);
    setRemotePurchases([]);
    setActiveScreen('pos');
    setStatusMessage(message);
  }, []);

  const handleApiFailure = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof ApiError && error.status === 401) {
        logout('انتهت الجلسة، سجّل الدخول من جديد.');
        return;
      }

      if (isLikelyNetworkError(error)) {
        setStatusMessage('تعذر الوصول للسيرفر حالياً، التطبيق يعمل على البيانات المحلية.');
        return;
      }

      setStatusMessage(fallbackMessage);
    },
    [logout],
  );

  const markOrderSynced = useCallback((referenceId: string) => {
    setOrders((previous) => {
      const next = previous.map((order) =>
        order.clientOrderId === referenceId ? { ...order, synced: true } : order,
      );
      void saveArray(STORAGE_KEYS.orders, next);
      return next;
    });
  }, []);

  const markSettlementSynced = useCallback((referenceId: string) => {
    setDailySettlements((previous) => {
      const next = previous.map((item) =>
        item.clientClosureId === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.dailySettlements, next);
      return next;
    });
  }, []);

  const markExpenseSynced = useCallback((referenceId: string) => {
    setExpenses((previous) => {
      const next = previous.map((item) =>
        item.clientExpenseId === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.expenses, next);
      return next;
    });
  }, []);

  const markPurchaseSynced = useCallback((referenceId: string) => {
    setPurchases((previous) => {
      const next = previous.map((item) =>
        item.clientPurchaseId === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.purchases, next);
      return next;
    });
  }, []);

  const markProductSynced = useCallback((referenceId: string) => {
    setProducts((previous) => {
      const next = previous.map((item) =>
        item.clientProductId === referenceId
          ? {
              ...item,
              synced: true,
            }
          : item,
      );
      void saveArray(STORAGE_KEYS.products, next);
      return next;
    });
  }, []);

  const enqueueJob = useCallback((job: SyncJob) => {
    setQueue((previous) => {
      const next = mergeSyncJobs(previous, job);
      void saveArray(STORAGE_KEYS.syncQueue, next);
      return next;
    });
  }, []);

  const refreshStoresData = useCallback(async () => {
    if (!authToken) {
      return;
    }

    try {
      const remoteStores = await fetchStores(authToken);
      if (remoteStores.length === 0) {
        return;
      }

      setStores(remoteStores);
      await saveArray(STORAGE_KEYS.stores, remoteStores);

      setSelectedStoreId((previous) => {
        if (isCashier && assignedStoreId) {
          return assignedStoreId;
        }

        return previous || remoteStores[0]?.id || previous;
      });
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحميل المحلات من السيرفر.');
    }
  }, [assignedStoreId, authToken, handleApiFailure, isCashier]);

  const refreshOrdersData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchOrders(authToken, { storeId: selectedStoreId });
      setRemoteOrders(data);
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث سجل الطلبات من السيرفر.');
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshDailySettlementsData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchDailySettlements(authToken, { storeId: selectedStoreId });
      setRemoteSettlements(data);
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث تسويات اليوم من السيرفر.');
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshExpensesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchExpenses(authToken, { storeId: selectedStoreId });
      setRemoteExpenses(data);
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث المصاريف من السيرفر.');
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshPurchasesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchPurchases(authToken, { storeId: selectedStoreId });
      setRemotePurchases(data);
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث المشتريات من السيرفر.');
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshProductsData = useCallback(async () => {
    if (!authToken || !isOnline) {
      return;
    }

    try {
      const data = await fetchProducts(authToken);
      const pendingDeleteIds = new Set(
        queue
          .filter(
            (job) =>
              (job.entity ?? job.type) === 'PRODUCT' &&
              (job.action ?? 'CREATE') === 'DELETE',
          )
          .map((job) => job.referenceId),
      );

      setProducts((previous) => {
        const localProducts = previous.map((item) => toLocalProduct(item));
        const remoteVisibleProducts = data.filter(
          (item) => !pendingDeleteIds.has(item.clientProductId),
        );
        const next = mergeProductsWithRemote(remoteVisibleProducts, localProducts);
        void saveArray(STORAGE_KEYS.products, next);
        return next;
      });
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث كتالوج المنتجات من السيرفر.');
    }
  }, [authToken, handleApiFailure, isOnline, queue]);

  const refreshDashboardData = useCallback(async () => {
    if (!isOnline || !isAdmin || !authToken) {
      return;
    }

    if (adminFromDateInput && adminToDateInput && adminFromDateInput > adminToDateInput) {
      setStatusMessage('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.');
      return;
    }

    try {
      const dashboard = await fetchDashboard(authToken, {
        from: adminFromDateInput || undefined,
        to: adminToDateInput || undefined,
      });
      setDashboardTotals(dashboard.totals);
      setDashboardSummaries(dashboard.stores);
    } catch (error: unknown) {
      handleApiFailure(error, 'تعذر تحديث لوحة الإدارة حالياً.');
    }
  }, [adminFromDateInput, adminToDateInput, authToken, handleApiFailure, isAdmin, isOnline]);

  const applyAdminDateSelection = useCallback((target: 'from' | 'to', selectedDate: Date) => {
    const isoDate = toIsoDateOnly(selectedDate);
    if (target === 'from') {
      setAdminFromDateInput(isoDate);
      return;
    }
    setAdminToDateInput(isoDate);
  }, []);

  const openAdminDatePicker = useCallback(
    (target: 'from' | 'to') => {
      const source = target === 'from' ? adminFromDateInput : adminToDateInput;
      const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(source);
      setAdminDatePickerValue(isIsoDateOnly ? dateFromIsoOnly(source) : new Date());
      setAdminDatePickerTarget(target);
    },
    [adminFromDateInput, adminToDateInput],
  );

  const clearAdminDateFilters = useCallback(() => {
    setAdminFromDateInput('');
    setAdminToDateInput('');
    setStatusMessage('تم مسح فلتر التاريخ من لوحة التسوية.');
  }, []);

  const closeAdminDatePicker = useCallback(() => {
    setAdminDatePickerTarget(null);
  }, []);

  const confirmAdminDatePicker = useCallback(() => {
    if (!adminDatePickerTarget) {
      return;
    }

    applyAdminDateSelection(adminDatePickerTarget, adminDatePickerValue);
    closeAdminDatePicker();
  }, [adminDatePickerTarget, adminDatePickerValue, applyAdminDateSelection, closeAdminDatePicker]);

  const onAdminDatePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        const target = adminDatePickerTarget;
        closeAdminDatePicker();

        if (event.type === 'set' && selectedDate && target) {
          applyAdminDateSelection(target, selectedDate);
        }
        return;
      }

      if (selectedDate) {
        setAdminDatePickerValue(selectedDate);
      }
    },
    [adminDatePickerTarget, applyAdminDateSelection, closeAdminDatePicker],
  );

  const validateSession = useCallback(async () => {
    if (!authToken || !isOnline) {
      return;
    }

    try {
      const authUser = await fetchMe(authToken);
      setSession((previous) => {
        if (!previous) {
          return previous;
        }

        const sameUser =
          previous.user.id === authUser.id &&
          previous.user.username === authUser.username &&
          previous.user.role === authUser.role &&
          previous.user.displayName === authUser.displayName &&
          previous.user.storeId === authUser.storeId;

        if (sameUser) {
          return previous;
        }

        return {
          ...previous,
          user: authUser,
        };
      });

      if (authUser.role === 'CASHIER' && authUser.storeId) {
        setSelectedStoreId(authUser.storeId);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        logout('انتهت الجلسة، سجّل الدخول من جديد.');
        return;
      }

      if (!isLikelyNetworkError(error)) {
        setStatusMessage('تعذر التحقق من الجلسة الحالية.');
      }
    }
  }, [authToken, isOnline, logout]);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing || queue.length === 0 || !authToken) {
      return;
    }

    setIsSyncing(true);
    setStatusMessage('يتم حالياً مزامنة العمليات المحلية...');

    const remaining: SyncJob[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const job = queue[index];

      try {
        const entity = job.entity ?? job.type;
        const action = job.action ?? 'CREATE';

        if (entity === 'ORDER') {
          await postOrder(authToken, job.payload as CreateOrderPayload);
          markOrderSynced(job.referenceId);
        } else if (entity === 'DAILY_SETTLEMENT') {
          const settlementPayload = job.payload as Partial<CreateDailySettlementPayload>;
          const expectedRemainingFallback = Math.max(
            (settlementPayload.expectedRevenue ?? 0) -
              (settlementPayload.cashBoxAmount ?? 0) -
              (settlementPayload.sharesAmount ?? 0),
            0,
          );

          await postDailySettlement(authToken, {
            ...(settlementPayload as CreateDailySettlementPayload),
            actualRemainingAmount:
              settlementPayload.actualRemainingAmount ?? Number(expectedRemainingFallback.toFixed(2)),
          });
          markSettlementSynced(job.referenceId);
        } else if (entity === 'EXPENSE' && action === 'CREATE') {
          await postExpense(authToken, job.payload as CreateExpensePayload);
          markExpenseSynced(job.referenceId);
        } else if (entity === 'EXPENSE' && action === 'UPDATE') {
          await patchExpense(authToken, job.referenceId, job.payload as UpdateExpensePayload);
          markExpenseSynced(job.referenceId);
        } else if (entity === 'EXPENSE' && action === 'DELETE') {
          await deleteExpense(authToken, job.referenceId);
        } else if (entity === 'PURCHASE' && action === 'CREATE') {
          await postPurchase(authToken, job.payload as CreatePurchasePayload);
          markPurchaseSynced(job.referenceId);
        } else if (entity === 'PURCHASE' && action === 'UPDATE') {
          await patchPurchase(authToken, job.referenceId, job.payload as UpdatePurchasePayload);
          markPurchaseSynced(job.referenceId);
        } else if (entity === 'PURCHASE' && action === 'DELETE') {
          await deletePurchase(authToken, job.referenceId);
        } else if (entity === 'PRODUCT' && action === 'CREATE') {
          await postProduct(authToken, job.payload as CreateProductPayload);
          markProductSynced(job.referenceId);
        } else if (entity === 'PRODUCT' && action === 'UPDATE') {
          await patchProduct(authToken, job.referenceId, job.payload as UpdateProductPayload);
          markProductSynced(job.referenceId);
        } else if (entity === 'PRODUCT' && action === 'DELETE') {
          await deleteProduct(authToken, job.referenceId);
        }
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          remaining.push(...queue.slice(index));
          logout('انتهت الجلسة أثناء المزامنة. الرجاء تسجيل الدخول مجدداً.');
          break;
        }

        if (isLikelyNetworkError(error)) {
          remaining.push(...queue.slice(index));
          break;
        }

        remaining.push({
          ...job,
          retries: job.retries + 1,
        });
      }
    }

    setQueue(remaining);
    await saveArray(STORAGE_KEYS.syncQueue, remaining);
    setIsSyncing(false);

    if (remaining.length === 0) {
      setStatusMessage('تمت مزامنة كل العمليات المؤجلة.');
      await refreshDashboardData();
      await refreshOrdersData();
      await refreshDailySettlementsData();
      await refreshExpensesData();
      await refreshPurchasesData();
      await refreshProductsData();
      return;
    }

    setStatusMessage(`بقي ${remaining.length} عملية بانتظار المزامنة.`);
  }, [
    isOnline,
    isSyncing,
    markExpenseSynced,
    markOrderSynced,
    markProductSynced,
    markPurchaseSynced,
    markSettlementSynced,
    queue,
    authToken,
    logout,
    refreshDailySettlementsData,
    refreshExpensesData,
    refreshOrdersData,
    refreshProductsData,
    refreshPurchasesData,
    refreshDashboardData,
  ]);

  const loginUser = useCallback(async () => {
    const payload: LoginPayload = {
      username: usernameInput.trim(),
      password: passwordInput,
    };

    if (!payload.username || !payload.password) {
      setStatusMessage('أدخل اسم المستخدم وكلمة المرور أولاً.');
      return;
    }

    setIsLoggingIn(true);

    try {
      const authSession = await login(payload, {
        onNetworkRetry: ({ attempt, maxAttempts }) => {
          setStatusMessage(`ضعف اتصال بالسيرفر، إعادة المحاولة ${attempt}/${maxAttempts}...`);
        },
      });
      setSession(authSession);
      setActiveScreen('pos');

      if (authSession.user.role === 'CASHIER' && authSession.user.storeId) {
        setSelectedStoreId(authSession.user.storeId);
      }

      setStatusMessage(`مرحباً ${authSession.user.displayName}`);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setStatusMessage('بيانات الدخول غير صحيحة.');
        } else {
          const apiMessage = extractApiMessage(error);
          setStatusMessage(apiMessage ? `فشل تسجيل الدخول: ${apiMessage}` : `فشل تسجيل الدخول (${error.status}).`);
        }
      } else if (isLikelyNetworkError(error)) {
        setStatusMessage(
          `تعذر الاتصال بالسيرفر بعد عدة محاولات. تأكد من تشغيل الباك اند وصحة عنوان API: ${API_BASE_URL}.`,
        );
      } else {
        setStatusMessage('حدث خطأ غير متوقع أثناء تسجيل الدخول.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, [passwordInput, usernameInput]);

  useEffect(() => {
    let mounted = true;
    const bootTimeout = setTimeout(() => {
      if (!mounted) {
        return;
      }

      setStatusMessage('تأخر تحميل البيانات المحلية. تم المتابعة مع بيانات افتراضية.');
      setStores(FALLBACK_STORES);
      setSelectedStoreId(FALLBACK_STORES[0]?.id ?? '');
      setIsBootstrapping(false);
    }, 9000);

    void (async () => {
      try {
        const [
          cachedSession,
          cachedStores,
          cachedOrders,
          cachedSettlements,
          cachedExpenses,
          cachedExpenseCategories,
          cachedPurchases,
          cachedProducts,
          cachedEmployees,
          cachedEmployeeAbsences,
          cachedEmployeeWithdrawals,
          cachedQueue,
        ] =
          await Promise.all([
            loadObject<AuthSession>(STORAGE_KEYS.authSession),
            loadArray<Store>(STORAGE_KEYS.stores),
            loadArray<LocalOrder>(STORAGE_KEYS.orders),
            loadArray<LocalDailySettlement>(STORAGE_KEYS.dailySettlements),
            loadArray<LocalExpense>(STORAGE_KEYS.expenses),
            loadArray<ExpenseCategoryOption>(STORAGE_KEYS.expenseCategories),
            loadArray<LocalPurchase>(STORAGE_KEYS.purchases),
            loadArray<ProductTemplate | LocalProduct>(STORAGE_KEYS.products),
            loadArray<Employee>(STORAGE_KEYS.employees),
            loadArray<EmployeeAbsenceEntry>(STORAGE_KEYS.employeeAbsences),
            loadArray<EmployeeWithdrawalEntry>(STORAGE_KEYS.employeeWithdrawals),
            loadArray<SyncJob>(STORAGE_KEYS.syncQueue),
          ]);

        if (!mounted) {
          return;
        }

        const initialStores = cachedStores.length > 0 ? cachedStores : FALLBACK_STORES;
        const scopedStores =
          cachedSession?.user.role === 'CASHIER' && cachedSession.user.storeId
            ? initialStores.filter((store) => store.id === cachedSession.user.storeId)
            : initialStores;
        const effectiveStores = scopedStores.length > 0 ? scopedStores : initialStores;
        const initialStoreId =
          cachedSession?.user.role === 'CASHIER' && cachedSession.user.storeId
            ? cachedSession.user.storeId
            : effectiveStores[0]?.id ?? '';
        const initialProducts =
          cachedProducts.length > 0
            ? cachedProducts.map((item) => toLocalProduct(item))
            : buildProductsFromHistory(cachedPurchases, cachedOrders).map((item) =>
                toLocalProduct(item),
              );
        const initialExpenseCategories = mergeExpenseCategoryOptions([
          ...DEFAULT_EXPENSE_CATEGORY_OPTIONS,
          ...cachedExpenseCategories,
          ...cachedExpenses.map((item) => ({
            value: normalizeExpenseCategoryValue(item.category),
            label: toExpenseCategoryFallbackLabel(item.category),
          })),
        ]);

        setSession(cachedSession);
        setStores(effectiveStores);
        setOrders(cachedOrders);
        setDailySettlements(cachedSettlements);
        setExpenses(cachedExpenses);
        setExpenseCategoryOptions(initialExpenseCategories);
        setPurchases(cachedPurchases);
        setProducts(initialProducts);
        setEmployees(cachedEmployees);
        setEmployeeAbsences(cachedEmployeeAbsences);
        setEmployeeWithdrawals(cachedEmployeeWithdrawals);
        setQueue(cachedQueue);
        setSelectedStoreId(initialStoreId);
      } catch {
        if (!mounted) {
          return;
        }

        setSession(null);
        setStores(FALLBACK_STORES);
        setOrders([]);
        setDailySettlements([]);
        setExpenses([]);
        setExpenseCategoryOptions(DEFAULT_EXPENSE_CATEGORY_OPTIONS);
        setPurchases([]);
        setProducts([]);
        setEmployees([]);
        setEmployeeAbsences([]);
        setEmployeeWithdrawals([]);
        setQueue([]);
        setSelectedStoreId(FALLBACK_STORES[0]?.id ?? '');
        setStatusMessage('حدث خطأ في تحميل البيانات المحلية. تم تشغيل النظام بالوضع الافتراضي.');
      } finally {
        clearTimeout(bootTimeout);
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(bootTimeout);
    };
  }, []);

  useEffect(() => {
    void saveObject(STORAGE_KEYS.authSession, session);
  }, [session]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.expenseCategories, expenseCategoryOptions);
  }, [expenseCategoryOptions]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.employees, employees);
  }, [employees]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.employeeAbsences, employeeAbsences);
  }, [employeeAbsences]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.employeeWithdrawals, employeeWithdrawals);
  }, [employeeWithdrawals]);

  useEffect(() => {
    let mounted = true;

    void NetInfo.fetch().then((state) => {
      if (!mounted) {
        return;
      }

      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(connected);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(connected);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const availableKeys = new Set<AppScreenKey>([
      ...navItems.map((item) => item.key),
      ...(isAdmin ? (['admin'] as AppScreenKey[]) : []),
    ]);
    if (!availableKeys.has(activeScreen)) {
      setActiveScreen(navItems[0]?.key ?? 'pos');
    }
  }, [activeScreen, isAdmin, navItems]);

  useEffect(() => {
    if (isCashier && assignedStoreId) {
      setSelectedStoreId(assignedStoreId);
    }
  }, [assignedStoreId, isCashier]);

  useEffect(() => {
    setTodaySupplyInputs({});
    setSettlementActualInputs({});
    setActualRemainingInput('');
    setTawasiCapitalInput('');
    setTawasiSellPriceInput('');
    setSelectedOrderInvoice(null);
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    const normalizedCurrent = normalizeExpenseCategoryValue(expenseCategoryInput);
    const exists = effectiveExpenseCategoryOptions.some(
      (option) => normalizeExpenseCategoryValue(option.value) === normalizedCurrent,
    );
    if (!exists) {
      setExpenseCategoryInput(effectiveExpenseCategoryOptions[0]?.value ?? 'OTHER');
    }
  }, [effectiveExpenseCategoryOptions, expenseCategoryInput]);

  useEffect(() => {
    if (expenseFilterCategory === 'ALL') {
      return;
    }

    const normalizedCurrent = normalizeExpenseCategoryValue(expenseFilterCategory);
    const exists = effectiveExpenseCategoryOptions.some(
      (option) => normalizeExpenseCategoryValue(option.value) === normalizedCurrent,
    );
    if (!exists) {
      setExpenseFilterCategory('ALL');
    }
  }, [effectiveExpenseCategoryOptions, expenseFilterCategory]);

  useEffect(() => {
    if (selectedStoreEmployees.length === 0) {
      setAbsenceEmployeeIdInput('');
      setWithdrawalEmployeeIdInput('');
      return;
    }

    if (!selectedStoreEmployees.some((item) => item.id === absenceEmployeeIdInput)) {
      setAbsenceEmployeeIdInput(selectedStoreEmployees[0].id);
    }

    if (!selectedStoreEmployees.some((item) => item.id === withdrawalEmployeeIdInput)) {
      setWithdrawalEmployeeIdInput(selectedStoreEmployees[0].id);
    }
  }, [absenceEmployeeIdInput, selectedStoreEmployees, withdrawalEmployeeIdInput]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    void refreshStoresData();
  }, [isOnline, refreshStoresData, session?.accessToken]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    void refreshProductsData();
  }, [isOnline, refreshProductsData, session?.accessToken]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshProductsData();
    }, 20000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline, refreshProductsData, session?.accessToken]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken || !selectedStoreId) {
      return;
    }

    void refreshOrdersData();
    void refreshDailySettlementsData();
    void refreshExpensesData();
    void refreshPurchasesData();
    void refreshProductsData();
  }, [
    isOnline,
    refreshDailySettlementsData,
    refreshExpensesData,
    refreshOrdersData,
    refreshProductsData,
    refreshPurchasesData,
    selectedStoreId,
    session?.accessToken,
  ]);

  useEffect(() => {
    if (!session || !isOnline) {
      return;
    }

    void validateSession();
  }, [isOnline, session?.accessToken, validateSession]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken || !isAdmin || activeScreen !== 'admin') {
      return;
    }

    void refreshDashboardData();
  }, [activeScreen, isAdmin, isOnline, refreshDashboardData, session?.accessToken]);

  useEffect(() => {
    void syncQueue();
  }, [queue, syncQueue]);

  const pushPadToken = (token: string) => {
    setPosPadInput((previous) => {
      if (token === '.' && previous.includes('.')) {
        return previous;
      }

      const next = `${previous}${token}`.slice(0, 12);
      return next;
    });
  };

  const backspacePad = () => {
    setPosPadInput((previous) => previous.slice(0, -1));
  };

  const clearPad = () => {
    setPosPadInput('');
    setPendingMultiplier(null);
    setPendingAmountValue(null);
  };

  const applyDiscountFromPad = () => {
    if (!posPadInput.trim()) {
      setStatusMessage('أدخل رقم الحسم أولاً من لوحة الأرقام.');
      return;
    }

    const discountValue = parseNumberInput(posPadInput);
    setDiscountInput(String(discountValue));
    setPosPadInput('');
    setStatusMessage(`تم ضبط الحسم على ${discountValue}.`);
  };

  const activateMultiply = () => {
    if (!posPadInput.trim()) {
      setStatusMessage('أدخل رقم الكمية أولاً ثم اضغط ضرب.');
      return;
    }

    const multiplier = parseNumberInput(posPadInput);
    if (multiplier <= 0) {
      setStatusMessage('قيمة الضرب غير صالحة.');
      return;
    }

    setPendingMultiplier(multiplier);
    setPendingAmountValue(null);
    setPosPadInput('');
    setStatusMessage(`وضع الكمية مفعل: اختر منتجاً لإضافة ${multiplier}.`);
  };

  const activateAmountMode = () => {
    if (!posPadInput.trim()) {
      setStatusMessage('أدخل مبلغ البيع أولاً ثم اضغط مبلغ.');
      return;
    }

    const amountValue = parseNumberInput(posPadInput);
    if (amountValue <= 0) {
      setStatusMessage('مبلغ البيع غير صالح.');
      return;
    }

    setPendingAmountValue(amountValue);
    setPendingMultiplier(null);
    setPosPadInput('');
    setStatusMessage(`وضع المبلغ مفعل: اختر منتجاً للبيع بقيمة ${formatMoney(amountValue)}.`);
  };

  const roundPadValue = () => {
    if (!posPadInput.trim()) {
      setStatusMessage('أدخل مبلغاً أولاً لإضافته إلى الكاش.');
      return;
    }

    const cashValue = parseNumberInput(posPadInput);
    if (cashValue <= 0) {
      setStatusMessage('قيمة الكاش غير صالحة.');
      return;
    }

    setPosCashCarryAmount((previous) => Number((previous + cashValue).toFixed(2)));
    setCashBoxInput((previous) => {
      const previousValue = parseNumberInput(previous);
      return String(Number((previousValue + cashValue).toFixed(2)));
    });
    setPosPadInput('');
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setStatusMessage(`تمت إضافة ${formatMoney(cashValue)} إلى كاش الصندوق (مدور).`);
  };

  const updateCashBoxInput = (value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }
    setCashBoxInput(normalized);
  };

  const updateSharesInput = (value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }
    setSharesInput(normalized);
  };

  const addProductToCart = (productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }

    let quantityToAdd = 1;
    let operationMessage = '';

    if (pendingMultiplier && pendingMultiplier > 0) {
      quantityToAdd = normalizeQuantityForUnit(product.unitType, pendingMultiplier);
      if (quantityToAdd <= 0) {
        setStatusMessage(
          product.unitType === 'KG'
            ? 'قيمة الكمية المدخلة غير صالحة.'
            : 'منتج القطعة يحتاج كمية أكبر من أو تساوي 1.',
        );
        return;
      }

      operationMessage = `تمت إضافة ${quantityToAdd} من ${product.name}.`;
    } else if (pendingAmountValue && pendingAmountValue > 0) {
      if (product.price <= 0) {
        setStatusMessage('لا يمكن البيع بالمبلغ لأن سعر المنتج غير صالح.');
        return;
      }

      quantityToAdd = normalizeQuantityForUnit(
        product.unitType,
        pendingAmountValue / product.price,
      );
      if (quantityToAdd <= 0) {
        setStatusMessage('تعذر حساب الكمية من المبلغ المدخل.');
        return;
      }

      operationMessage = `تمت إضافة ${product.name} بقيمة ${formatMoney(
        pendingAmountValue,
      )} (كمية ${quantityToAdd}).`;
    } else if (posPadInput.trim()) {
      const directQuantityValue = parseNumberInput(posPadInput);
      if (directQuantityValue <= 0) {
        setStatusMessage('قيمة الكمية المدخلة غير صالحة.');
        return;
      }

      quantityToAdd = normalizeQuantityForUnit(product.unitType, directQuantityValue);
      if (quantityToAdd <= 0) {
        setStatusMessage(
          product.unitType === 'KG'
            ? 'قيمة الكمية المدخلة غير صالحة.'
            : 'منتج القطعة يحتاج كمية أكبر من أو تساوي 1.',
        );
        return;
      }

      operationMessage = `تمت إضافة ${quantityToAdd} من ${product.name}.`;
    }

    setCart((previous) => {
      const found = previous.find((item) => item.id === product.id);

      if (!found) {
        return [...previous, { ...product, quantity: quantityToAdd }];
      }

      return previous.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + quantityToAdd } : item,
      );
    });

    if (operationMessage) {
      setStatusMessage(operationMessage);
    }

    setPosPadInput('');
    setPendingMultiplier(null);
    setPendingAmountValue(null);
  };

  const decreaseProductInCart = (productId: string) => {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === productId ? { ...item, quantity: Math.max(item.quantity - 1, 0) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const cancelCurrentOrder = () => {
    if (cart.length === 0) {
      setStatusMessage('السلة فارغة بالفعل.');
      return;
    }

    setCart([]);
    setDiscountInput('0');
    setTaxInput('0');
    setPosPadInput('');
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setIsRefundMode(false);
    setStatusMessage('تم إلغاء الطلب ومسح السلة.');
  };

  const submitOrder = async () => {
    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل أولاً قبل تسجيل الطلب.');
      return;
    }

    if (cart.length === 0) {
      setStatusMessage('السلة فارغة، أضف منتجات قبل الحفظ.');
      return;
    }

    const orderedAt = new Date().toISOString();
    const clientOrderId = makeId('order');
    const payload: CreateOrderPayload = {
      clientOrderId,
      storeId: effectiveStoreId,
      cashierName: session.user.displayName,
      status: isRefundMode ? 'REFUNDED' : 'COMPLETED',
      paymentMethod: 'CASH',
      subtotal,
      discount: parseNumberInput(discountInput),
      tax: parseNumberInput(taxInput),
      total,
      items: cart.map((item) => ({
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.quantity * item.price,
      })),
      orderedAt,
    };

    const localOrder: LocalOrder = {
      ...payload,
      synced: false,
      createdLocallyAt: orderedAt,
    };

    setOrders((previous) => {
      const next = [localOrder, ...previous];
      void saveArray(STORAGE_KEYS.orders, next);
      return next;
    });

    setCart([]);
    setDiscountInput('0');
    setTaxInput('0');
    setPosPadInput('');
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setIsRefundMode(false);

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: clientOrderId,
      retries: 0,
      createdAt: orderedAt,
      entity: 'ORDER',
      action: 'CREATE',
      payload,
    };

    if (isOnline && authToken) {
      try {
        await postOrder(authToken, payload);
        markOrderSynced(clientOrderId);
        setStatusMessage('تم تسجيل الطلب في السيرفر مباشرة.');
        await refreshDashboardData();
        await refreshOrdersData();
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);

        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ الطلب محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage('تم حفظ الطلب محلياً وسيتم رفعه عند استقرار الاتصال.');
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage('الإنترنت غير متاح: تم تخزين الطلب محلياً في انتظار المزامنة.');
  };

  const submitDailySettlement = async () => {
    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل قبل تسجيل تسوية اليوم.');
      return;
    }

    if (!cashBoxInput || !sharesInput || !actualRemainingInput.trim()) {
      setStatusMessage('أدخل قيمة الصندوق والحصص والمبلغ المتبقي الفعلي قبل الحفظ.');
      return;
    }

    const createdAt = new Date().toISOString();
    const clientClosureId = makeId('close');
    const businessDate = createdAt.slice(0, 10);
    const cashBoxAmount = parseNumberInput(cashBoxInput);
    const sharesAmount = parseNumberInput(sharesInput);
    const actualRemainingAmount = Number(parseNumberInput(actualRemainingInput).toFixed(2));
    if (actualRemainingAmount < 0) {
      setStatusMessage('المبلغ المتبقي الفعلي يجب أن يكون صفراً أو أكبر.');
      return;
    }
    const distributedAmount = Number((cashBoxAmount + sharesAmount).toFixed(2));
    const carryForwardAmount = Number(Math.max(todayExpectedRemaining - distributedAmount, 0).toFixed(2));

    const adjustmentRows = pieceStockAuditRows.filter(
      (row) => row.diffQty !== null && Math.abs(row.diffQty) > 0,
    );

    if (adjustmentRows.length > 0) {
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

        const status = row.diffQty > 0 ? 'REFUNDED' : 'COMPLETED';
        const clientOrderId = makeId('audit');
        const totalAmount = Number((quantity * product.price).toFixed(2));
        const orderPayload: CreateOrderPayload = {
          clientOrderId,
          storeId: effectiveStoreId,
          cashierName: session.user.displayName,
          status,
          paymentMethod: 'CASH',
          subtotal: totalAmount,
          discount: 0,
          tax: 0,
          total: totalAmount,
          orderedAt: createdAt,
          note: `تسوية جرد تلقائية (${row.diffQty > 0 ? 'إرجاع' : 'بيع'})`,
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
          id: makeId('job'),
          referenceId: clientOrderId,
          retries: 0,
          createdAt,
          entity: 'ORDER',
          action: 'CREATE',
          payload: orderPayload,
        });
      });

      if (adjustmentRecords.length > 0) {
        setOrders((previous) => {
          const next = [...adjustmentRecords, ...previous];
          void saveArray(STORAGE_KEYS.orders, next);
          return next;
        });
        adjustmentJobs.forEach((job) => enqueueJob(job));
      }
    }

    const payload: CreateDailySettlementPayload = {
      clientClosureId,
      storeId: effectiveStoreId,
      businessDate,
      cashBoxAmount,
      sharesAmount,
      actualRemainingAmount,
      expectedRevenue: todayExpectedRemaining,
      note: settlementNoteInput.trim() || undefined,
      syncedAt: createdAt,
    };

    const localSettlement: LocalDailySettlement = {
      ...payload,
      synced: false,
      createdLocallyAt: createdAt,
    };

    setDailySettlements((previous) => {
      const withoutSameDay = previous.filter(
        (item) => !(item.storeId === effectiveStoreId && item.businessDate === businessDate),
      );
      const next = [localSettlement, ...withoutSameDay];
      void saveArray(STORAGE_KEYS.dailySettlements, next);
      return next;
    });

    setCashBoxInput('');
    setSharesInput('');
    setActualRemainingInput('');
    setSettlementNoteInput('');
    setPosCashCarryAmount(carryForwardAmount);
    setSettlementActualInputs({});

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: clientClosureId,
      retries: 0,
      createdAt,
      entity: 'DAILY_SETTLEMENT',
      action: 'CREATE',
      payload,
    };

    if (isOnline && authToken) {
      try {
        await postDailySettlement(authToken, payload);
        markSettlementSynced(clientClosureId);
        setStatusMessage(
          adjustmentRows.length > 0
            ? `تم تسجيل التسوية، وتوليد ${adjustmentRows.length} حركة ضبط جرد. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`
            : `تم تسجيل تسوية اليوم في السيرفر. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`,
        );
        await refreshDashboardData();
        await refreshDailySettlementsData();
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);

        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ التسوية محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage('تم حفظ التسوية محلياً وسيتم رفعها تلقائياً.');
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage(
      adjustmentRows.length > 0
        ? `لا يوجد إنترنت: تم تخزين التسوية وتوليد ${adjustmentRows.length} حركة ضبط محلياً. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`
        : `لا يوجد إنترنت: تم تخزين التسوية محلياً. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`,
    );
  };

  const resetExpenseForm = () => {
    setExpenseEditingId(null);
    setExpenseDateInput(new Date().toISOString().slice(0, 10));
    setExpenseCategoryInput(effectiveExpenseCategoryOptions[0]?.value ?? 'OTHER');
    setExpenseDescriptionInput('');
    setExpenseAmountInput('');
    setExpenseNoteInput('');
  };

  const addExpenseCategoryOption = () => {
    if (!isAdmin) {
      setStatusMessage('إضافة أنواع المصاريف متاحة للأدمن فقط.');
      return;
    }

    const label = newExpenseCategoryLabelInput.trim();
    if (!label) {
      setStatusMessage('اكتب اسم نوع المصروف أولاً.');
      return;
    }

    const existing = effectiveExpenseCategoryOptions.find((option) => {
      const normalizedOptionValue = normalizeExpenseCategoryValue(option.value).toLowerCase();
      const normalizedOptionLabel = option.label.trim().toLowerCase();
      const normalizedInput = normalizeExpenseCategoryValue(label).toLowerCase();
      return normalizedOptionValue === normalizedInput || normalizedOptionLabel === normalizedInput;
    });

    if (existing) {
      setExpenseCategoryInput(existing.value);
      setNewExpenseCategoryLabelInput('');
      setStatusMessage(`نوع المصروف "${existing.label}" موجود مسبقاً.`);
      return;
    }

    const nextOption: ExpenseCategoryOption = {
      value: label,
      label,
    };

    setExpenseCategoryOptions((previous) => mergeExpenseCategoryOptions([...previous, nextOption]));
    setExpenseCategoryInput(nextOption.value);
    setNewExpenseCategoryLabelInput('');
    setStatusMessage(`تمت إضافة نوع مصروف جديد: ${label}.`);
  };

  const beginExpenseEdit = (item: ExpenseRow) => {
    setExpenseEditingId(item.clientExpenseId);
    setExpenseDateInput(item.expenseDate);
    setExpenseCategoryInput(item.category);
    setExpenseDescriptionInput(item.description);
    setExpenseAmountInput(String(item.amount));
    setExpenseNoteInput(item.note ?? '');
    setActiveScreen('expenses');
  };

  const saveExpense = async () => {
    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    if (!canManageExpenses) {
      setStatusMessage('وضع القراءة فقط: إضافة المصاريف متاحة للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل أولاً.');
      return;
    }

    if (!expenseDescriptionInput.trim()) {
      setStatusMessage('أدخل وصف المصروف.');
      return;
    }

    const amount = parseNumberInput(expenseAmountInput);
    if (amount <= 0) {
      setStatusMessage('أدخل مبلغاً صحيحاً.');
      return;
    }

    const expenseCategoryValue = normalizeExpenseCategoryValue(expenseCategoryInput) || 'OTHER';
    const now = new Date().toISOString();

    if (!expenseEditingId) {
      const clientExpenseId = makeId('exp');
      const payload: CreateExpensePayload = {
        clientExpenseId,
        storeId: effectiveStoreId,
        expenseDate: expenseDateInput,
        category: expenseCategoryValue,
        description: expenseDescriptionInput.trim(),
        amount,
        note: expenseNoteInput.trim() || undefined,
        syncedAt: now,
      };

      const localRecord: LocalExpense = {
        ...payload,
        synced: false,
        createdLocallyAt: now,
        updatedLocallyAt: now,
      };

      setExpenses((previous) => {
        const next = [localRecord, ...previous];
        void saveArray(STORAGE_KEYS.expenses, next);
        return next;
      });

      const syncJob: SyncJob = {
        id: makeId('job'),
        referenceId: clientExpenseId,
        retries: 0,
        createdAt: now,
        entity: 'EXPENSE',
        action: 'CREATE',
        payload,
      };

      if (isOnline && authToken) {
        try {
          await postExpense(authToken, payload);
          markExpenseSynced(clientExpenseId);
          await refreshExpensesData();
          setStatusMessage('تم حفظ المصروف في السيرفر.');
        } catch {
          enqueueJob(syncJob);
          setStatusMessage('تم حفظ المصروف محلياً بانتظار المزامنة.');
        }
      } else {
        enqueueJob(syncJob);
        setStatusMessage('تم حفظ المصروف محلياً بانتظار المزامنة.');
      }

      resetExpenseForm();
      return;
    }

    const updatePayload: UpdateExpensePayload = {
      expenseDate: expenseDateInput,
      category: expenseCategoryValue,
      description: expenseDescriptionInput.trim(),
      amount,
      note: expenseNoteInput.trim() || undefined,
      syncedAt: now,
    };

    setExpenses((previous) => {
      const next = previous.map((item) =>
        item.clientExpenseId === expenseEditingId
          ? {
              ...item,
              ...updatePayload,
              synced: false,
              updatedLocallyAt: now,
            }
          : item,
      );
      void saveArray(STORAGE_KEYS.expenses, next);
      return next;
    });

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: expenseEditingId,
      retries: 0,
      createdAt: now,
      entity: 'EXPENSE',
      action: 'UPDATE',
      payload: updatePayload,
    };

    if (isOnline && authToken) {
      try {
        await patchExpense(authToken, expenseEditingId, updatePayload);
        markExpenseSynced(expenseEditingId);
        await refreshExpensesData();
        setStatusMessage('تم تحديث المصروف على السيرفر.');
      } catch {
        enqueueJob(syncJob);
        setStatusMessage('تم تحديث المصروف محلياً بانتظار المزامنة.');
      }
    } else {
      enqueueJob(syncJob);
      setStatusMessage('تم تحديث المصروف محلياً بانتظار المزامنة.');
    }

    resetExpenseForm();
  };

  const deleteExpenseRecord = async (clientExpenseId: string) => {
    if (!canManageExpenses) {
      setStatusMessage('وضع القراءة فقط: حذف المصاريف متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const now = new Date().toISOString();
    setExpenses((previous) => {
      const next = previous.filter((item) => item.clientExpenseId !== clientExpenseId);
      void saveArray(STORAGE_KEYS.expenses, next);
      return next;
    });

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: clientExpenseId,
      retries: 0,
      createdAt: now,
      entity: 'EXPENSE',
      action: 'DELETE',
      payload: { clientExpenseId },
    };

    if (isOnline && authToken) {
      try {
        await deleteExpense(authToken, clientExpenseId);
        await refreshExpensesData();
        setStatusMessage('تم حذف المصروف من السيرفر.');
        return;
      } catch {
        enqueueJob(syncJob);
        setStatusMessage('تم حذف المصروف محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage('تم حذف المصروف محلياً بانتظار المزامنة.');
  };

  const resetProductForm = () => {
    setNewProductNameInput('');
    setNewProductUnitType('PIECE');
    setNewProductSellPriceInput('');
    setNewProductCostPriceInput('');
    setProductEditingId(null);
    setIsProductFormOpen(false);
  };

  const openProductCreateForm = () => {
    setNewProductNameInput('');
    setNewProductUnitType('PIECE');
    setNewProductSellPriceInput('');
    setNewProductCostPriceInput('');
    setProductEditingId(null);
    setIsProductFormOpen(true);
  };

  const beginProductEdit = (productId: string) => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: تعديل المنتجات متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setProductEditingId(product.id);
    setNewProductNameInput(product.name);
    setNewProductUnitType(product.unitType);
    setNewProductSellPriceInput(String(product.price));
    setNewProductCostPriceInput(String(product.costPrice));
    setIsProductFormOpen(true);
    setStatusMessage(`تعديل المنتج ${product.name}.`);
  };

  const saveProductDefinition = async () => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: إضافة/تعديل المنتجات متاحة للكاشير أو الأدمن فقط.');
      return;
    }

    const name = newProductNameInput.trim();
    if (!name) {
      setStatusMessage('أدخل اسم المنتج.');
      return;
    }

    const sellPrice = parseNumberInput(newProductSellPriceInput);
    const costPrice = parseNumberInput(newProductCostPriceInput);
    if (sellPrice <= 0 || costPrice <= 0) {
      setStatusMessage('أدخل سعر بيع وسعر رأس مال صحيحين.');
      return;
    }

    const now = new Date().toISOString();
    const isEditing = Boolean(productEditingId);
    const existingProduct = isEditing
      ? products.find((item) => item.clientProductId === (productEditingId as string))
      : null;
    if (isEditing && !existingProduct) {
      setStatusMessage('تعذر إيجاد المنتج المطلوب تعديله.');
      return;
    }

    const clientProductId = isEditing ? (productEditingId as string) : makeId('prd');
    const nextProduct: LocalProduct = {
      id: clientProductId,
      clientProductId,
      name,
      unitType: newProductUnitType,
      price: sellPrice,
      costPrice,
      synced: false,
      createdLocallyAt: existingProduct?.createdLocallyAt ?? now,
      updatedLocallyAt: now,
    };

    setProducts((previous) => {
      const next = isEditing
        ? previous.map((item) =>
            item.clientProductId === nextProduct.clientProductId ? nextProduct : item,
          )
        : [...previous, nextProduct];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });

    if (isEditing) {
      setCart((previous) =>
        previous.map((item) =>
          item.id === nextProduct.id
            ? {
                ...item,
                name: nextProduct.name,
                unitType: nextProduct.unitType,
                price: nextProduct.price,
                costPrice: nextProduct.costPrice,
              }
            : item,
        ),
      );
    }

    const createPayload: CreateProductPayload = {
      clientProductId,
      name,
      unitType: newProductUnitType,
      price: sellPrice,
      costPrice,
      syncedAt: now,
    };
    const updatePayload: UpdateProductPayload = {
      name,
      unitType: newProductUnitType,
      price: sellPrice,
      costPrice,
      syncedAt: now,
    };

    const syncJob: SyncJob = isEditing
      ? {
          id: makeId('job'),
          referenceId: clientProductId,
          retries: 0,
          createdAt: now,
          entity: 'PRODUCT',
          action: 'UPDATE',
          payload: updatePayload,
        }
      : {
          id: makeId('job'),
          referenceId: clientProductId,
          retries: 0,
          createdAt: now,
          entity: 'PRODUCT',
          action: 'CREATE',
          payload: createPayload,
        };

    resetProductForm();

    if (isOnline && authToken) {
      try {
        if (isEditing) {
          await patchProduct(authToken, clientProductId, updatePayload);
        } else {
          await postProduct(authToken, createPayload);
        }

        markProductSynced(clientProductId);
        await refreshProductsData();
        setStatusMessage(isEditing ? `تم تعديل المنتج ${name} على السيرفر.` : `تمت إضافة المنتج ${name} على السيرفر.`);
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);
        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ المنتج محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage(
          isEditing
            ? `تم تعديل المنتج ${name} محلياً بانتظار المزامنة.`
            : `تمت إضافة المنتج ${name} محلياً بانتظار المزامنة.`,
        );
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage(
      isEditing
        ? `لا يوجد إنترنت: تم تعديل المنتج ${name} محلياً بانتظار المزامنة.`
        : `لا يوجد إنترنت: تمت إضافة المنتج ${name} محلياً بانتظار المزامنة.`,
    );
  };

  const deleteProductDefinition = async (productId: string) => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: حذف المنتجات متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const now = new Date().toISOString();
    setProducts((previous) => previous.filter((item) => item.id !== productId));
    setCart((previous) => previous.filter((item) => item.id !== productId));
    setTodaySupplyInputs((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });
    setSettlementActualInputs((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });

    if (productEditingId === productId) {
      resetProductForm();
    }

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: product.clientProductId,
      retries: 0,
      createdAt: now,
      entity: 'PRODUCT',
      action: 'DELETE',
      payload: { clientProductId: product.clientProductId },
    };

    if (isOnline && authToken) {
      try {
        await deleteProduct(authToken, product.clientProductId);
        await refreshProductsData();
        setStatusMessage(`تم حذف المنتج ${product.name} من السيرفر.`);
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);
        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ حذف المنتج محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage(`تم حذف المنتج ${product.name} محلياً بانتظار المزامنة.`);
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage(`لا يوجد إنترنت: تم حذف المنتج ${product.name} محلياً بانتظار المزامنة.`);
  };

  const updateTodaySupplyInput = (productId: string, value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }

    setTodaySupplyInputs((previous) => ({
      ...previous,
      [productId]: normalized,
    }));
  };

  const receiveTodaySupplies = async () => {
    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: استلام التوريدات متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل أولاً.');
      return;
    }

    const rowsToReceive = productSupplyRows.filter((row) => row.receivedToday > 0);
    if (rowsToReceive.length === 0) {
      setStatusMessage('أدخل كميات التوريد في خانة "نزل اليوم" أولاً.');
      return;
    }

    const missingCost = rowsToReceive.find((row) => row.costPrice <= 0);
    if (missingCost) {
      setStatusMessage(`حدد سعر رأس المال للمنتج ${missingCost.name} قبل الاستلام.`);
      return;
    }

    const now = new Date().toISOString();
    const purchaseDate = now.slice(0, 10);

    const localRecords: LocalPurchase[] = rowsToReceive.map((row) => {
      const payload: CreatePurchasePayload = {
        clientPurchaseId: makeId('pur'),
        storeId: effectiveStoreId,
        productName: row.name,
        quantity: row.receivedToday,
        unitCost: row.costPrice,
        totalCost: Number((row.receivedToday * row.costPrice).toFixed(2)),
        purchaseDate,
        note: `توريد يومي (${row.unitType === 'KG' ? 'كغ' : 'قطعة'})`,
        syncedAt: now,
      };

      return {
        ...payload,
        synced: false,
        createdLocallyAt: now,
        updatedLocallyAt: now,
      };
    });

    setPurchases((previous) => {
      const next = [...localRecords, ...previous];
      void saveArray(STORAGE_KEYS.purchases, next);
      return next;
    });

    setTodaySupplyInputs((previous) => {
      const next = { ...previous };
      rowsToReceive.forEach((row) => {
        delete next[row.productId];
      });
      return next;
    });

    let syncedCount = 0;
    let queuedCount = 0;

    for (const record of localRecords) {
      const payload: CreatePurchasePayload = {
        clientPurchaseId: record.clientPurchaseId,
        storeId: record.storeId,
        productName: record.productName,
        quantity: record.quantity,
        unitCost: record.unitCost,
        totalCost: record.totalCost,
        purchaseDate: record.purchaseDate,
        note: record.note ?? undefined,
        syncedAt: record.syncedAt,
      };

      const syncJob: SyncJob = {
        id: makeId('job'),
        referenceId: record.clientPurchaseId,
        retries: 0,
        createdAt: now,
        entity: 'PURCHASE',
        action: 'CREATE',
        payload,
      };

      if (isOnline && authToken) {
        try {
          await postPurchase(authToken, payload);
          markPurchaseSynced(record.clientPurchaseId);
          syncedCount += 1;
          continue;
        } catch (error: unknown) {
          enqueueJob(syncJob);
          queuedCount += 1;

          if (error instanceof ApiError && error.status === 401) {
            logout('انتهت الجلسة وتم حفظ التوريد محلياً لحين تسجيل الدخول.');
            return;
          }

          continue;
        }
      }

      enqueueJob(syncJob);
      queuedCount += 1;
    }

    if (isOnline && authToken && queuedCount === 0) {
      await refreshPurchasesData();
      setStatusMessage(`تم استلام ${syncedCount} توريد اليوم على السيرفر.`);
      return;
    }

    if (queuedCount > 0) {
      setStatusMessage(`تم حفظ ${rowsToReceive.length} توريد محلياً بانتظار المزامنة.`);
      return;
    }

    setStatusMessage(`تم استلام ${rowsToReceive.length} توريد.`);
  };

  const registerTawasiSupply = async () => {
    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: تسجيل التواصي متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل أولاً.');
      return;
    }

    const capitalAmount = parseNumberInput(tawasiCapitalInput);
    const sellAmount = parseNumberInput(tawasiSellPriceInput);
    if (capitalAmount <= 0 || sellAmount <= 0) {
      setStatusMessage('أدخل رأس مال وسعر مبيع صحيحين للتواصي.');
      return;
    }

    const now = new Date().toISOString();
    const payload: CreatePurchasePayload = {
      clientPurchaseId: makeId('pur'),
      storeId: effectiveStoreId,
      productName: 'تواصي',
      quantity: 1,
      unitCost: capitalAmount,
      totalCost: capitalAmount,
      purchaseDate: now.slice(0, 10),
      note: `تواصي | رأس المال: ${capitalAmount} | سعر المبيع: ${sellAmount}`,
      syncedAt: now,
    };

    const localRecord: LocalPurchase = {
      ...payload,
      synced: false,
      createdLocallyAt: now,
      updatedLocallyAt: now,
    };

    setPurchases((previous) => {
      const next = [localRecord, ...previous];
      void saveArray(STORAGE_KEYS.purchases, next);
      return next;
    });

    setTawasiCapitalInput('');
    setTawasiSellPriceInput('');

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: localRecord.clientPurchaseId,
      retries: 0,
      createdAt: now,
      entity: 'PURCHASE',
      action: 'CREATE',
      payload,
    };

    if (isOnline && authToken) {
      try {
        await postPurchase(authToken, payload);
        markPurchaseSynced(localRecord.clientPurchaseId);
        await refreshPurchasesData();
        setStatusMessage('تم تسجيل التواصي على السيرفر.');
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);

        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ التواصي محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage('تم حفظ التواصي محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage('لا يوجد إنترنت: تم تخزين التواصي محلياً.');
  };

  const deletePurchaseRecord = async (clientPurchaseId: string) => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: حذف المشتريات متاح للكاشير أو الأدمن فقط.');
      return;
    }

    const now = new Date().toISOString();
    setPurchases((previous) => {
      const next = previous.filter((item) => item.clientPurchaseId !== clientPurchaseId);
      void saveArray(STORAGE_KEYS.purchases, next);
      return next;
    });

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: clientPurchaseId,
      retries: 0,
      createdAt: now,
      entity: 'PURCHASE',
      action: 'DELETE',
      payload: { clientPurchaseId },
    };

    if (isOnline && authToken) {
      try {
        await deletePurchase(authToken, clientPurchaseId);
        await refreshPurchasesData();
        setStatusMessage('تم حذف التوريد من السيرفر.');
        return;
      } catch {
        enqueueJob(syncJob);
        setStatusMessage('تم حذف التوريد محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    setStatusMessage('تم حذف التوريد محلياً بانتظار المزامنة.');
  };

  const addEmployeeDefinition = () => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: إدارة الموظفين متاحة للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر الفرع أولاً.');
      return;
    }

    const name = employeeNameInput.trim();
    if (!name) {
      setStatusMessage('أدخل اسم الموظف.');
      return;
    }

    const weeklySalary = parseNumberInput(employeeWeeklySalaryInput);
    if (weeklySalary <= 0) {
      setStatusMessage('أدخل راتب أسبوعي صحيح.');
      return;
    }

    const exists = employees.some(
      (item) =>
        item.storeId === effectiveStoreId &&
        normalizeProductKey(item.name) === normalizeProductKey(name) &&
        item.isActive,
    );
    if (exists) {
      setStatusMessage('الموظف موجود مسبقاً في هذا الفرع.');
      return;
    }

    const now = new Date().toISOString();
    const employee: Employee = {
      id: makeId('emp'),
      storeId: effectiveStoreId,
      name,
      weeklySalary,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    setEmployees((previous) =>
      [...previous, employee].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    );
    setEmployeeNameInput('');
    setEmployeeWeeklySalaryInput('');
    setAbsenceEmployeeIdInput((previous) => previous || employee.id);
    setWithdrawalEmployeeIdInput((previous) => previous || employee.id);
    setStatusMessage(`تمت إضافة الموظف ${name}.`);
  };

  const addEmployeeAbsence = () => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: إدارة الغياب متاحة للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر الفرع أولاً.');
      return;
    }

    if (!absenceEmployeeIdInput) {
      setStatusMessage('اختر الموظف أولاً.');
      return;
    }

    if (!absenceDateInput) {
      setStatusMessage('أدخل تاريخ الغياب.');
      return;
    }

    const duplicate = employeeAbsences.some(
      (item) => item.employeeId === absenceEmployeeIdInput && item.absenceDate === absenceDateInput,
    );
    if (duplicate) {
      setStatusMessage('هذا الغياب مسجل مسبقاً.');
      return;
    }

    const now = new Date().toISOString();
    const nextEntry: EmployeeAbsenceEntry = {
      id: makeId('abs'),
      employeeId: absenceEmployeeIdInput,
      storeId: effectiveStoreId,
      absenceDate: absenceDateInput,
      note: absenceNoteInput.trim() || undefined,
      createdAt: now,
    };

    setEmployeeAbsences((previous) => [nextEntry, ...previous]);
    setAbsenceNoteInput('');
    setStatusMessage('تم تسجيل الغياب.');
  };

  const addEmployeeWithdrawal = () => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: إدارة السحوبات متاحة للكاشير أو الأدمن فقط.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر الفرع أولاً.');
      return;
    }

    if (!withdrawalEmployeeIdInput) {
      setStatusMessage('اختر الموظف أولاً.');
      return;
    }

    if (!withdrawalDateInput) {
      setStatusMessage('أدخل تاريخ السحبة.');
      return;
    }

    const amount = parseNumberInput(withdrawalAmountInput);
    if (amount <= 0) {
      setStatusMessage('أدخل مبلغ سحبة صحيح.');
      return;
    }

    const now = new Date().toISOString();
    const nextEntry: EmployeeWithdrawalEntry = {
      id: makeId('wd'),
      employeeId: withdrawalEmployeeIdInput,
      storeId: effectiveStoreId,
      amount,
      withdrawalDate: withdrawalDateInput,
      note: withdrawalNoteInput.trim() || undefined,
      createdAt: now,
    };

    setEmployeeWithdrawals((previous) => [nextEntry, ...previous]);
    setWithdrawalAmountInput('');
    setWithdrawalNoteInput('');
    setStatusMessage('تم تسجيل السحبة.');
  };

  const removeEmployeeAbsence = (entryId: string) => {
    if (!canManageInventory) {
      return;
    }

    setEmployeeAbsences((previous) => previous.filter((item) => item.id !== entryId));
    setStatusMessage('تم حذف قيد الغياب.');
  };

  const removeEmployeeWithdrawal = (entryId: string) => {
    if (!canManageInventory) {
      return;
    }

    setEmployeeWithdrawals((previous) => previous.filter((item) => item.id !== entryId));
    setStatusMessage('تم حذف قيد السحبة.');
  };

  const updateSettlementActualInput = (productId: string, value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }

    setSettlementActualInputs((previous) => ({
      ...previous,
      [productId]: normalized,
    }));
  };

  const exportExpensesData = async () => {
    const csv = toCsv(
      ['التاريخ', 'الفئة', 'الوصف', 'المبلغ', 'الحالة'],
      filteredExpenseRows.map((item) => [
        item.expenseDate,
        toExpenseCategoryLabel(item.category),
        item.description,
        item.amount,
        item.synced ? 'متزامن' : 'معلق',
      ]),
    );
    await exportCsv(csv, `${EXPORT_FILE_PREFIX}-expenses-${formatDateOnly(new Date().toISOString())}.csv`);
    setStatusMessage('تم تصدير المصاريف.');
  };

  const exportPurchasesData = async () => {
    const csv = toCsv(
      ['التاريخ', 'المنتج', 'الكمية', 'تكلفة الوحدة', 'الإجمالي', 'الملاحظة', 'الحالة'],
      filteredPurchaseRows.map((item) => [
        item.purchaseDate,
        item.productName,
        item.quantity,
        item.unitCost,
        item.totalCost,
        item.note ?? '',
        item.synced ? 'متزامن' : 'معلق',
      ]),
    );
    await exportCsv(csv, `${EXPORT_FILE_PREFIX}-purchases-${formatDateOnly(new Date().toISOString())}.csv`);
    setStatusMessage('تم تصدير المشتريات.');
  };

  const renderPastelBackdrop = () => (
    <View style={[styles.pastelBackdrop, styles.noPointerEvents]}>
      <View style={[styles.pastelBlob, styles.pastelBlobBlueTop]} />
      <View style={[styles.pastelBlob, styles.pastelBlobPinkRight]} />
      <View style={[styles.pastelBlob, styles.pastelBlobBlueBottom]} />
      <View style={[styles.pastelDot, styles.pastelDotOne]} />
      <View style={[styles.pastelDot, styles.pastelDotTwo]} />
      <View style={[styles.pastelDot, styles.pastelDotThree]} />
      <View style={[styles.pastelDot, styles.pastelDotFour]} />
      <View style={[styles.pastelDot, styles.pastelDotFive]} />
      <View style={[styles.pastelDot, styles.pastelDotSix]} />
      <View style={[styles.pastelDot, styles.pastelDotSeven]} />
      <View style={[styles.pastelDot, styles.pastelDotEight]} />
    </View>
  );

  if (isBootstrapping) {
    return (
      <View style={styles.bootRoot}>
        <StatusBar style="dark" />
        {renderPastelBackdrop()}
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={styles.bootText}>يتم تجهيز نظام {BRAND_NAME}...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loginRoot}>
        <StatusBar style="dark" />
        {renderPastelBackdrop()}
        <View style={styles.loginCircleOne} />
        <View style={styles.loginCircleTwo} />
        <View style={styles.loginCard}>
          <Text style={styles.loginBrand}>{BRAND_NAME}</Text>
          <Text style={styles.loginTitle}>{BRAND_SIGNATURE}</Text>
          <Text style={styles.loginHint}>
            {BRAND_CATEGORY} - استخدم حساب الإدارة أو الكاشير المرتبط بالفرع
          </Text>
          <Text style={styles.loginApiHint}>API: {API_BASE_URL}</Text>

          <TextInput
            style={styles.loginInput}
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder="اسم المستخدم"
            placeholderTextColor="#c092b3"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.loginInput}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="كلمة المرور"
            placeholderTextColor="#c092b3"
            secureTextEntry
          />

          <Pressable style={styles.loginButton} onPress={() => void loginUser()} disabled={isLoggingIn}>
            <Text style={styles.loginButtonText}>{isLoggingIn ? 'جاري الدخول...' : 'دخول'}</Text>
          </Pressable>

          <View style={styles.loginDemoBox}>
            <Text style={styles.loginDemoTitle}>حسابات تجريبية</Text>
            <Text style={styles.loginDemoText}>مها / abcd</Text>
            <Text style={styles.loginDemoText}>محافظة / 0000</Text>
            <Text style={styles.loginDemoText}>فرقان / 1111</Text>
            <Text style={styles.loginDemoText}>اندلس / 5555</Text>
          </View>

          <Text style={styles.loginStatus}>{statusMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.appRoot}>
      <StatusBar style="dark" />
      {renderPastelBackdrop()}

      <View style={[styles.shell, !isDesktop && styles.shellMobile]}>
        <View
          style={[
            styles.mainPane,
            !isDesktop && styles.mainPaneMobile,
            isPortraitMobile && styles.mainPanePortraitMobile,
          ]}
          {...swipePanResponder.panHandlers}
        >
          <View style={styles.headerRow}>
            <View style={styles.userBlock}>
              <Text style={styles.title}>{BRAND_NAME}</Text>
              <Text style={styles.subtitleBrand}>{BRAND_FULL}</Text>
              <Text style={styles.subtitle}>مرحباً {session.user.displayName}</Text>
              <Text style={styles.subtitleSmall}>
                {isAdmin ? 'صلاحية: إدارة عامة' : 'صلاحية: كاشير فرع'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
                <Text style={styles.badgeText}>{isOnline ? 'متصل' : 'أوفلاين'}</Text>
              </View>
              {isAdmin && (
                <Pressable style={styles.adminButton} onPress={() => setActiveScreen('admin')}>
                  <Text style={styles.adminButtonText}>لوحة التسوية</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.logoutButton}
                onPress={() => logout('تم تسجيل الخروج بنجاح.')}
              >
                <Text style={styles.logoutButtonText}>خروج</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchRow}>
            <Text style={styles.searchPlaceholder}>ابحث عن طلب، منتج، أو حركة...</Text>
          </View>

          <View style={styles.storeRow}>
            {stores.map((store) => {
              const isSelected = selectedStoreId === store.id;
              const disabled = !canSwitchStore && store.id !== assignedStoreId;
              return (
                <Pressable
                  key={store.id}
                  disabled={!canSwitchStore}
                  onPress={() => {
                    if (canSwitchStore) {
                      setSelectedStoreId(store.id);
                    }
                  }}
                  style={[
                    styles.storeChip,
                    isSelected && styles.storeChipSelected,
                    disabled && styles.storeChipDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.storeChipText,
                      isSelected && styles.storeChipTextSelected,
                      disabled && styles.storeChipTextDisabled,
                    ]}
                  >
                    {store.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showPageSwitchControls && (
            <View style={styles.mobilePageRow}>
              <Text style={styles.mobilePageCurrentText}>{activeScreenLabel}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.content}>
            {activeScreen === 'pos' && (
              <View style={[styles.posWorkspace, !isPosSplit && styles.posWorkspaceMobile]}>
                <View style={[styles.section, styles.posSection, styles.posProductsPane, !isPosSplit && styles.posProductsPaneMobile]}>
                  <Text style={[styles.sectionTitle, styles.posSectionTitle]}>منتجات سريعة</Text>
                  {products.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد منتجات بعد. أضف منتجات من صفحة التوريدات.</Text>
                  ) : (
                    <View style={styles.productsGridCompact}>
                      {products.map((product) => (
                        <View
                          key={product.id}
                          style={[styles.productCardCompact, !isPosSplit && styles.productCardCompactMobile]}
                        >
                          <Text style={styles.productName} numberOfLines={2}>
                            {product.name}
                          </Text>
                          <Text style={styles.productPrice}>{formatMoney(product.price)}</Text>
                          <View style={styles.productActions}>
                            <Pressable
                              style={styles.smallButtonGhostCompact}
                              onPress={() => decreaseProductInCart(product.id)}
                            >
                              <Text style={styles.smallButtonGhostText}>-</Text>
                            </Pressable>
                            <Pressable
                              style={styles.smallButtonSolidCompact}
                              onPress={() => addProductToCart(product.id)}
                            >
                              <Text style={styles.smallButtonSolidText}>+</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.posControlPane, !isPosSplit && styles.posControlPaneMobile]}>
                  <View style={[styles.section, styles.posSection]}>
                    <Text style={[styles.sectionTitle, styles.posSectionTitle]}>لوحة البيع</Text>
                    <View style={styles.padDisplayBox}>
                      <Text style={styles.padDisplayLabel}>الإدخال الحالي</Text>
                      <Text style={styles.padDisplayValue}>{posPadInput || '0'}</Text>
                    </View>
                    <View style={styles.padMetaRow}>
                      <Text style={styles.padMetaText}>الوضع: {isRefundMode ? 'إرجاع' : 'بيع'}</Text>
                      <Text style={styles.padMetaText}>
                        كمية: {pendingMultiplier && pendingMultiplier > 0 ? formatQuantity(pendingMultiplier) : '1'}
                      </Text>
                    </View>
                    <View style={styles.padMetaRow}>
                      <Text style={styles.padMetaText}>
                        مبلغ: {padAmountPreview ? formatMoney(padAmountPreview) : '-'}
                      </Text>
                    </View>
                    <View style={styles.padMetaRow}>
                      <Text style={styles.padMetaText}>كاش مدور: +{formatMoney(carryInAmount)}</Text>
                    </View>

                    <View style={styles.padGrid}>
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '.'].map((key) => (
                        <Pressable key={key} style={styles.padKey} onPress={() => pushPadToken(key)}>
                          <Text style={styles.padKeyText}>{key}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.padActionRow}>
                      <Pressable style={styles.padActionButton} onPress={applyDiscountFromPad}>
                        <Text style={styles.padActionText}>حسم</Text>
                      </Pressable>
                      <Pressable style={styles.padActionButton} onPress={roundPadValue}>
                        <Text style={styles.padActionText}>مدور</Text>
                      </Pressable>
                    </View>
                    <View style={styles.padActionRow}>
                      <Pressable style={styles.padActionButtonPrimary} onPress={activateMultiply}>
                        <Text style={styles.padActionTextPrimary}>ضرب</Text>
                      </Pressable>
                      <Pressable style={styles.padActionButtonPrimary} onPress={activateAmountMode}>
                        <Text style={styles.padActionTextPrimary}>مبلغ</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.padActionButton, isRefundMode && styles.padActionButtonDanger]}
                        onPress={() => setIsRefundMode((previous) => !previous)}
                      >
                        <Text style={styles.padActionText}>إرجاع</Text>
                      </Pressable>
                    </View>
                    <Pressable style={styles.padClearButton} onPress={backspacePad}>
                      <Text style={styles.padClearText}>حذف رقم</Text>
                    </Pressable>
                    <Pressable style={styles.padClearButton} onPress={clearPad}>
                      <Text style={styles.padClearText}>مسح</Text>
                    </Pressable>
                  </View>

                  <View style={[styles.section, styles.posSection]}>
                    <Text style={[styles.sectionTitle, styles.posSectionTitle]}>سلة الطلب</Text>
                    {cart.length === 0 ? (
                      <Text style={styles.emptyText}>لا يوجد عناصر في السلة.</Text>
                    ) : (
                      cart.map((item) => (
                        <View key={item.id} style={styles.cartItemRow}>
                          <Text style={styles.cartItemName}>{item.name}</Text>
                          <Text style={styles.cartItemQty}>x{formatQuantity(item.quantity)}</Text>
                          <Text style={styles.cartItemPrice}>
                            {formatMoney(item.price * item.quantity)}
                          </Text>
                        </View>
                      ))
                    )}

                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={discountInput}
                        onChangeText={setDiscountInput}
                        keyboardType="decimal-pad"
                        placeholder="الخصم"
                        placeholderTextColor="#d7b3c4"
                      />
                      <TextInput
                        style={styles.input}
                        value={taxInput}
                        onChangeText={setTaxInput}
                        keyboardType="decimal-pad"
                        placeholder="الضريبة"
                        placeholderTextColor="#d7b3c4"
                      />
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryText}>المجموع الفرعي: {formatMoney(subtotal)}</Text>
                      <Text style={styles.summaryTextStrong}>الإجمالي: {formatMoney(total)}</Text>
                    </View>

                    <Pressable style={styles.primaryButton} onPress={() => void submitOrder()}>
                      <Text style={styles.primaryButtonText}>
                        {isRefundMode ? 'تسجيل إرجاع' : 'حفظ الطلب'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cancelOrderButton, cart.length === 0 && styles.buttonDisabled]}
                      disabled={cart.length === 0}
                      onPress={cancelCurrentOrder}
                    >
                      <Text style={styles.cancelOrderButtonText}>إلغاء الطلب</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {activeScreen === 'purchases' && (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>استلام التوريدات</Text>
                    <View style={styles.supplyHeaderActions}>
                      <Pressable
                        style={styles.smallRefreshButton}
                        onPress={() => void refreshPurchasesData()}
                      >
                        <Text style={styles.smallRefreshText}>تحديث</Text>
                      </Pressable>
                      <Pressable
                        style={styles.smallRefreshButton}
                        onPress={() => void refreshProductsData()}
                      >
                        <Text style={styles.smallRefreshText}>تحديث الكتالوج</Text>
                      </Pressable>
                      <Pressable
                        style={styles.addProductButton}
                        onPress={() => {
                          if (!canManageInventory) {
                            setStatusMessage(
                              'وضع القراءة فقط: إضافة المنتجات متاحة للكاشير أو الأدمن فقط.',
                            );
                            return;
                          }
                          if (isProductFormOpen) {
                            resetProductForm();
                          } else {
                            openProductCreateForm();
                          }
                        }}
                      >
                        <Text style={styles.addProductButtonText}>
                          {isProductFormOpen ? 'إخفاء + منتج' : '+ منتج جديد'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {!canManageInventory && (
                    <Text style={styles.emptyText}>
                      وضع القراءة فقط: إضافة/تعديل/حذف متاح للكاشير أو الأدمن فقط.
                    </Text>
                  )}

                  <Pressable style={styles.addExpenseFromPurchasesButton} onPress={() => setActiveScreen('expenses')}>
                    <Text style={styles.addExpenseFromPurchasesButtonText}>+ تسجيل مصروف</Text>
                  </Pressable>

                  <View style={styles.supplyAddBox}>
                    <Text style={styles.supplyAddTitle}>تواصي</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={tawasiCapitalInput}
                        onChangeText={setTawasiCapitalInput}
                        keyboardType="decimal-pad"
                        placeholder="رأس مال التواصي"
                        placeholderTextColor="#d7b3c4"
                      />
                      <TextInput
                        style={styles.input}
                        value={tawasiSellPriceInput}
                        onChangeText={setTawasiSellPriceInput}
                        keyboardType="decimal-pad"
                        placeholder="سعر مبيع التواصي"
                        placeholderTextColor="#d7b3c4"
                      />
                    </View>
                    <Pressable
                      style={[styles.supplyActionButtonPrimary, !canManageInventory && styles.buttonDisabled]}
                      disabled={!canManageInventory}
                      onPress={() => void registerTawasiSupply()}
                    >
                      <Text style={styles.supplyActionButtonTextPrimary}>تسجيل تواصي</Text>
                    </Pressable>
                  </View>

                  {isProductFormOpen && (
                    <View style={styles.supplyAddBox}>
                      <Text style={styles.supplyAddTitle}>
                        {productEditingId ? 'تعديل منتج' : 'إضافة منتج جديد'}
                      </Text>
                      <TextInput
                        style={styles.inputFull}
                        value={newProductNameInput}
                        onChangeText={setNewProductNameInput}
                        placeholder="اسم المنتج"
                        placeholderTextColor="#d7b3c4"
                      />
                      <Text style={styles.supplyFieldLabel}>نوع البيع</Text>
                      <View style={styles.categoryRow}>
                        <Pressable
                          style={[
                            styles.storeChip,
                            newProductUnitType === 'PIECE' && styles.storeChipSelected,
                          ]}
                          onPress={() => setNewProductUnitType('PIECE')}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              newProductUnitType === 'PIECE' && styles.storeChipTextSelected,
                            ]}
                          >
                            يباع بالقطعة
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.storeChip, newProductUnitType === 'KG' && styles.storeChipSelected]}
                          onPress={() => setNewProductUnitType('KG')}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              newProductUnitType === 'KG' && styles.storeChipTextSelected,
                            ]}
                          >
                            يباع بالكيلو
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={newProductSellPriceInput}
                          onChangeText={setNewProductSellPriceInput}
                          keyboardType="decimal-pad"
                          placeholder="سعر المبيع"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={newProductCostPriceInput}
                          onChangeText={setNewProductCostPriceInput}
                          keyboardType="decimal-pad"
                          placeholder="سعر الرأس مال"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <View style={styles.supplyActionRow}>
                        <Pressable style={styles.supplyActionButtonPrimary} onPress={saveProductDefinition}>
                          <Text style={styles.supplyActionButtonTextPrimary}>
                            {productEditingId ? 'تحديث المنتج' : 'حفظ المنتج'}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.supplyActionButton} onPress={resetProductForm}>
                          <Text style={styles.supplyActionButtonText}>
                            {productEditingId ? 'إلغاء التعديل' : 'إلغاء'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <View style={styles.supplyColumnsHeader}>
                    <Text style={styles.supplyColumnsHeaderText}>المنتج</Text>
                    <Text style={styles.supplyColumnsHeaderText}>العدد المتبقي</Text>
                    <Text style={styles.supplyColumnsHeaderText}>نزل اليوم</Text>
                  </View>

                  {productSupplyRows.length === 0 ? (
                    <View style={styles.supplyEmptyState}>
                      <Text style={styles.emptyText}>لا توجد منتجات بعد. اضغط + منتج جديد.</Text>
                      <Pressable
                      style={[styles.addProductCtaButton, !canManageInventory && styles.buttonDisabled]}
                      disabled={!canManageInventory}
                      onPress={openProductCreateForm}
                    >
                      <Text style={styles.addProductCtaButtonText}>+ إضافة أول منتج</Text>
                    </Pressable>
                    </View>
                  ) : (
                    productSupplyRows.map((row) => (
                      <View key={row.productId} style={styles.supplyRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{row.name}</Text>
                          <Text style={styles.orderRowMeta}>
                            {row.unitType === 'KG' ? 'يباع بالكيلو' : 'يباع بالقطعة'}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>مبيع: {formatMoney(row.sellPrice)}</Text>
                          <Text style={styles.orderRowMeta}>رأس المال: {formatMoney(row.costPrice)}</Text>
                        </View>
                        <View style={styles.supplyFieldsRow}>
                          <View style={styles.supplyField}>
                            <Text style={styles.supplyFieldLabel}>العدد المتبقي</Text>
                            <TextInput
                              style={[styles.input, styles.supplyReadonlyInput]}
                              value={`${row.remainingQty}`}
                              editable={false}
                              selectTextOnFocus={false}
                            />
                          </View>
                          <View style={styles.supplyField}>
                            <Text style={styles.supplyFieldLabel}>نزل اليوم</Text>
                            <TextInput
                              style={styles.input}
                              value={todaySupplyInputs[row.productId] ?? ''}
                              onChangeText={(value) => updateTodaySupplyInput(row.productId, value)}
                              keyboardType="decimal-pad"
                              placeholder="أدخل الكمية الجديدة"
                              placeholderTextColor="#d7b3c4"
                            />
                            <Text style={styles.supplyLoggedTodayText}>
                              المسجل اليوم: {row.loggedToday}
                            </Text>
                          </View>
                        </View>
                        {canManageInventory && (
                          <View style={styles.rowActionButtons}>
                            <Pressable
                              style={styles.smallRefreshButton}
                              onPress={() => beginProductEdit(row.productId)}
                            >
                              <Text style={styles.smallRefreshText}>تعديل المنتج</Text>
                            </Pressable>
                            <Pressable
                              style={styles.dangerButton}
                              onPress={() => deleteProductDefinition(row.productId)}
                            >
                              <Text style={styles.dangerButtonText}>حذف المنتج</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))
                  )}

                  {!isProductFormOpen && (
                    <Pressable
                      style={[styles.addProductInlineButton, !canManageInventory && styles.buttonDisabled]}
                      disabled={!canManageInventory}
                      onPress={openProductCreateForm}
                    >
                      <Text style={styles.addProductInlineButtonText}>+ منتج جديد</Text>
                    </Pressable>
                  )}

                  <View style={styles.sectionActions}>
                    <Pressable
                      style={[styles.primaryButton, !canManageInventory && styles.buttonDisabled]}
                      disabled={!canManageInventory}
                      onPress={() => void receiveTodaySupplies()}
                    >
                      <Text style={styles.primaryButtonText}>تثبيت توريدات اليوم</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>سجل المشتريات</Text>
                    <Pressable style={styles.smallRefreshButton} onPress={() => void exportPurchasesData()}>
                      <Text style={styles.smallRefreshText}>تصدير CSV</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={purchaseFilterFrom}
                      onChangeText={setPurchaseFilterFrom}
                      placeholder="من تاريخ"
                      placeholderTextColor="#d7b3c4"
                    />
                    <TextInput
                      style={styles.input}
                      value={purchaseFilterTo}
                      onChangeText={setPurchaseFilterTo}
                      placeholder="إلى تاريخ"
                      placeholderTextColor="#d7b3c4"
                    />
                  </View>
                  <TextInput
                    style={styles.inputFull}
                    value={purchaseFilterProduct}
                    onChangeText={setPurchaseFilterProduct}
                    placeholder="فلترة باسم المنتج"
                    placeholderTextColor="#d7b3c4"
                  />

                  {filteredPurchaseRows.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد قيود مشتريات.</Text>
                  ) : (
                    filteredPurchaseRows.map((item) => (
                      <View key={item.clientPurchaseId} style={styles.orderRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{item.productName}</Text>
                          <Text style={styles.orderRowItems}>
                            {item.quantity} × {formatMoney(item.unitCost)}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowTotal}>{formatMoney(item.totalCost)}</Text>
                          <Text style={item.synced ? styles.syncedText : styles.pendingText}>
                            {item.synced ? 'متزامن' : 'معلق'}
                          </Text>
                        </View>
                        <Text style={styles.orderRowMeta}>{item.purchaseDate}</Text>
                        {item.note ? <Text style={styles.orderRowMeta}>{item.note}</Text> : null}
                        {canManageInventory && (
                          <View style={styles.rowActionButtons}>
                            <Pressable
                              style={styles.dangerButton}
                              onPress={() => void deletePurchaseRecord(item.clientPurchaseId)}
                            >
                              <Text style={styles.dangerButtonText}>حذف</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {activeScreen === 'expenses' && (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>تسجيل المصاريف</Text>
                    <Pressable
                      style={styles.smallRefreshButton}
                      onPress={() => void refreshExpensesData()}
                    >
                      <Text style={styles.smallRefreshText}>تحديث</Text>
                    </Pressable>
                  </View>

                  {!canManageExpenses && (
                    <Text style={styles.emptyText}>
                      وضع القراءة فقط: إضافة/تعديل/حذف متاح للكاشير أو الأدمن فقط.
                    </Text>
                  )}

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={expenseDateInput}
                      onChangeText={setExpenseDateInput}
                      placeholder="التاريخ YYYY-MM-DD"
                      placeholderTextColor="#d7b3c4"
                    />
                    <TextInput
                      style={styles.input}
                      value={expenseAmountInput}
                      onChangeText={setExpenseAmountInput}
                      keyboardType="decimal-pad"
                      placeholder="المبلغ"
                      placeholderTextColor="#d7b3c4"
                    />
                  </View>

                  <View style={styles.categoryRow}>
                    {effectiveExpenseCategoryOptions.map((option) => {
                      const selected = expenseCategoryInput === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.storeChip, selected && styles.storeChipSelected]}
                          onPress={() => setExpenseCategoryInput(option.value)}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              selected && styles.storeChipTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {isAdmin ? (
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={newExpenseCategoryLabelInput}
                        onChangeText={setNewExpenseCategoryLabelInput}
                        placeholder="نوع مصروف جديد"
                        placeholderTextColor="#d7b3c4"
                      />
                      <Pressable style={styles.smallRefreshButton} onPress={addExpenseCategoryOption}>
                        <Text style={styles.smallRefreshText}>+ إضافة النوع</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.inputFull}
                    value={expenseDescriptionInput}
                    onChangeText={setExpenseDescriptionInput}
                    placeholder="وصف المصروف"
                    placeholderTextColor="#d7b3c4"
                  />
                  <TextInput
                    style={styles.inputFull}
                    value={expenseNoteInput}
                    onChangeText={setExpenseNoteInput}
                    placeholder="ملاحظة (اختياري)"
                    placeholderTextColor="#d7b3c4"
                  />

                  <View style={styles.sectionActions}>
                    <Pressable
                      style={[styles.primaryButton, !canManageExpenses && styles.buttonDisabled]}
                      disabled={!canManageExpenses}
                      onPress={() => void saveExpense()}
                    >
                      <Text style={styles.primaryButtonText}>
                        {expenseEditingId ? 'تحديث المصروف' : 'إضافة مصروف'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={resetExpenseForm}>
                      <Text style={styles.secondaryButtonText}>إلغاء التعديل</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>سجل المصاريف</Text>
                    <Pressable style={styles.smallRefreshButton} onPress={() => void exportExpensesData()}>
                      <Text style={styles.smallRefreshText}>تصدير CSV</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={expenseFilterFrom}
                      onChangeText={setExpenseFilterFrom}
                      placeholder="من تاريخ"
                      placeholderTextColor="#d7b3c4"
                    />
                    <TextInput
                      style={styles.input}
                      value={expenseFilterTo}
                      onChangeText={setExpenseFilterTo}
                      placeholder="إلى تاريخ"
                      placeholderTextColor="#d7b3c4"
                    />
                  </View>
                  <TextInput
                    style={styles.inputFull}
                    value={expenseFilterText}
                    onChangeText={setExpenseFilterText}
                    placeholder="فلترة حسب الوصف"
                    placeholderTextColor="#d7b3c4"
                  />
                  <View style={styles.categoryRow}>
                    <Pressable
                      style={[
                        styles.storeChip,
                        expenseFilterCategory === 'ALL' && styles.storeChipSelected,
                      ]}
                      onPress={() => setExpenseFilterCategory('ALL')}
                    >
                      <Text
                        style={[
                          styles.storeChipText,
                          expenseFilterCategory === 'ALL' && styles.storeChipTextSelected,
                        ]}
                      >
                        الكل
                      </Text>
                    </Pressable>
                    {effectiveExpenseCategoryOptions.map((option) => {
                      const selected = expenseFilterCategory === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.storeChip, selected && styles.storeChipSelected]}
                          onPress={() => setExpenseFilterCategory(option.value)}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              selected && styles.storeChipTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {filteredExpenseRows.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد قيود مصاريف.</Text>
                  ) : (
                    filteredExpenseRows.map((item) => (
                      <View key={item.clientExpenseId} style={styles.orderRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{item.description}</Text>
                          <Text style={styles.orderRowItems}>{toExpenseCategoryLabel(item.category)}</Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowTotal}>{formatMoney(item.amount)}</Text>
                          <Text style={item.synced ? styles.syncedText : styles.pendingText}>
                            {item.synced ? 'متزامن' : 'معلق'}
                          </Text>
                        </View>
                        <Text style={styles.orderRowMeta}>{item.expenseDate}</Text>
                        {canManageExpenses && (
                          <View style={styles.rowActionButtons}>
                            <Pressable
                              style={styles.smallRefreshButton}
                              onPress={() => beginExpenseEdit(item)}
                            >
                              <Text style={styles.smallRefreshText}>تعديل</Text>
                            </Pressable>
                            <Pressable
                              style={styles.dangerButton}
                              onPress={() => void deleteExpenseRecord(item.clientExpenseId)}
                            >
                              <Text style={styles.dangerButtonText}>حذف</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {activeScreen === 'employees' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>إدارة الموظفين</Text>
                  {!canManageInventory && (
                    <Text style={styles.emptyText}>
                      وضع القراءة فقط: إدارة الموظفين متاحة للكاشير أو الأدمن فقط.
                    </Text>
                  )}
                  <Text style={styles.orderRowMeta}>
                    أسبوع الحساب: {weekStartDate} إلى {weekEndDate} (الموظف مداوم افتراضياً إلا إذا سجلت غياب)
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={employeeWeeklySalaryInput}
                      onChangeText={setEmployeeWeeklySalaryInput}
                      keyboardType="decimal-pad"
                      placeholder="الراتب الأسبوعي"
                      placeholderTextColor="#d7b3c4"
                    />
                    <TextInput
                      style={styles.input}
                      value={employeeNameInput}
                      onChangeText={setEmployeeNameInput}
                      placeholder="اسم الموظف"
                      placeholderTextColor="#d7b3c4"
                    />
                  </View>
                  <Pressable
                    style={[styles.primaryButton, !canManageInventory && styles.buttonDisabled]}
                    disabled={!canManageInventory}
                    onPress={addEmployeeDefinition}
                  >
                    <Text style={styles.primaryButtonText}>+ إضافة موظف</Text>
                  </Pressable>

                  {employeeWeeklySnapshots.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد موظفون في هذا الفرع بعد.</Text>
                  ) : (
                    employeeWeeklySnapshots.map((item) => (
                      <View key={item.employeeId} style={styles.employeeSummaryRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{item.employeeName}</Text>
                          <Text style={styles.orderRowItems}>
                            راتب أسبوعي: {formatMoney(item.weeklySalary)}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>غياب: {item.absenceDays} يوم</Text>
                          <Text style={styles.orderRowMeta}>دوام: {item.attendanceDays} يوم</Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>مستحق: {formatMoney(item.earnedAmount)}</Text>
                          <Text style={item.balance >= 0 ? styles.syncedText : styles.pendingText}>
                            الرصيد: {formatMoney(item.balance)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>تسجيل غياب</Text>
                  {selectedStoreEmployees.length === 0 ? (
                    <Text style={styles.emptyText}>أضف موظف أولاً لتسجيل الغياب.</Text>
                  ) : (
                    <>
                      <View style={styles.categoryRow}>
                        {selectedStoreEmployees.map((employee) => {
                          const selected = absenceEmployeeIdInput === employee.id;
                          return (
                            <Pressable
                              key={employee.id}
                              style={[styles.storeChip, selected && styles.storeChipSelected]}
                              onPress={() => setAbsenceEmployeeIdInput(employee.id)}
                            >
                              <Text style={[styles.storeChipText, selected && styles.storeChipTextSelected]}>
                                {employee.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <TextInput
                        style={styles.inputFull}
                        value={absenceDateInput}
                        onChangeText={setAbsenceDateInput}
                        placeholder="تاريخ الغياب YYYY-MM-DD"
                        placeholderTextColor="#d7b3c4"
                      />
                      <TextInput
                        style={styles.inputFull}
                        value={absenceNoteInput}
                        onChangeText={setAbsenceNoteInput}
                        placeholder="ملاحظة الغياب (اختياري)"
                        placeholderTextColor="#d7b3c4"
                      />
                      <Pressable
                        style={[styles.primaryButton, !canManageInventory && styles.buttonDisabled]}
                        disabled={!canManageInventory}
                        onPress={addEmployeeAbsence}
                      >
                        <Text style={styles.primaryButtonText}>تسجيل الغياب</Text>
                      </Pressable>
                    </>
                  )}

                  {recentAbsenceRows.length > 0 && (
                    <View style={styles.sectionActions}>
                      {recentAbsenceRows.map((entry) => {
                        const employee = selectedStoreEmployees.find((item) => item.id === entry.employeeId);
                        return (
                          <View key={entry.id} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>{employee?.name ?? 'موظف غير معروف'}</Text>
                              <Text style={styles.orderRowItems}>{entry.absenceDate}</Text>
                            </View>
                            {entry.note ? <Text style={styles.orderRowMeta}>{entry.note}</Text> : null}
                            {canManageInventory && (
                              <View style={styles.rowActionButtons}>
                                <Pressable
                                  style={styles.dangerButton}
                                  onPress={() => removeEmployeeAbsence(entry.id)}
                                >
                                  <Text style={styles.dangerButtonText}>حذف</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>تسجيل سحبة</Text>
                  {selectedStoreEmployees.length === 0 ? (
                    <Text style={styles.emptyText}>أضف موظف أولاً لتسجيل السحوبات.</Text>
                  ) : (
                    <>
                      <View style={styles.categoryRow}>
                        {selectedStoreEmployees.map((employee) => {
                          const selected = withdrawalEmployeeIdInput === employee.id;
                          return (
                            <Pressable
                              key={employee.id}
                              style={[styles.storeChip, selected && styles.storeChipSelected]}
                              onPress={() => setWithdrawalEmployeeIdInput(employee.id)}
                            >
                              <Text style={[styles.storeChipText, selected && styles.storeChipTextSelected]}>
                                {employee.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={withdrawalDateInput}
                          onChangeText={setWithdrawalDateInput}
                          placeholder="تاريخ السحبة YYYY-MM-DD"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={withdrawalAmountInput}
                          onChangeText={setWithdrawalAmountInput}
                          keyboardType="decimal-pad"
                          placeholder="المبلغ"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <TextInput
                        style={styles.inputFull}
                        value={withdrawalNoteInput}
                        onChangeText={setWithdrawalNoteInput}
                        placeholder="ملاحظة السحبة (اختياري)"
                        placeholderTextColor="#d7b3c4"
                      />
                      <Pressable
                        style={[styles.primaryButton, !canManageInventory && styles.buttonDisabled]}
                        disabled={!canManageInventory}
                        onPress={addEmployeeWithdrawal}
                      >
                        <Text style={styles.primaryButtonText}>تسجيل السحبة</Text>
                      </Pressable>
                    </>
                  )}

                  {recentWithdrawalRows.length > 0 && (
                    <View style={styles.sectionActions}>
                      {recentWithdrawalRows.map((entry) => {
                        const employee = selectedStoreEmployees.find((item) => item.id === entry.employeeId);
                        return (
                          <View key={entry.id} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>{employee?.name ?? 'موظف غير معروف'}</Text>
                              <Text style={styles.orderRowItems}>{entry.withdrawalDate}</Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowTotal}>{formatMoney(entry.amount)}</Text>
                            </View>
                            {entry.note ? <Text style={styles.orderRowMeta}>{entry.note}</Text> : null}
                            {canManageInventory && (
                              <View style={styles.rowActionButtons}>
                                <Pressable
                                  style={styles.dangerButton}
                                  onPress={() => removeEmployeeWithdrawal(entry.id)}
                                >
                                  <Text style={styles.dangerButtonText}>حذف</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            )}

            {activeScreen === 'orders' && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderInline}>
                  <Text style={styles.sectionTitle}>سجل الطلبات</Text>
                  <Pressable style={styles.smallRefreshButton} onPress={() => void refreshOrdersData()}>
                    <Text style={styles.smallRefreshText}>تحديث</Text>
                  </Pressable>
                </View>

                {mergedOrderRows.length === 0 ? (
                  <Text style={styles.emptyText}>لا يوجد طلبات حالياً.</Text>
                ) : (
                  mergedOrderRows.map((order) => (
                    <Pressable
                      key={order.clientOrderId}
                      style={styles.orderRow}
                      onPress={() => setSelectedOrderInvoice(order)}
                    >
                      <View style={styles.orderRowMain}>
                        <Text style={styles.orderRowId}>{order.clientOrderId}</Text>
                        <Text style={styles.orderRowItems}>
                          {toOrderStatusLabel(order.status)} - {order.itemsCount} عناصر
                        </Text>
                      </View>
                      <View style={styles.orderRowMain}>
                        <Text style={styles.orderRowTotal}>{formatMoney(order.total)}</Text>
                        <Text style={order.synced ? styles.syncedText : styles.pendingText}>
                          {order.synced ? 'متزامن' : 'معلق'}
                        </Text>
                      </View>
                      <Text style={styles.orderRowMeta}>
                        {toShortDate(order.orderedAt)} - {order.source === 'SERVER' ? 'سيرفر' : 'محلي'}
                      </Text>
                      <Text style={styles.orderRowHint}>اضغط لعرض الفاتورة</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeScreen === 'settlement' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>تسوية اليوم</Text>
                  <View style={styles.settlementStatsGrid}>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>مبيعات الدورة</Text>
                      <Text style={styles.settlementStatValue}>{formatMoney(todaySalesTotal)}</Text>
                    </View>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>مرتجعات الدورة</Text>
                      <Text style={styles.settlementStatValue}>{formatMoney(todayRefundTotal)}</Text>
                    </View>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>صافي الدورة</Text>
                      <Text style={styles.settlementStatValue}>{formatMoney(todayNetSales)}</Text>
                    </View>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>توريدات الدورة</Text>
                      <Text style={styles.settlementStatValue}>{formatMoney(todayPurchasesTotal)}</Text>
                    </View>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>مصاريف الدورة</Text>
                      <Text style={styles.settlementStatValue}>{formatMoney(todayExpensesTotal)}</Text>
                    </View>
                    <View style={styles.settlementStatCard}>
                      <Text style={styles.settlementStatLabel}>سحوبات الدورة</Text>
                      <Text style={styles.settlementStatValue}>
                        {formatMoney(todayEmployeeWithdrawalsTotal)}
                      </Text>
                    </View>
                    <View style={styles.settlementStatCardHighlight}>
                      <Text style={styles.settlementStatLabelHighlight}>المبلغ المفروض متبقي</Text>
                      <Text style={styles.settlementStatValueHighlight}>
                        {formatMoney(todayExpectedRemaining)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.orderRowMeta}>
                    المعادلة: (المبيعات - المرتجعات) - المصاريف - التوريدات - سحوبات الموظفين + الكاش المدوّر (بالموجب)
                  </Text>
                  {settlementCycleStartIso ? (
                    <Text style={styles.orderRowMeta}>
                      الدورة الحالية محسوبة من بعد آخر تسوية: {toShortDate(settlementCycleStartIso)}
                    </Text>
                  ) : null}

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={cashBoxInput}
                      onChangeText={updateCashBoxInput}
                      keyboardType="decimal-pad"
                      placeholder="قيمة الصندوق"
                      placeholderTextColor="#d7b3c4"
                    />
                    <TextInput
                      style={styles.input}
                      value={sharesInput}
                      onChangeText={updateSharesInput}
                      keyboardType="decimal-pad"
                      placeholder="قيمة الحصص"
                      placeholderTextColor="#d7b3c4"
                    />
                  </View>
                  <TextInput
                    style={styles.inputFull}
                    value={actualRemainingInput}
                    onChangeText={setActualRemainingInput}
                    keyboardType="decimal-pad"
                    placeholder="المبلغ المتبقي الفعلي مع الكاشير"
                    placeholderTextColor="#d7b3c4"
                  />
                  <Text style={styles.orderRowMeta}>
                    المتبقي الذي سيُرحّل تلقائياً للمدوّر: {formatMoney(settlementCarryForwardAmount)}
                  </Text>
                  <Text
                    style={
                      settlementDifferenceAmount === 0
                        ? styles.settlementDiffNeutral
                        : settlementDifferenceAmount > 0
                          ? styles.settlementDiffPositive
                          : styles.settlementDiffNegative
                    }
                  >
                    فرق التسوية (الفعلي - المتوقع): {formatMoney(settlementDifferenceAmount)}
                  </Text>
                  {settlementOverDistributedAmount > 0 ? (
                    <Text style={styles.pendingText}>
                      تنبيه: المدخلات (صندوق + حصص) أعلى من المتوقع بمقدار{' '}
                      {formatMoney(settlementOverDistributedAmount)}.
                    </Text>
                  ) : null}
                  <TextInput
                    style={styles.inputFull}
                    value={settlementNoteInput}
                    onChangeText={setSettlementNoteInput}
                    placeholder="ملاحظة اليوم (اختياري)"
                    placeholderTextColor="#d7b3c4"
                  />

                  <Text style={styles.storeTableTitle}>ملخص بيع المنتجات للدورة الحالية</Text>
                  {productSalesSummaryRows.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد حركات بيع/إرجاع ضمن الدورة الحالية.</Text>
                  ) : (
                    productSalesSummaryRows.map((row) => (
                      <View key={row.productId} style={styles.orderRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{row.name}</Text>
                          <Text style={styles.orderRowItems}>
                            {row.unitType === 'KG' ? 'كيلو' : 'قطعة'}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>مباع: {row.soldQty}</Text>
                          <Text style={styles.orderRowMeta}>مرتجع: {row.refundedQty}</Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>صافي كمية: {row.netQty}</Text>
                          <Text style={styles.orderRowTotal}>{formatMoney(row.netAmount)}</Text>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={styles.storeTableTitle}>تدقيق مخزون منتجات القطعة</Text>
                  {pieceStockAuditRows.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد منتجات قطعة للتدقيق.</Text>
                  ) : (
                    pieceStockAuditRows.map((row) => (
                      <View key={row.productId} style={styles.orderRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{row.productName}</Text>
                          <Text style={styles.orderRowItems}>المتبقي النظري: {row.expectedQty}</Text>
                        </View>
                        <TextInput
                          style={styles.inputFull}
                          value={settlementActualInputs[row.productId] ?? ''}
                          onChangeText={(value) => updateSettlementActualInput(row.productId, value)}
                          keyboardType="decimal-pad"
                          placeholder="أدخل العدد الفعلي (قطعة)"
                          placeholderTextColor="#d7b3c4"
                        />
                        {row.diffQty !== null ? (
                          <Text
                            style={
                              row.diffQty === 0
                                ? styles.settlementDiffNeutral
                                : row.diffQty > 0
                                  ? styles.settlementDiffPositive
                                  : styles.settlementDiffNegative
                            }
                          >
                            الفرق: {row.diffQty}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryText}>
                      ملاحظة: الفرق الموجب يولد إرجاع تلقائي، والفرق السالب يولد بيع تلقائي.
                    </Text>
                  </View>

                  <Pressable style={styles.secondaryButton} onPress={() => void submitDailySettlement()}>
                    <Text style={styles.secondaryButtonText}>إغلاق اليوم وحفظ التسوية</Text>
                  </Pressable>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>أرشيف التسويات</Text>
                    <Pressable
                      style={styles.smallRefreshButton}
                      onPress={() => void refreshDailySettlementsData()}
                    >
                      <Text style={styles.smallRefreshText}>تحديث</Text>
                    </Pressable>
                  </View>

                  {mergedSettlementRows.length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد تسويات مسجلة بعد.</Text>
                  ) : (
                    mergedSettlementRows.map((item) => (
                      <View key={item.businessDate} style={styles.settlementRow}>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowId}>{item.businessDate}</Text>
                          <Text style={item.synced ? styles.syncedText : styles.pendingText}>
                            {item.synced ? 'متزامن' : 'معلق'}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>
                            صندوق: {formatMoney(item.cashBoxAmount)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            حصص: {formatMoney(item.sharesAmount)}
                          </Text>
                        </View>
                        <View style={styles.orderRowMain}>
                          <Text style={styles.orderRowMeta}>
                            متبقي فعلي: {formatMoney(item.actualRemainingAmount)}
                          </Text>
                          <Text
                            style={
                              item.differenceAmount === 0
                                ? styles.settlementDiffNeutral
                                : item.differenceAmount > 0
                                  ? styles.settlementDiffPositive
                                  : styles.settlementDiffNegative
                            }
                          >
                            فرق: {formatMoney(item.differenceAmount)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {activeScreen === 'admin' && (
              <View style={styles.section}>
                {!isAdmin ? (
                  <Text style={styles.emptyText}>هذه الصفحة متاحة للإدارة فقط.</Text>
                ) : (
                  <>
                    <View style={styles.sectionHeaderInline}>
                      <Text style={styles.sectionTitle}>لوحة تسوية الفروع</Text>
                      <Pressable style={styles.smallRefreshButton} onPress={() => void refreshDashboardData()}>
                        <Text style={styles.smallRefreshText}>تحديث</Text>
                      </Pressable>
                    </View>

                    <View style={styles.inputRow}>
                      <Pressable style={styles.input} onPress={() => openAdminDatePicker('from')}>
                        <Text
                          style={
                            adminFromDateInput
                              ? styles.datePickerInputText
                              : styles.datePickerInputPlaceholder
                          }
                        >
                          {adminFromDateInput || 'اختر من تاريخ'}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.input} onPress={() => openAdminDatePicker('to')}>
                        <Text
                          style={
                            adminToDateInput
                              ? styles.datePickerInputText
                              : styles.datePickerInputPlaceholder
                          }
                        >
                          {adminToDateInput || 'اختر إلى تاريخ'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.rowActionButtons}>
                      <Pressable style={styles.smallRefreshButton} onPress={clearAdminDateFilters}>
                        <Text style={styles.smallRefreshText}>مسح التاريخ</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.orderRowMeta}>
                      التقرير يحسب الحصص/الصندوق/الفرق بين المتبقي المتوقع والفعلي ضمن الفترة المحددة.
                    </Text>

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>إجمالي الحصص</Text>
                        <Text style={styles.metricValue}>
                          {formatMoney(effectiveDashboardTotals.sharesAmount)}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>إجمالي الصندوق</Text>
                        <Text style={styles.metricValue}>
                          {formatMoney(effectiveDashboardTotals.cashBoxAmount)}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>المتبقي المتوقع</Text>
                        <Text style={styles.metricValue}>
                          {formatMoney(effectiveDashboardTotals.expectedCarryForwardAmount)}
                        </Text>
                      </View>
                      <View style={styles.metricCardHighlight}>
                        <Text style={styles.metricLabelHighlight}>فرق التسوية</Text>
                        <Text style={styles.metricValueHighlight}>
                          {formatMoney(effectiveDashboardTotals.settlementDifferenceAmount)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.storeTableTitle}>ملخص كل المحلات</Text>
                    {dashboardSummaries.length === 0 ? (
                      <Text style={styles.emptyText}>لا توجد بيانات من السيرفر بعد.</Text>
                    ) : (
                      dashboardSummaries.map((summary) => (
                        <View key={summary.storeId} style={styles.dashboardRow}>
                          <View style={styles.orderRowMain}>
                            <Text style={styles.dashboardStoreName}>{summary.storeName}</Text>
                            <Text
                              style={
                                summary.settlementDifferenceAmount === 0
                                  ? styles.settlementDiffNeutral
                                  : summary.settlementDifferenceAmount > 0
                                    ? styles.settlementDiffPositive
                                    : styles.settlementDiffNegative
                              }
                            >
                              فرق: {formatMoney(summary.settlementDifferenceAmount)}
                            </Text>
                          </View>
                          <View style={styles.orderRowMain}>
                            <Text style={styles.orderRowMeta}>
                              حصص: {formatMoney(summary.sharesAmount)}
                            </Text>
                            <Text style={styles.orderRowMeta}>
                              صندوق: {formatMoney(summary.cashBoxAmount)}
                            </Text>
                          </View>
                          <View style={styles.orderRowMain}>
                            <Text style={styles.orderRowMeta}>
                              متبقي متوقع: {formatMoney(summary.expectedCarryForwardAmount)}
                            </Text>
                            <Text style={styles.orderRowMeta}>
                              متبقي فعلي: {formatMoney(summary.actualRemainingAmount)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </>
                )}
              </View>
            )}

            {adminDatePickerTarget && Platform.OS === 'android' ? (
              <DateTimePicker
                mode="date"
                value={adminDatePickerValue}
                onChange={onAdminDatePickerChange}
                maximumDate={new Date('2100-12-31T00:00:00')}
                minimumDate={new Date('2000-01-01T00:00:00')}
              />
            ) : null}
            <Modal
              visible={adminDatePickerTarget !== null && Platform.OS !== 'android'}
              transparent
              animationType="fade"
              onRequestClose={closeAdminDatePicker}
            >
              <View style={styles.invoiceOverlay}>
                <View style={styles.datePickerModalCard}>
                  <Text style={styles.sectionTitle}>
                    {adminDatePickerTarget === 'from' ? 'اختر تاريخ البداية' : 'اختر تاريخ النهاية'}
                  </Text>
                  {adminDatePickerTarget ? (
                    <DateTimePicker
                      mode="date"
                      display="spinner"
                      value={adminDatePickerValue}
                      onChange={onAdminDatePickerChange}
                      maximumDate={new Date('2100-12-31T00:00:00')}
                      minimumDate={new Date('2000-01-01T00:00:00')}
                    />
                  ) : null}
                  <View style={styles.rowActionButtons}>
                    <Pressable style={styles.smallRefreshButton} onPress={closeAdminDatePicker}>
                      <Text style={styles.smallRefreshText}>إلغاء</Text>
                    </Pressable>
                    <Pressable style={styles.datePickerConfirmButton} onPress={confirmAdminDatePicker}>
                      <Text style={styles.datePickerConfirmText}>اعتماد التاريخ</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal
              visible={selectedOrderInvoice !== null}
              transparent
              animationType="fade"
              onRequestClose={() => setSelectedOrderInvoice(null)}
            >
              <View style={styles.invoiceOverlay}>
                <View style={styles.invoiceCard}>
                  <View style={styles.sectionHeaderInline}>
                    <Text style={styles.sectionTitle}>فاتورة الطلب</Text>
                    <Pressable
                      style={styles.smallRefreshButton}
                      onPress={() => setSelectedOrderInvoice(null)}
                    >
                      <Text style={styles.smallRefreshText}>إغلاق</Text>
                    </Pressable>
                  </View>

                  {selectedOrderInvoice ? (
                    <>
                      <Text style={styles.orderRowMeta}>الفرع: {selectedStore?.name ?? '-'}</Text>
                      <Text style={styles.orderRowMeta}>رقم الفاتورة: {selectedOrderInvoice.clientOrderId}</Text>
                      <Text style={styles.orderRowMeta}>الكاشير: {selectedOrderInvoice.cashierName}</Text>
                      <Text style={styles.orderRowMeta}>
                        التاريخ: {toShortDate(selectedOrderInvoice.orderedAt)}
                      </Text>
                      <Text style={styles.orderRowMeta}>
                        الحالة: {toOrderStatusLabel(selectedOrderInvoice.status)}
                      </Text>
                      <Text style={styles.orderRowMeta}>
                        الدفع: {toPaymentMethodLabel(selectedOrderInvoice.paymentMethod)}
                      </Text>

                      <Text style={styles.storeTableTitle}>العناصر</Text>
                      <ScrollView style={styles.invoiceItemsList}>
                        {selectedOrderInvoice.items.map((item, index) => (
                          <View key={`${item.productName}-${index}`} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>{item.productName}</Text>
                              <Text style={styles.orderRowItems}>{item.quantity}</Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                سعر الوحدة: {formatMoney(item.unitPrice)}
                              </Text>
                              <Text style={styles.orderRowTotal}>{formatMoney(item.lineTotal)}</Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryText}>
                          المجموع الفرعي: {formatMoney(selectedOrderInvoice.subtotal)}
                        </Text>
                        <Text style={styles.summaryText}>
                          الخصم: {formatMoney(selectedOrderInvoice.discount)}
                        </Text>
                        <Text style={styles.summaryText}>الضريبة: {formatMoney(selectedOrderInvoice.tax)}</Text>
                        <Text style={styles.summaryText}>
                          الإجمالي: {formatMoney(selectedOrderInvoice.total)}
                        </Text>
                        {selectedOrderInvoice.note ? (
                          <Text style={styles.summaryText}>ملاحظة: {selectedOrderInvoice.note}</Text>
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            </Modal>

            <View style={styles.footerStatus}>
              <Text style={styles.footerStatusText}>{statusMessage}</Text>
              <Text style={styles.footerStatusMeta}>
                عمليات بانتظار المزامنة: {queue.length}
                {isSyncing ? ' - جاري الرفع...' : ''}
              </Text>
            </View>
          </ScrollView>
        </View>

        {isDesktop && (
          <View style={styles.sidebar}>
            <Text style={styles.sidebarBrand}>{BRAND_NAME}</Text>
            <Text style={styles.sidebarSubBrand}>{BRAND_CATEGORY}</Text>

            <ScrollView
              style={styles.sidebarNavScroll}
              contentContainerStyle={styles.sidebarNav}
              showsVerticalScrollIndicator={false}
            >
              {navItems.map((item) => {
                const active = activeScreen === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.sidebarNavItem, active && styles.sidebarNavItemActive]}
                    onPress={() => setActiveScreen(item.key)}
                  >
                    <Text style={[styles.sidebarNavText, active && styles.sidebarNavTextActive]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.sidebarNavSubText, active && styles.sidebarNavSubTextActive]}>
                      {item.subtitle}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.sidebarActionButton} onPress={() => setActiveScreen('pos')}>
              <Text style={styles.sidebarActionButtonText}>بيع جديد +</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bootRoot: {
    flex: 1,
    backgroundColor: '#fffafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  bootText: {
    color: '#831843',
    fontWeight: '700',
  },
  pastelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  pastelBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.24,
  },
  pastelBlobBlueTop: {
    width: 220,
    height: 220,
    backgroundColor: '#f9dce9',
    top: -80,
    left: -45,
  },
  pastelBlobPinkRight: {
    width: 260,
    height: 260,
    backgroundColor: '#f8dff0',
    right: -95,
    top: 140,
  },
  pastelBlobBlueBottom: {
    width: 240,
    height: 240,
    backgroundColor: '#f6d6e7',
    bottom: -80,
    left: 70,
  },
  pastelDot: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.42,
  },
  pastelDotOne: {
    width: 12,
    height: 12,
    backgroundColor: '#f3cde5',
    top: 120,
    right: 28,
  },
  pastelDotTwo: {
    width: 9,
    height: 9,
    backgroundColor: '#f2c6db',
    top: 158,
    right: 58,
  },
  pastelDotThree: {
    width: 8,
    height: 8,
    backgroundColor: '#f3cde5',
    top: 198,
    right: 26,
  },
  pastelDotFour: {
    width: 10,
    height: 10,
    backgroundColor: '#efc2d8',
    bottom: 210,
    left: 26,
  },
  pastelDotFive: {
    width: 8,
    height: 8,
    backgroundColor: '#f3cde5',
    bottom: 176,
    left: 52,
  },
  pastelDotSix: {
    width: 12,
    height: 12,
    backgroundColor: '#f4d0e1',
    bottom: 138,
    left: 32,
  },
  pastelDotSeven: {
    width: 9,
    height: 9,
    backgroundColor: '#f1c8df',
    bottom: 98,
    right: 42,
  },
  pastelDotEight: {
    width: 7,
    height: 7,
    backgroundColor: '#f1c7dc',
    bottom: 70,
    right: 72,
  },
  loginRoot: {
    flex: 1,
    backgroundColor: '#fffafc',
    paddingHorizontal: 18,
    paddingTop: 64,
    justifyContent: 'center',
  },
  loginCircleOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#f9e6ec',
    right: -55,
    top: -40,
  },
  loginCircleTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: '#fdeef4',
    left: -60,
    bottom: -20,
  },
  loginCard: {
    borderRadius: 24,
    backgroundColor: '#fffdfd',
    borderWidth: 1,
    borderColor: '#efdbe3',
    padding: 18,
  },
  loginBrand: {
    textAlign: 'center',
    fontSize: 30,
    color: '#be185d',
    fontWeight: '900',
    fontFamily: 'serif',
    letterSpacing: 1.8,
  },
  loginTitle: {
    textAlign: 'center',
    fontSize: 18,
    color: '#ec4899',
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 1.2,
  },
  loginHint: {
    textAlign: 'center',
    color: '#7f4f6f',
    marginTop: 6,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  loginApiHint: {
    textAlign: 'center',
    color: '#8f5d7b',
    fontSize: 11,
    marginBottom: 12,
  },
  loginInput: {
    backgroundColor: '#fdf1f5',
    borderRadius: 12,
    color: '#6a1234',
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 10,
    textAlign: 'right',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#efcadb',
  },
  loginButton: {
    marginTop: 6,
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  loginDemoBox: {
    marginTop: 14,
    backgroundColor: '#fdf2f6',
    borderRadius: 12,
    padding: 10,
  },
  loginDemoTitle: {
    color: '#9d174d',
    textAlign: 'right',
    fontWeight: '800',
    marginBottom: 4,
  },
  loginDemoText: {
    color: '#935682',
    textAlign: 'right',
    fontWeight: '600',
    marginTop: 2,
  },
  loginStatus: {
    marginTop: 10,
    textAlign: 'center',
    color: '#7f4f6f',
    fontWeight: '600',
    fontSize: 13,
  },
  appRoot: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  shell: {
    flex: 1,
    flexDirection: 'row-reverse',
  },
  shellMobile: {
    flexDirection: 'column',
  },
  mainPane: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  mainPaneMobile: {
    paddingTop: 28,
    paddingHorizontal: 13,
  },
  mainPanePortraitMobile: {
    paddingTop: 32,
    paddingHorizontal: 14,
  },
  sidebar: {
    width: 168,
    paddingTop: 70,
    paddingHorizontal: 10,
    backgroundColor: '#fceff3',
    borderLeftWidth: 1,
    borderLeftColor: '#efdbe2',
    justifyContent: 'flex-start',
    paddingBottom: 22,
  },
  sidebarBrand: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '900',
    color: '#be185d',
    fontFamily: 'serif',
    letterSpacing: 1.8,
  },
  sidebarSubBrand: {
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 16,
    color: '#ec4899',
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sidebarNavScroll: {
    flex: 1,
    minHeight: 0,
    marginTop: 4,
    marginBottom: 12,
  },
  sidebarNav: {
    gap: 8,
    paddingBottom: 8,
  },
  sidebarNavItem: {
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  sidebarNavItemActive: {
    backgroundColor: '#f4d9e7',
  },
  sidebarNavText: {
    textAlign: 'right',
    color: '#8f4c74',
    fontWeight: '800',
    fontSize: 13,
  },
  sidebarNavTextActive: {
    color: '#9d174d',
  },
  sidebarNavSubText: {
    textAlign: 'right',
    color: '#d3aebf',
    fontSize: 11,
    marginTop: 2,
  },
  sidebarNavSubTextActive: {
    color: '#a77097',
  },
  sidebarActionButton: {
    marginTop: 'auto',
    backgroundColor: '#ec4899',
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sidebarActionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  userBlock: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#be185d',
    textAlign: 'right',
    fontFamily: 'serif',
    letterSpacing: 1.4,
  },
  subtitleBrand: {
    fontSize: 11,
    color: '#ec4899',
    marginTop: -1,
    textAlign: 'right',
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#ae7ca1',
    marginTop: 4,
    textAlign: 'right',
  },
  subtitleSmall: {
    fontSize: 11,
    color: '#cfa8c0',
    marginTop: 2,
    textAlign: 'right',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  adminButton: {
    backgroundColor: '#f8e8ee',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adminButtonText: {
    color: '#9d174d',
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeOnline: {
    backgroundColor: '#f8e8ee',
  },
  badgeOffline: {
    backgroundColor: '#fdecef',
  },
  badgeText: {
    fontWeight: '700',
    color: '#9d174d',
  },
  logoutButton: {
    backgroundColor: '#fbe8ee',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: '#831843',
    fontWeight: '700',
  },
  searchRow: {
    backgroundColor: '#fdeef4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchPlaceholder: {
    textAlign: 'right',
    color: '#7c4f68',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    paddingBottom: 40,
  },
  storeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  mobilePageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobilePageCurrentText: {
    width: '100%',
    textAlign: 'center',
    color: '#9d174d',
    fontWeight: '800',
    fontSize: 14,
  },
  storeChip: {
    backgroundColor: '#f8e8ee',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  storeChipSelected: {
    backgroundColor: '#ec4899',
  },
  storeChipDisabled: {
    opacity: 0.55,
  },
  storeChipText: {
    color: '#6f1536',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'right',
  },
  storeChipTextSelected: {
    color: '#ffffff',
  },
  storeChipTextDisabled: {
    color: '#c395b5',
  },
  section: {
    backgroundColor: '#fffbfd',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1e0e7',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#7a123a',
    textAlign: 'right',
    marginBottom: 12,
  },
  sectionHeaderInline: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  productsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  posWorkspace: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 8,
  },
  posWorkspaceMobile: {
    flexDirection: 'column',
  },
  posControlPane: {
    flex: 1.35,
    width: '57%',
    gap: 6,
  },
  posControlPaneMobile: {
    width: '100%',
    flex: 0,
  },
  posProductsPane: {
    flex: 1,
    width: '43%',
  },
  posProductsPaneMobile: {
    width: '100%',
    flex: 0,
  },
  posSection: {
    padding: 8,
    borderColor: '#f0d3e0',
    boxShadow: '0px 2px 6px rgba(198, 107, 144, 0.06)',
    elevation: 1,
  },
  posSectionTitle: {
    fontSize: 15,
    marginBottom: 8,
  },
  productsGridCompact: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
  },
  productCardCompact: {
    width: '31%',
    minWidth: 0,
    backgroundColor: '#fbe8ee',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#efcad4',
  },
  productCardCompactMobile: {
    width: '31%',
    minWidth: 0,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fbe8ee',
    borderRadius: 14,
    padding: 10,
  },
  productName: {
    color: '#701a3a',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    textAlign: 'right',
  },
  productPrice: {
    color: '#db2777',
    marginTop: 5,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'right',
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  smallButtonGhost: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbfd',
  },
  smallButtonGhostCompact: {
    width: 28,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbfd',
  },
  smallButtonGhostText: {
    color: '#ec4899',
    fontWeight: '900',
    fontSize: 15,
  },
  smallButtonSolid: {
    width: 36,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ec4899',
  },
  smallButtonSolidCompact: {
    width: 28,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ec4899',
  },
  smallButtonSolidText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
  },
  emptyText: {
    color: '#7f4f6f',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  cartItemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f2e2e8',
    paddingVertical: 8,
  },
  cartItemName: {
    flex: 1,
    color: '#9d174d',
    fontWeight: '600',
    textAlign: 'right',
  },
  cartItemQty: {
    width: 52,
    color: '#9a5e88',
    textAlign: 'center',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cartItemPrice: {
    width: 100,
    color: '#9d174d',
    textAlign: 'left',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inputRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fdf2f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#6a1234',
    textAlign: 'right',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#efcadb',
  },
  datePickerInputText: {
    color: '#6a1234',
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerInputPlaceholder: {
    color: '#d7b3c4',
    textAlign: 'right',
    fontSize: 16,
  },
  padDisplayBox: {
    backgroundColor: '#fdf2f6',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  padDisplayLabel: {
    color: '#b88bad',
    textAlign: 'right',
    fontWeight: '600',
    fontSize: 11,
  },
  padDisplayValue: {
    color: '#9d174d',
    textAlign: 'right',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 2,
  },
  padMetaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 3,
  },
  padMetaText: {
    color: '#ae7ca1',
    fontWeight: '700',
    fontSize: 10,
  },
  padGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  padKey: {
    width: '31.5%',
    minWidth: 40,
    backgroundColor: '#f8e8ee',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#efcad4',
  },
  padKeyText: {
    color: '#831843',
    fontWeight: '900',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  padActionRow: {
    marginTop: 6,
    flexDirection: 'row-reverse',
    gap: 5,
  },
  padActionButton: {
    flex: 1,
    backgroundColor: '#f8e8ee',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  padActionButtonPrimary: {
    flex: 1,
    backgroundColor: '#ec4899',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  padActionButtonDanger: {
    backgroundColor: '#fdecef',
    borderWidth: 1,
    borderColor: '#efcad4',
  },
  padActionText: {
    color: '#831843',
    fontWeight: '800',
    fontSize: 13,
  },
  padActionTextPrimary: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  padClearButton: {
    marginTop: 6,
    backgroundColor: '#fdeef4',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 6,
  },
  padClearText: {
    color: '#975985',
    fontWeight: '700',
    fontSize: 12,
  },
  inputFull: {
    marginTop: 10,
    backgroundColor: '#fdf2f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#6a1234',
    textAlign: 'right',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#efcadb',
  },
  summaryRow: {
    marginTop: 12,
    gap: 4,
  },
  summaryText: {
    color: '#9a5e88',
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryTextStrong: {
    color: '#9d174d',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  cancelOrderButton: {
    marginTop: 8,
    backgroundColor: '#fdecef',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#efcad4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelOrderButtonText: {
    color: '#db2777',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#9d174d',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionActions: {
    marginTop: 10,
    gap: 8,
  },
  supplyAddBox: {
    marginTop: 8,
    backgroundColor: '#fff6fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#efd4e3',
    padding: 10,
  },
  supplyAddTitle: {
    color: '#9d174d',
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 6,
  },
  supplyActionRow: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  supplyActionButtonPrimary: {
    flex: 1,
    backgroundColor: '#ec4899',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  supplyActionButtonTextPrimary: {
    color: '#ffffff',
    fontWeight: '800',
  },
  supplyActionButton: {
    flex: 1,
    backgroundColor: '#f8e8ee',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  supplyActionButtonText: {
    color: '#9d174d',
    fontWeight: '800',
  },
  supplyRow: {
    marginTop: 8,
    backgroundColor: '#fff6fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f2dbe6',
    padding: 10,
    gap: 6,
  },
  supplyColumnsHeader: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  supplyColumnsHeaderText: {
    color: '#ae7ca1',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'right',
    width: '33%',
  },
  supplyEmptyState: {
    marginTop: 10,
    gap: 8,
  },
  addProductCtaButton: {
    backgroundColor: '#ec4899',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addProductCtaButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  addProductInlineButton: {
    marginTop: 8,
    backgroundColor: '#f8e8ee',
    borderWidth: 1,
    borderColor: '#e9c7d6',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addProductInlineButtonText: {
    color: '#9d174d',
    fontWeight: '800',
  },
  supplyFieldsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  supplyField: {
    flex: 1,
  },
  supplyFieldLabel: {
    color: '#ae7ca1',
    fontWeight: '700',
    textAlign: 'right',
    fontSize: 11,
    marginBottom: 4,
  },
  supplyReadonlyInput: {
    color: '#9d174d',
    backgroundColor: '#f7e7ef',
  },
  supplyLoggedTodayText: {
    color: '#ae7ca1',
    textAlign: 'right',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  supplyInfoBox: {
    flex: 1,
    backgroundColor: '#fdf2f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#efd8e3',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  supplyInfoLabel: {
    color: '#ae7ca1',
    fontWeight: '700',
    textAlign: 'right',
    fontSize: 11,
  },
  supplyInfoValue: {
    color: '#9d174d',
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 2,
    fontSize: 15,
  },
  rowActionButtons: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#fdecef',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#db2777',
    fontWeight: '800',
  },
  smallRefreshButton: {
    backgroundColor: '#f8e8ee',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  smallRefreshText: {
    color: '#9d174d',
    fontWeight: '700',
  },
  supplyHeaderActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  addProductButton: {
    backgroundColor: '#ec4899',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addProductButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  addExpenseFromPurchasesButton: {
    marginTop: 8,
    backgroundColor: '#f8e8ee',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8c9d6',
    paddingVertical: 9,
    alignItems: 'center',
  },
  addExpenseFromPurchasesButtonText: {
    color: '#9d174d',
    fontWeight: '800',
  },
  employeeSummaryRow: {
    marginTop: 8,
    backgroundColor: '#fff6fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f2e2e8',
    padding: 10,
    gap: 6,
  },
  settlementStatsGrid: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  settlementStatCard: {
    width: '48%',
    backgroundColor: '#fdf1f6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#efd7e3',
  },
  settlementStatLabel: {
    color: '#ae7ca1',
    fontWeight: '700',
    textAlign: 'right',
    fontSize: 11,
  },
  settlementStatValue: {
    color: '#9d174d',
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 4,
    fontSize: 14,
  },
  settlementStatCardHighlight: {
    width: '98%',
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 11,
  },
  settlementStatLabelHighlight: {
    color: '#fdeff4',
    fontWeight: '700',
    textAlign: 'right',
    fontSize: 12,
  },
  settlementStatValueHighlight: {
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 4,
    fontSize: 18,
  },
  settlementDiffPositive: {
    color: '#be185d',
    textAlign: 'right',
    fontWeight: '700',
  },
  settlementDiffNegative: {
    color: '#ec4899',
    textAlign: 'right',
    fontWeight: '800',
  },
  settlementDiffNeutral: {
    color: '#9a5e88',
    textAlign: 'right',
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fbe8ee',
    borderRadius: 14,
    padding: 12,
  },
  metricLabel: {
    color: '#ae7ca1',
    fontWeight: '600',
    textAlign: 'right',
  },
  metricValue: {
    color: '#9d174d',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 6,
    textAlign: 'right',
  },
  metricCardHighlight: {
    width: '48%',
    backgroundColor: '#ec4899',
    borderRadius: 14,
    padding: 12,
  },
  metricLabelHighlight: {
    color: '#fdeff4',
    fontWeight: '600',
    textAlign: 'right',
  },
  metricValueHighlight: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 19,
    marginTop: 6,
    textAlign: 'right',
  },
  orderRow: {
    backgroundColor: '#fff6fa',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f2e2e8',
    gap: 6,
  },
  settlementRow: {
    backgroundColor: '#fff6fa',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f2e2e8',
    gap: 8,
  },
  orderRowMain: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderRowId: {
    color: '#9d174d',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  orderRowItems: {
    color: '#9a5e88',
    fontWeight: '600',
    width: 90,
    textAlign: 'left',
  },
  orderRowTotal: {
    color: '#9d174d',
    fontWeight: '800',
    textAlign: 'right',
  },
  orderRowMeta: {
    color: '#7d4f69',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
  },
  orderRowHint: {
    color: '#9d174d',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'left',
  },
  syncedText: {
    color: '#9a5e88',
    fontWeight: '700',
    textAlign: 'left',
  },
  pendingText: {
    color: '#ec4899',
    fontWeight: '700',
    textAlign: 'left',
  },
  storeTableTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: '#9d174d',
    textAlign: 'right',
    fontWeight: '800',
    fontSize: 16,
  },
  dashboardRow: {
    backgroundColor: '#fff5f9',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0dfe6',
  },
  dashboardStoreName: {
    color: '#9d174d',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'right',
  },
  invoiceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 20, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  invoiceCard: {
    backgroundColor: '#fffafd',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0d8e4',
    maxHeight: '90%',
    gap: 8,
  },
  datePickerModalCard: {
    backgroundColor: '#fffafd',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0d8e4',
    gap: 8,
  },
  datePickerConfirmButton: {
    backgroundColor: '#ec4899',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  datePickerConfirmText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  invoiceItemsList: {
    maxHeight: 260,
  },
  footerStatus: {
    backgroundColor: '#9d174d',
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },
  footerStatusText: {
    color: '#fff3f8',
    textAlign: 'right',
    fontWeight: '600',
    fontSize: 14,
  },
  footerStatusMeta: {
    color: '#eeced9',
    textAlign: 'right',
    marginTop: 4,
    fontSize: 13,
  },
});


