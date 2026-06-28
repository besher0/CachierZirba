import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { STORAGE_KEYS } from "../config";
import { ApiError, fetchCloudinarySignature } from "../services/api";
import {
  getExpectedSettlementCarryForwardAmount,
  getSettlementDifferenceAmount,
} from "../models/settlement";
import {
  ApiDailySettlement,
  ApiExpense,
  ApiOrder,
  ApiProduct,
  ApiPurchase,
  AppScreenKey,
  EmployeeWithdrawalEntry,
  ExpenseCategory,
  LocalDailySettlement,
  LocalExpense,
  LocalOrder,
  LocalProduct,
  LocalPurchase,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PurchaseKind,
  ProductTemplate,
  SyncJob,
} from "../types";
import {
  correctLegacyUtcDateOnly,
  toDateTimeMinuteInTimeZone,
} from "../utils/businessDate";

export interface OrderHistoryRow {
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
  source: "LOCAL" | "SERVER";
}

export interface SettlementHistoryRow {
  businessDate: string;
  clientClosureId: string;
  cashBoxAmount: number;
  sharesAmount: number;
  expectedRevenue: number;
  carryInAmount: number;
  actualRemainingAmount: number;
  expectedRemainingAmount: number;
  differenceAmount: number;
  note?: string;
  syncedAt: string;
  synced: boolean;
  source: "LOCAL" | "SERVER";
}

export interface ExpenseRow {
  clientExpenseId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  imageUrl?: string;
  localImageUri?: string;
  note?: string;
  synced: boolean;
  occurredAt: string;
}

export interface PurchaseRow {
  clientPurchaseId: string;
  purchaseDate: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseKind: PurchaseKind;
  sellPrice: number;
  paymentAmount: number;
  note?: string;
  synced: boolean;
  occurredAt: string;
}

export interface ExpenseCategoryOption {
  value: ExpenseCategory;
  label: string;
}

export interface NavItem {
  key: AppScreenKey;
  label: string;
  subtitle: string;
}

export interface ProductSupplyRow {
  productId: string;
  name: string;
  unitType: ProductTemplate["unitType"];
  sellPrice: number;
  costPrice: number;
  remainingQty: number;
  previousRemainingQty: number;
  receivedToday: number;
  loggedToday: number;
}

export interface ProductSalesSummaryRow {
  productId: string;
  name: string;
  unitType: ProductTemplate["unitType"];
  soldQty: number;
  refundedQty: number;
  netQty: number;
  netAmount: number;
}

export interface SettlementDayDetail {
  businessDate: string;
  orders: OrderHistoryRow[];
  expenses: ExpenseRow[];
  purchases: PurchaseRow[];
  withdrawals: Array<EmployeeWithdrawalEntry & { employeeName: string }>;
  note?: string;
  salesAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  expensesAmount: number;
  purchasesAmount: number;
  withdrawalsAmount: number;
  productSalesSummaryRows: ProductSalesSummaryRow[];
  carryInAmount: number;
  expectedBeforeDistributionAmount: number;
  distributedAmount: number;
  expectedRemainingAmount: number;
  actualRemainingAmount: number;
  differenceAmount: number;
  sharesAmount: number;
  cashBoxAmount: number;
}

export interface MobileNavItem {
  key: AppScreenKey | "admin";
  label: string;
  subtitle: string;
}

export const moneyFormatter = new Intl.NumberFormat("ar-SY-u-nu-latn", {
  style: "currency",
  currency: "SYP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export const BRAND_NAME = "ZERBE";
export const BRAND_SIGNATURE = "SHEIKH HANNA";
export const BRAND_CATEGORY = "PATISSERIE";
export const BRAND_FULL = `${BRAND_SIGNATURE} ${BRAND_CATEGORY}`;
export const EXPORT_FILE_PREFIX = "zerbe";
export const CLICK_SOUND_SOURCE = require("../../assets/click.wav");
export const MISC_CART_ITEM_ID = "__MISC__";
export const MISC_CART_ITEM_NAME = "منوعات";
export const PRODUCT_ORDER_STORAGE_KEY = `${STORAGE_KEYS.products}.orderByStore.v1`;
export const POS_PRODUCT_COLUMNS_DESKTOP = 4;
export const POS_PRODUCT_COLUMNS_MOBILE = 4;

export type PosProductGridItem = LocalProduct & {
  key: string;
  disabledDrag?: boolean;
  disabledReSorted?: boolean;
};

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function normalizeNumericInputText(value: string): string {
  const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

  let normalized = value
    .trim()
    .replace(/\u00A0/g, "")
    .replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/\s+/g, "");

  if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(/,/g, ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  normalized = normalized.replace(/[^0-9.+-]/g, "");
  return normalized;
}

export function parseNumberInput(value: string): number {
  const normalized = normalizeNumericInputText(value);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Number(value.toFixed(3));
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return String(rounded).replace(/\.?0+$/, "");
}

export function normalizeIsoTimestamp(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function normalizeQuantityForUnit(
  unitType: ProductTemplate["unitType"],
  value: number,
): number {
  if (unitType === "KG") {
    return Number(value.toFixed(3));
  }

  return Math.floor(value);
}

export function normalizeProductKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildProductsFromHistory(
  purchases: Array<Pick<LocalPurchase, "productName" | "unitCost">>,
  orders: Array<Pick<LocalOrder, "items">>,
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
      id: makeId("prd"),
      name,
      unitType: "PIECE",
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
        id: makeId("prd"),
        name,
        unitType: "PIECE",
        costPrice: item.unitPrice > 0 ? item.unitPrice : 0,
        price: item.unitPrice > 0 ? item.unitPrice : 0,
      });
    });
  });

  return Array.from(byKey.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ar"),
  );
}

export function mapApiProductToLocal(product: ApiProduct): LocalProduct {
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

export function toLocalProduct(
  product: ProductTemplate,
  fallbackCreatedAt?: string,
): LocalProduct {
  const nowIso = new Date().toISOString();
  const clientProductId =
    (product as LocalProduct).clientProductId ?? product.id;
  const createdLocallyAt =
    (product as LocalProduct).createdLocallyAt ?? fallbackCreatedAt ?? nowIso;
  const updatedLocallyAt =
    (product as LocalProduct).updatedLocallyAt ?? createdLocallyAt;

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

export function mergeProductsWithRemote(
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

  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ar"),
  );
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("failed to fetch") ||
      message.includes("timeout")
    );
  }

  return false;
}

export function extractApiMessage(error: ApiError): string | null {
  if (!error.bodyText) {
    return null;
  }

  try {
    const parsed = JSON.parse(error.bodyText) as {
      message?: string | string[];
    };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" - ");
    }

    if (
      typeof parsed.message === "string" &&
      parsed.message.trim().length > 0
    ) {
      return parsed.message.trim();
    }
  } catch {
    const raw = error.bodyText.trim();
    return raw.length > 0 ? raw : null;
  }

  return null;
}

export async function loadArray<T>(key: string): Promise<T[]> {
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

export async function saveArray<T>(key: string, value: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local persistence failure to keep app usable.
  }
}

export async function loadObject<T>(key: string): Promise<T | null> {
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

export async function saveObject<T>(key: string, value: T | null): Promise<void> {
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

export function sortProductsByLocalOrder(
  sourceProducts: LocalProduct[],
  orderedIds: string[],
): LocalProduct[] {
  if (orderedIds.length === 0) {
    return [...sourceProducts];
  }

  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
  return [...sourceProducts].sort((a, b) => {
    const aIndex = orderIndex.get(a.id);
    const bIndex = orderIndex.get(b.id);
    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }
    if (aIndex !== undefined) {
      return -1;
    }
    if (bIndex !== undefined) {
      return 1;
    }
    return a.name.localeCompare(b.name, "ar");
  });
}

export function inferMimeTypeFromUri(uri: string): string {
  const extension = uri.split(".").pop()?.toLowerCase();
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "heic" || extension === "heif") {
    return "image/heic";
  }
  return "image/jpeg";
}

export function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

export async function persistExpenseImageLocally(
  sourceUri: string,
  clientExpenseId: string,
): Promise<string> {
  const extension = sourceUri.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";

  try {
    const rootDirectory = FileSystem.Paths.document ?? FileSystem.Paths.cache;
    const imagesDirectory = new FileSystem.Directory(
      rootDirectory,
      "expense-images",
    );
    imagesDirectory.create({ idempotent: true, intermediates: true });

    const targetFile = new FileSystem.File(
      imagesDirectory,
      `${clientExpenseId}.${safeExtension}`,
    );
    if (sourceUri !== targetFile.uri) {
      const sourceFile = new FileSystem.File(sourceUri);
      sourceFile.copy(targetFile);
    }
    return targetFile.uri;
  } catch {
    return sourceUri;
  }
}

export async function uploadExpenseImageToCloudinary(
  token: string,
  localImageUri: string,
): Promise<string> {
  const signature = await fetchCloudinarySignature(token);
  const mimeType = inferMimeTypeFromUri(localImageUri);
  const fileName = `${signature.publicId}.${mimeType.split("/")[1] ?? "jpg"}`;

  const formData = new FormData();
  formData.append("file", {
    uri: localImageUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);
  formData.append("public_id", signature.publicId);

  const response = await fetch(signature.uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    secure_url?: string;
    url?: string;
  };
  const uploadedUrl = payload.secure_url ?? payload.url;
  if (!uploadedUrl) {
    throw new Error("Cloudinary response missing uploaded URL.");
  }

  return uploadedUrl;
}

export function toShortDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate.replace("T", " ").slice(0, 16);
  }

  return toDateTimeMinuteInTimeZone(parsed);
}

export function toOrderStatusLabel(status: OrderStatus): string {
  return status === "REFUNDED" ? "مرتجع" : "مكتمل";
}

export function toPaymentMethodLabel(paymentMethod: PaymentMethod): string {
  if (paymentMethod === "CARD") {
    return "بطاقة";
  }

  if (paymentMethod === "MIXED") {
    return "مختلط";
  }

  return "كاش";
}

export function normalizeExpenseCategoryValue(value: string): string {
  return value.trim();
}

export function toExpenseCategoryFallbackLabel(value: string): string {
  const normalized = normalizeExpenseCategoryValue(value);
  if (normalized === "CLEANING") {
    return "منظفات";
  }
  if (normalized === "DRINKS") {
    return "مشروبات";
  }
  if (normalized === "OTHER") {
    return "أخرى";
  }
  if (normalized === "RAW_MATERIALS") {
    return "مواد خام";
  }
  if (normalized === "UTILITIES") {
    return "مرافق";
  }
  if (normalized === "SALARIES") {
    return "رواتب";
  }
  if (normalized === "MARKETING") {
    return "تسويق";
  }
  return normalized;
}

export function mergeExpenseCategoryOptions(
  options: ExpenseCategoryOption[],
): ExpenseCategoryOption[] {
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

export function mapApiOrderToRow(order: ApiOrder): OrderHistoryRow {
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
    source: "SERVER",
  };
}

export function mapLocalOrderToRow(order: LocalOrder): OrderHistoryRow {
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
    source: "LOCAL",
  };
}

export function mapApiSettlementToRow(item: ApiDailySettlement): SettlementHistoryRow {
  const expectedRevenue = Number((item.expectedRevenue ?? 0).toFixed(2));
  const expectedRemainingClamped = getExpectedSettlementCarryForwardAmount(
    expectedRevenue,
    item.cashBoxAmount,
    item.sharesAmount,
  );
  const actualRemainingAmount = Number(
    (item.actualRemainingAmount ?? 0).toFixed(2),
  );
  return {
    businessDate: item.businessDate,
    clientClosureId: item.clientClosureId,
    cashBoxAmount: item.cashBoxAmount,
    sharesAmount: item.sharesAmount,
    expectedRevenue,
    carryInAmount: Number((item.carryInAmount ?? 0).toFixed(2)),
    actualRemainingAmount,
    expectedRemainingAmount: expectedRemainingClamped,
    differenceAmount: getSettlementDifferenceAmount(
      actualRemainingAmount,
      expectedRevenue,
    ),
    note: item.note,
    syncedAt: item.syncedAt,
    synced: true,
    source: "SERVER",
  };
}

export function mapLocalSettlementToRow(
  item: LocalDailySettlement,
): SettlementHistoryRow {
  const expectedRevenue = Number((item.expectedRevenue ?? 0).toFixed(2));
  const expectedRemainingClamped = getExpectedSettlementCarryForwardAmount(
    expectedRevenue,
    item.cashBoxAmount,
    item.sharesAmount,
  );
  const actualRemainingAmount = Number(
    (item.actualRemainingAmount ?? 0).toFixed(2),
  );
  return {
    businessDate: item.businessDate,
    clientClosureId: item.clientClosureId,
    cashBoxAmount: item.cashBoxAmount,
    sharesAmount: item.sharesAmount,
    expectedRevenue,
    carryInAmount: Number((item.carryInAmount ?? 0).toFixed(2)),
    actualRemainingAmount,
    expectedRemainingAmount: expectedRemainingClamped,
    differenceAmount: getSettlementDifferenceAmount(
      actualRemainingAmount,
      expectedRevenue,
    ),
    note: item.note,
    syncedAt: item.syncedAt,
    synced: item.synced,
    source: "LOCAL",
  };
}

export function mapApiExpenseToRow(item: ApiExpense): ExpenseRow {
  return {
    clientExpenseId: item.clientExpenseId,
    expenseDate: item.expenseDate,
    category: item.category,
    description: item.description,
    amount: item.amount,
    imageUrl: item.imageUrl,
    note: item.note,
    synced: true,
    occurredAt: item.createdAt,
  };
}

export function mapLocalExpenseToRow(item: LocalExpense): ExpenseRow {
  return {
    clientExpenseId: item.clientExpenseId,
    expenseDate: item.expenseDate,
    category: item.category,
    description: item.description,
    amount: item.amount,
    imageUrl: item.imageUrl,
    localImageUri: item.localImageUri,
    note: item.note,
    synced: item.synced,
    occurredAt: item.createdLocallyAt,
  };
}

export function mapApiPurchaseToRow(item: ApiPurchase): PurchaseRow {
  return {
    clientPurchaseId: item.clientPurchaseId,
    purchaseDate: correctLegacyUtcDateOnly(
      item.purchaseDate,
      item.syncedAt ?? item.createdAt,
    ),
    productName: item.productName,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    purchaseKind:
      item.purchaseKind ??
      (normalizeProductKey(item.productName) === normalizeProductKey('تواصي')
        ? 'TAWASI'
        : 'SUPPLY'),
    sellPrice: Number(item.sellPrice ?? 0),
    paymentAmount: Number(item.paymentAmount ?? 0),
    note: item.note,
    synced: true,
    occurredAt: item.createdAt,
  };
}

export function mapLocalPurchaseToRow(item: LocalPurchase): PurchaseRow {
  return {
    clientPurchaseId: item.clientPurchaseId,
    purchaseDate: correctLegacyUtcDateOnly(
      item.purchaseDate,
      item.createdLocallyAt || item.syncedAt,
    ),
    productName: item.productName,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    purchaseKind:
      item.purchaseKind ??
      (normalizeProductKey(item.productName) === normalizeProductKey('تواصي')
        ? 'TAWASI'
        : 'SUPPLY'),
    sellPrice: Number(item.sellPrice ?? 0),
    paymentAmount: Number(item.paymentAmount ?? 0),
    note: item.note,
    synced: item.synced,
    occurredAt: item.createdLocallyAt,
  };
}

export function mergeSyncJobs(
  previous: SyncJob[],
  incoming: SyncJob,
  inFlightJobIds: ReadonlySet<string> = new Set(),
): SyncJob[] {
  const entity = incoming.entity ?? incoming.type;

  if (entity === "ORDER") {
    const existingOrderJob = previous.find((job) => {
      const jobEntity = job.entity ?? job.type;
      return jobEntity === "ORDER" && job.referenceId === incoming.referenceId;
    });

    if (!existingOrderJob) {
      return [...previous, incoming];
    }

    return previous;
  }

  if (
    entity !== "EXPENSE" &&
    entity !== "PURCHASE" &&
    entity !== "PRODUCT" &&
    entity !== "INVENTORY_ADJUSTMENT" &&
    entity !== "EMPLOYEE" &&
    entity !== "EMPLOYEE_ABSENCE" &&
    entity !== "EMPLOYEE_WITHDRAWAL"
  ) {
    return [...previous, incoming];
  }

  const lastIndex = [...previous]
    .map((job, index) => ({ job, index }))
    .reverse()
    .find((entry) => {
      const entryEntity = entry.job.entity ?? entry.job.type;
      return (
        entryEntity === entity && entry.job.referenceId === incoming.referenceId
      );
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

  if (inFlightJobIds.has(existing.id)) {
    return [...previous, incoming];
  }

  if (incoming.action === "UPDATE") {
    if (existing.action === "CREATE") {
      return [
        ...withoutExisting,
        {
          ...existing,
          retries: 0,
          permanentFailure: undefined,
          payload: {
            ...(existing.payload as object),
            ...(incoming.payload as object),
          },
        } as SyncJob,
      ];
    }

    if (existing.action === "UPDATE") {
      return [...withoutExisting, incoming];
    }

    return previous;
  }

  if (incoming.action === "DELETE") {
    if (existing.action === "CREATE") {
      return withoutExisting;
    }

    return [...withoutExisting, incoming];
  }

  return [...withoutExisting, incoming];
}

export function formatDateOnly(dateTimeIso: string): string {
  return dateTimeIso.slice(0, 10);
}

export function dateFromIsoOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

export function getWeekStartMonday(isoDate: string): string {
  const date = dateFromIsoOnly(isoDate);
  const dayIndex = (date.getDay() + 6) % 7;
  return toIsoDateOnly(addDays(date, -dayIndex));
}

export function getWeekEndSunday(weekStartIso: string): string {
  return toIsoDateOnly(addDays(dateFromIsoOnly(weekStartIso), 6));
}
