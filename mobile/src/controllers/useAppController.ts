import { useAudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DraggableGrid } from "react-native-draggable-grid";
import {
  Animated,
  AppState,
  Image,
  InteractionManager,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  API_BASE_URL,
  DEFAULT_EXPENSE_CATEGORY_OPTIONS,
  FALLBACK_STORES,
  PRODUCT_CATALOG,
  STORAGE_KEYS,
} from "../config";
import {
  ApiError,
  addStoreCashCarry,
  deleteEmployeeAbsence,
  deleteEmployeeWithdrawal,
  deleteExpense,
  deletePurchase,
  fetchCloudinarySignature,
  fetchDashboard,
  fetchDailySettlements,
  fetchEmployeeAbsences,
  fetchEmployees,
  fetchEmployeeWithdrawals,
  fetchExpenses,
  fetchInventoryAdjustments,
  fetchInventoryDestructions,
  fetchInventoryStock,
  fetchMe,
  fetchOrders,
  fetchProducts,
  fetchPurchases,
  fetchStores,
  login,
  patchProduct,
  patchEmployee,
  patchExpense,
  patchPurchase,
  postCashboxWithdrawal,
  postDailySettlement,
  postEmployee,
  postEmployeeAbsence,
  postEmployeeWithdrawal,
  postExpense,
  postInventoryAdjustment,
  postInventoryDestruction,
  postOrder,
  postProduct,
  postPurchase,
  deleteProduct,
} from "../services/api";
import {
  ApiDailySettlement,
  ApiExpense,
  ApiInventoryAdjustment,
  ApiInventoryDestruction,
  ApiInventoryStockRow,
  ApiOrder,
  ApiProduct,
  ApiPurchase,
  AppScreenKey,
  AuthSession,
  CartItem,
  CreateCashboxWithdrawalPayload,
  CreateDailySettlementPayload,
  CreateEmployeeAbsencePayload,
  CreateEmployeePayload,
  CreateEmployeeWithdrawalPayload,
  CreateExpensePayload,
  CreateInventoryAdjustmentPayload,
  CreateInventoryDestructionPayload,
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
  LocalInventoryAdjustment,
  LocalInventoryDestruction,
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
  UpdateEmployeePayload,
  UpdateExpensePayload,
  UpdatePurchasePayload,
} from "../types";
import { exportCsv, toCsv } from "../utils/csv";
import {
  correctLegacyUtcDateOnly,
  toIsoDateOnlyInTimeZone,
} from "../utils/businessDate";
import { styles } from "../views/appStyles";
import {
  buildPieceStockAuditRows,
  getActualSettlementCarryForwardAmount,
  getAuditNetSalesAmount,
  getExpectedSettlementCarryForwardAmount,
  getSettlementDifferenceAmount,
  getSettlementExpectedRevenueAmount,
  PieceStockAuditRow,
} from "../models/settlement";
import { buildSettlementAdjustmentOrders } from "./settlementController";
import { Pressable } from "../components/TapPressable";
import {
  BRAND_CATEGORY,
  BRAND_FULL,
  BRAND_NAME,
  BRAND_SIGNATURE,
  CLICK_SOUND_SOURCE,
  EXPORT_FILE_PREFIX,
  ExpenseCategoryOption,
  ExpenseRow,
  MISC_CART_ITEM_ID,
  MISC_CART_ITEM_NAME,
  MobileNavItem,
  NavItem,
  OrderHistoryRow,
  POS_PRODUCT_COLUMNS_DESKTOP,
  POS_PRODUCT_COLUMNS_MOBILE,
  PRODUCT_ORDER_STORAGE_KEY,
  PosProductGridItem,
  ProductSalesSummaryRow,
  ProductSupplyRow,
  PurchaseRow,
  SettlementDayDetail,
  SettlementHistoryRow,
  addDays,
  buildProductsFromHistory,
  dateFromIsoOnly,
  extractApiMessage,
  formatDateOnly,
  formatMoney,
  formatQuantity,
  getWeekEndSunday,
  getWeekStartMonday,
  inferMimeTypeFromUri,
  isLikelyNetworkError,
  isRemoteUri,
  loadArray,
  loadObject,
  makeId,
  mapApiExpenseToRow,
  mapApiOrderToRow,
  mapApiProductToLocal,
  mapApiPurchaseToRow,
  mapApiSettlementToRow,
  mapLocalExpenseToRow,
  mapLocalOrderToRow,
  mapLocalPurchaseToRow,
  mapLocalSettlementToRow,
  mergeExpenseCategoryOptions,
  mergeProductsWithRemote,
  mergeSyncJobs,
  normalizeExpenseCategoryValue,
  normalizeIsoTimestamp,
  normalizeNumericInputText,
  normalizeProductKey,
  normalizeQuantityForUnit,
  parseNumberInput,
  persistExpenseImageLocally,
  saveArray,
  saveObject,
  sortProductsByLocalOrder,
  toExpenseCategoryFallbackLabel,
  toIsoDateOnly,
  toLocalProduct,
  toOrderStatusLabel,
  toPaymentMethodLabel,
  toShortDate,
  uploadExpenseImageToCloudinary,
} from "../support/appSupport";

const SYNC_RETRY_DELAY_MS = 10000;
const MAX_SYNC_JOB_RETRIES = 5;
const ACTIVE_SCREEN_REFRESH_INTERVAL_MS = 15000;
const RESOURCE_REFRESH_TTL_MS = 60000;
const ADMIN_DASHBOARD_ALL_STORES = "__ALL__";
const ORDER_REFRESH_LIMIT = 200;

type RefreshTimestamps = Record<string, number>;

interface ActiveScreenRefreshOptions {
  force?: boolean;
  showIndicator?: boolean;
}

interface TodayPurchaseInvoiceRow {
  key: string;
  productName: string;
  purchaseKind: "SUPPLY" | "TAWASI";
  quantity: number;
  unitCost: number;
  totalCost: number;
  sellPrice: number;
  notes: string[];
  synced: boolean;
  pendingCount: number;
}

interface PurchaseHistorySummaryRow {
  key: string;
  productName: string;
  purchaseKind: "SUPPLY" | "TAWASI";
  quantity: number;
  unitCost: number;
  totalCost: number;
  sellPrice: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  purchaseDatesCount: number;
  synced: boolean;
  pendingCount: number;
}

interface TodayPurchasePaymentRow {
  key: string;
  amount: number;
  note?: string;
  synced: boolean;
}

function buildPurchaseInvoiceNoteKey(storeId: string, invoiceDate: string): string {
  return `${storeId}:${invoiceDate}`;
}

function buildOrderCreateSyncJob(order: LocalOrder): SyncJob {
  const payload: CreateOrderPayload = {
    clientOrderId: order.clientOrderId,
    storeId: order.storeId,
    cashierName: order.cashierName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    items: order.items,
    orderedAt: order.orderedAt,
    note: order.note,
  };

  return {
    id: makeId("job"),
    referenceId: order.clientOrderId,
    retries: 0,
    createdAt: order.createdLocallyAt || order.orderedAt,
    entity: "ORDER",
    action: "CREATE",
    payload,
  };
}

function buildDailySettlementCreateSyncJob(
  settlement: LocalDailySettlement,
): SyncJob {
  const payload: CreateDailySettlementPayload = {
    clientClosureId: settlement.clientClosureId,
    storeId: settlement.storeId,
    businessDate: settlement.businessDate,
    cashBoxAmount: settlement.cashBoxAmount,
    sharesAmount: settlement.sharesAmount,
    actualRemainingAmount: settlement.actualRemainingAmount,
    expectedRevenue: settlement.expectedRevenue,
    carryInAmount: settlement.carryInAmount,
    note: settlement.note,
    syncedAt: settlement.syncedAt,
  };

  return {
    id: makeId("job"),
    referenceId: settlement.clientClosureId,
    retries: 0,
    createdAt: settlement.createdLocallyAt || settlement.syncedAt,
    entity: "DAILY_SETTLEMENT",
    action: "CREATE",
    payload,
  };
}

class UnsupportedSyncOperationError extends Error {}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPermanentSyncError(error: unknown): boolean {
  return (
    error instanceof UnsupportedSyncOperationError ||
    (error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![401, 403, 404, 408, 409, 429].includes(error.status))
  );
}

function correctCachedPurchaseDate(item: LocalPurchase): LocalPurchase {
  const purchaseDate = correctLegacyUtcDateOnly(
    item.purchaseDate,
    item.createdLocallyAt || item.syncedAt,
  );

  return purchaseDate === item.purchaseDate
    ? item
    : {
        ...item,
        purchaseDate,
      };
}

function toBusinessDateFromTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return toIsoDateOnlyInTimeZone(parsed);
}

function correctPurchaseSyncJobDate(job: SyncJob): SyncJob {
  const entity = job.entity ?? job.type;
  const action = job.action ?? "CREATE";
  if (
    entity !== "PURCHASE" ||
    (action !== "CREATE" && action !== "UPDATE")
  ) {
    return job;
  }

  const payload = job.payload as
    | CreatePurchasePayload
    | UpdatePurchasePayload;
  if (!payload.purchaseDate) {
    return job;
  }

  const purchaseDate = correctLegacyUtcDateOnly(
    payload.purchaseDate,
    payload.syncedAt ?? job.createdAt,
  );
  if (purchaseDate === payload.purchaseDate) {
    return job;
  }

  return {
    ...job,
    payload: {
      ...payload,
      purchaseDate,
    },
  } as SyncJob;
}

export function useAppController() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isDesktop = shortestSide >= 960;
  const isPosSplit = width >= 760;
  const isPortrait = height >= width;
  const isPortraitMobile = !isDesktop && height >= width;
  const showPageSwitchControls = !isDesktop || isPortrait;
  const mobileNavDrawerWidth = Math.min(Math.max(width * 0.78, 260), 360);
  const tapPlayer = useAudioPlayer(CLICK_SOUND_SOURCE);

  const playTapSound = useCallback(() => {
    try {
      void tapPlayer.seekTo(0);
      tapPlayer.play();
    } catch {
      // Ignore click sound failures to keep button interactions responsive.
    }
  }, [tapPlayer]);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  const [usernameInput, setUsernameInput] = useState("مها");
  const [passwordInput, setPasswordInput] = useState("abcd");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeScreen, setActiveScreen] = useState<AppScreenKey>("pos");
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSubmittingOrder = false;
  const [isRefreshingActiveScreen, setIsRefreshingActiveScreen] =
    useState(false);
  const [isSavingTawasi, setIsSavingTawasi] = useState(false);
  const [isSavingSupplyPayment, setIsSavingSupplyPayment] = useState(false);
  const [pendingPurchaseDeleteIds, setPendingPurchaseDeleteIds] = useState<
    Record<string, true>
  >({});
  const isSyncingRef = useRef(false);
  const activeScreenRef = useRef<AppScreenKey>("pos");
  const isBuildingOrderRef = useRef(false);
  const inFlightSyncJobIdsRef = useRef<Set<string>>(new Set());
  const pendingOrderSyncMarkIdsRef = useRef<Set<string>>(new Set());
  const syncQueuePersistenceRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSyncQueuePersistenceRef = useRef<{
    timeout: ReturnType<typeof setTimeout>;
    value: SyncJob[];
    version: number;
  } | null>(null);
  const syncQueuePersistenceVersionRef = useRef(0);
  const ordersPersistenceRef = useRef<Promise<void>>(Promise.resolve());
  const pendingOrdersPersistenceRef = useRef<{
    timeout: ReturnType<typeof setTimeout>;
    value: LocalOrder[];
    version: number;
  } | null>(null);
  const ordersPersistenceVersionRef = useRef(0);
  const reportOrdersSyncVersionRef = useRef(0);
  const heavyReportScreenVersionRef = useRef(0);
  const hasLoadedCashCarryRef = useRef(false);
  const deferredArrayPersistenceRef = useRef<
    Map<string, { timeout: ReturnType<typeof setTimeout>; value: unknown[] }>
  >(new Map());
  const refreshTimestampsRef = useRef<RefreshTimestamps>({});
  const resourceRefreshPromisesRef = useRef<Map<string, Promise<boolean>>>(
    new Map(),
  );
  const settlementRefreshPromiseRef = useRef<{
    key: string;
    promise: Promise<boolean>;
  } | null>(null);
  const activeScreenRefreshPromiseRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState("جاهز للعمل.");

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [reportOrders, setReportOrders] = useState<LocalOrder[]>([]);
  const [heavyReportScreen, setHeavyReportScreen] =
    useState<AppScreenKey>("pos");
  const [dailySettlements, setDailySettlements] = useState<
    LocalDailySettlement[]
  >([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [purchases, setPurchases] = useState<LocalPurchase[]>([]);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<
    LocalInventoryAdjustment[]
  >([]);
  const [inventoryDestructions, setInventoryDestructions] = useState<
    LocalInventoryDestruction[]
  >([]);
  const [queue, setQueue] = useState<SyncJob[]>([]);

  activeScreenRef.current = activeScreen;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [posPadInput, setPosPadInput] = useState("");
  const [pendingMultiplier, setPendingMultiplier] = useState<number | null>(
    null,
  );
  const [pendingAmountValue, setPendingAmountValue] = useState<number | null>(
    null,
  );
  const [cashCarryByStore, setCashCarryByStore] = useState<
    Record<string, number>
  >({});
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [isPosProductReordering, setIsPosProductReordering] = useState(false);
  const [activePosProductKey, setActivePosProductKey] = useState<string | null>(
    null,
  );

  const [cashBoxInput, setCashBoxInput] = useState("");
  const [sharesInput, setSharesInput] = useState("");
  const [actualRemainingInput, setActualRemainingInput] = useState("");
  const [settlementNoteInput, setSettlementNoteInput] = useState("");

  const [dashboardTotals, setDashboardTotals] = useState<
    DashboardResponse["totals"] | null
  >(null);
  const [dashboardSummaries, setDashboardSummaries] = useState<
    DashboardStoreSummary[]
  >([]);
  const [remoteOrders, setRemoteOrders] = useState<ApiOrder[]>([]);
  const [remoteSettlements, setRemoteSettlements] = useState<
    ApiDailySettlement[]
  >([]);
  const [remoteExpenses, setRemoteExpenses] = useState<ApiExpense[]>([]);
  const [remotePurchases, setRemotePurchases] = useState<ApiPurchase[]>([]);
  const [remoteInventoryAdjustments, setRemoteInventoryAdjustments] = useState<
    ApiInventoryAdjustment[]
  >([]);
  const [remoteInventoryDestructions, setRemoteInventoryDestructions] = useState<
    ApiInventoryDestruction[]
  >([]);
  const [remoteInventoryStockRows, setRemoteInventoryStockRows] = useState<
    ApiInventoryStockRow[]
  >([]);
  const [selectedOrderInvoice, setSelectedOrderInvoice] =
    useState<OrderHistoryRow | null>(null);
  const [selectedSettlementDetail, setSelectedSettlementDetail] =
    useState<SettlementDayDetail | null>(null);
  const [selectedExpenseDetails, setSelectedExpenseDetails] =
    useState<ExpenseRow | null>(null);
  const [isTodayPurchasesInvoiceOpen, setIsTodayPurchasesInvoiceOpen] =
    useState(false);

  const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null);
  const [expenseDateInput, setExpenseDateInput] = useState(
    toIsoDateOnly(new Date()),
  );
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useState<
    ExpenseCategoryOption[]
  >(DEFAULT_EXPENSE_CATEGORY_OPTIONS);
  const [expenseCategoryInput, setExpenseCategoryInput] =
    useState<ExpenseCategory>("CLEANING");
  const [newExpenseCategoryLabelInput, setNewExpenseCategoryLabelInput] =
    useState("");
  const [expenseDescriptionInput, setExpenseDescriptionInput] = useState("");
  const [expenseAmountInput, setExpenseAmountInput] = useState("");
  const [expenseNoteInput, setExpenseNoteInput] = useState("");
  const [expenseImageLocalUri, setExpenseImageLocalUri] = useState<
    string | null
  >(null);
  const [isPickingExpenseImage, setIsPickingExpenseImage] = useState(false);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<
    "ALL" | ExpenseCategory
  >("ALL");
  const [expenseFilterFrom, setExpenseFilterFrom] = useState("");
  const [expenseFilterTo, setExpenseFilterTo] = useState("");
  const [expenseFilterText, setExpenseFilterText] = useState("");

  const [purchaseFilterProduct, setPurchaseFilterProduct] = useState("");
  const [purchaseFilterFrom, setPurchaseFilterFrom] = useState("");
  const [purchaseFilterTo, setPurchaseFilterTo] = useState("");
  const [purchaseInvoiceDateInput, setPurchaseInvoiceDateInput] = useState(
    () => toIsoDateOnlyInTimeZone(new Date()),
  );
  const [activePurchaseInvoiceDate, setActivePurchaseInvoiceDate] = useState(
    () => toIsoDateOnlyInTimeZone(new Date()),
  );
  const [purchaseInvoiceNotesByKey, setPurchaseInvoiceNotesByKey] = useState<
    Record<string, string>
  >({});
  const [purchaseInvoiceNoteInput, setPurchaseInvoiceNoteInput] =
    useState("");
  const [tawasiCapitalInput, setTawasiCapitalInput] = useState("");
  const [tawasiSellPriceInput, setTawasiSellPriceInput] = useState("");
  const [tawasiNoteInput, setTawasiNoteInput] = useState("");
  const [supplyPaymentAmountInput, setSupplyPaymentAmountInput] = useState("");
  const [supplyPaymentNoteInput, setSupplyPaymentNoteInput] = useState("");
  const [products, setProducts] = useState<LocalProduct[]>(
    PRODUCT_CATALOG.map((item) => toLocalProduct(item)),
  );
  const [productOrderByStore, setProductOrderByStore] = useState<
    Record<string, string[]>
  >({});
  const [todaySupplyInputs, setTodaySupplyInputs] = useState<
    Record<string, string>
  >({});
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [newProductNameInput, setNewProductNameInput] = useState("");
  const [newProductUnitType, setNewProductUnitType] =
    useState<ProductTemplate["unitType"]>("PIECE");
  const [newProductSellPriceInput, setNewProductSellPriceInput] = useState("");
  const [newProductCostPriceInput, setNewProductCostPriceInput] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeAbsences, setEmployeeAbsences] = useState<
    EmployeeAbsenceEntry[]
  >([]);
  const [employeeWithdrawals, setEmployeeWithdrawals] = useState<
    EmployeeWithdrawalEntry[]
  >([]);
  const [employeeNameInput, setEmployeeNameInput] = useState("");
  const [employeeWeeklySalaryInput, setEmployeeWeeklySalaryInput] =
    useState("");
  const [employeeEditingId, setEmployeeEditingId] = useState<string | null>(
    null,
  );
  const [absenceEmployeeIdInput, setAbsenceEmployeeIdInput] = useState("");
  const [absenceDateInput, setAbsenceDateInput] = useState(
    toIsoDateOnly(new Date()),
  );
  const [absenceNoteInput, setAbsenceNoteInput] = useState("");
  const [withdrawalEmployeeIdInput, setWithdrawalEmployeeIdInput] =
    useState("");
  const [withdrawalDateInput, setWithdrawalDateInput] = useState(
    toIsoDateOnly(new Date()),
  );
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState("");
  const [withdrawalNoteInput, setWithdrawalNoteInput] = useState("");
  const [settlementActualInputs, setSettlementActualInputs] = useState<
    Record<string, string>
  >({});
  const [selectedInventoryDestructionProductId, setSelectedInventoryDestructionProductId] =
    useState("");
  const [inventoryDestructionQuantityInput, setInventoryDestructionQuantityInput] =
    useState("");
  const [inventoryDestructionNoteInput, setInventoryDestructionNoteInput] =
    useState("");
  const [inventoryDestructionInputs, setInventoryDestructionInputs] = useState<
    Record<string, string>
  >({});
  const [inventoryDestructionNoteInputs, setInventoryDestructionNoteInputs] =
    useState<Record<string, string>>({});
  const [adminFromDateInput, setAdminFromDateInput] = useState("");
  const [adminToDateInput, setAdminToDateInput] = useState("");
  const [adminDashboardStoreId, setAdminDashboardStoreId] = useState(
    ADMIN_DASHBOARD_ALL_STORES,
  );
  const [
    adminCashboxWithdrawalAmountInput,
    setAdminCashboxWithdrawalAmountInput,
  ] = useState("");
  const [adminCashboxWithdrawalNoteInput, setAdminCashboxWithdrawalNoteInput] =
    useState("");
  const [adminDatePickerTarget, setAdminDatePickerTarget] = useState<
    "from" | "to" | null
  >(null);
  const [adminDatePickerValue, setAdminDatePickerValue] = useState(new Date());
  const [purchaseDatePickerTarget, setPurchaseDatePickerTarget] = useState<
    "from" | "to" | null
  >(null);
  const [purchaseDatePickerValue, setPurchaseDatePickerValue] =
    useState(new Date());
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false);
  const mobileNavTranslateX = useRef(new Animated.Value(420)).current;
  const mobileNavBackdropOpacity = useRef(new Animated.Value(0)).current;

  const authToken = session?.accessToken ?? "";
  const isAdmin = session?.user.role === "ADMIN";
  const isCashier = session?.user.role === "CASHIER";
  const canManageInventory = isCashier || isAdmin;
  const canManageExpenses = isCashier || isAdmin;
  const assignedStoreId = session?.user.storeId ?? null;

  useEffect(() => {
    tapPlayer.volume = 0.48;
  }, [tapPlayer]);

  const navItems = useMemo<NavItem[]>(
    () => [
      { key: "pos", label: "نقطة البيع", subtitle: "بيع مباشر" },
      { key: "purchases", label: "المشتريات", subtitle: "استلام التوريدات" },
      { key: "expenses", label: "المصاريف", subtitle: "إدارة التكاليف" },
      { key: "employees", label: "الموظفون", subtitle: "رواتب وسحوبات" },
      { key: "settlement", label: "التسوية", subtitle: "إغلاق اليوم" },
      { key: "orders", label: "سجل الطلبات", subtitle: "مراجعة اليوم" },
    ],
    [],
  );

  const mobileNavItems = useMemo<MobileNavItem[]>(
    () => [
      ...navItems,
      ...(isAdmin
        ? ([
            { key: "admin", label: "لوحة التسوية", subtitle: "إدارة الفروع" },
          ] as MobileNavItem[])
        : []),
    ],
    [isAdmin, navItems],
  );

  const closeMobileNav = useCallback(() => {
    if (!isMobileNavVisible) {
      setIsMobileNavOpen(false);
      return;
    }

    setIsMobileNavOpen(false);
    Animated.parallel([
      Animated.timing(mobileNavTranslateX, {
        toValue: mobileNavDrawerWidth + 32,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(mobileNavBackdropOpacity, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMobileNavVisible(false);
      }
    });
  }, [
    isMobileNavVisible,
    mobileNavBackdropOpacity,
    mobileNavDrawerWidth,
    mobileNavTranslateX,
  ]);

  const openMobileNav = useCallback(() => {
    if (isDesktop || isMobileNavOpen) {
      return;
    }

    setIsMobileNavVisible(true);
    setIsMobileNavOpen(true);
    mobileNavTranslateX.setValue(mobileNavDrawerWidth + 32);
    mobileNavBackdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(mobileNavTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(mobileNavBackdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    isDesktop,
    isMobileNavOpen,
    mobileNavBackdropOpacity,
    mobileNavDrawerWidth,
    mobileNavTranslateX,
  ]);

  const toggleMobileNav = useCallback(() => {
    if (isMobileNavOpen) {
      closeMobileNav();
      return;
    }

    openMobileNav();
  }, [closeMobileNav, isMobileNavOpen, openMobileNav]);

  const activeScreenLabel = useMemo(() => {
    if (activeScreen === "admin") {
      return "لوحة التسوية";
    }

    return (
      navItems.find((item) => item.key === activeScreen)?.label ?? "الصفحات"
    );
  }, [activeScreen, navItems]);

  const swipeScreens = useMemo<AppScreenKey[]>(
    () => [
      ...navItems.map((item) => item.key),
      ...(isAdmin ? (["admin"] as AppScreenKey[]) : []),
    ],
    [isAdmin, navItems],
  );

  const moveScreenBySwipe = useCallback(
    (direction: "NEXT" | "PREV") => {
      if (swipeScreens.length === 0) {
        return;
      }

      const currentIndex = swipeScreens.indexOf(activeScreen);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const delta = direction === "NEXT" ? 1 : -1;
      const nextIndex =
        (safeIndex + delta + swipeScreens.length) % swipeScreens.length;
      setActiveScreen(swipeScreens[nextIndex]);
    },
    [activeScreen, swipeScreens],
  );

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (
            isDesktop ||
            selectedOrderInvoice !== null ||
            isMobileNavOpen ||
            isMobileNavVisible ||
            isPosProductReordering
          ) {
            return false;
          }

          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          return absDx > 24 && absDx > absDy * 1.25;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            Math.abs(gestureState.dx) < 42 ||
            Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)
          ) {
            return;
          }

          if (gestureState.dx < 0) {
            moveScreenBySwipe("PREV");
            return;
          }

          moveScreenBySwipe("NEXT");
        },
      }),
    [
      isDesktop,
      isMobileNavOpen,
      isMobileNavVisible,
      isPosProductReordering,
      moveScreenBySwipe,
      selectedOrderInvoice,
    ],
  );

  const canSwitchStore = isAdmin;

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId),
    [selectedStoreId, stores],
  );

  const orderedProductIdsForStore = useMemo(
    () => productOrderByStore[selectedStoreId] ?? [],
    [productOrderByStore, selectedStoreId],
  );
  const posProducts = useMemo(
    () => sortProductsByLocalOrder(products, orderedProductIdsForStore),
    [orderedProductIdsForStore, products],
  );
  const productOrderIndexById = useMemo(() => {
    const entries: Array<[string, number]> = [];
    posProducts.forEach((product, index) => {
      entries.push([product.id, index]);
      if (product.clientProductId !== product.id) {
        entries.push([product.clientProductId, index]);
      }
    });
    return new Map(entries);
  }, [posProducts]);
  const productOrderIndexByName = useMemo(
    () =>
      new Map(
        posProducts.map((product, index) => [
          normalizeProductKey(product.name),
          index,
        ]),
      ),
    [posProducts],
  );
  const getProductDisplayOrderIndex = useCallback(
    (productId?: string | null, productName?: string | null) => {
      if (productId) {
        const idIndex = productOrderIndexById.get(productId);
        if (idIndex !== undefined) {
          return idIndex;
        }
      }

      if (productName) {
        const nameIndex = productOrderIndexByName.get(
          normalizeProductKey(productName),
        );
        if (nameIndex !== undefined) {
          return nameIndex;
        }
      }

      return Number.MAX_SAFE_INTEGER;
    },
    [productOrderIndexById, productOrderIndexByName],
  );
  const compareProductDisplayRows = useCallback(
    (
      a: { productId?: string; name?: string; productName?: string },
      b: { productId?: string; name?: string; productName?: string },
    ) => {
      const aName = a.name ?? a.productName ?? "";
      const bName = b.name ?? b.productName ?? "";
      const aIndex = getProductDisplayOrderIndex(a.productId, aName);
      const bIndex = getProductDisplayOrderIndex(b.productId, bName);

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return aName.localeCompare(bName, "ar");
    },
    [getProductDisplayOrderIndex],
  );
  const productByNormalizedName = useMemo(
    () =>
      new Map(
        products.map((product) => [
          normalizeProductKey(product.name),
          product,
        ]),
      ),
    [products],
  );
  const productByClientProductId = useMemo(
    () => new Map(products.map((product) => [product.clientProductId, product])),
    [products],
  );
  const posProductGridData = useMemo<PosProductGridItem[]>(
    () => posProducts.map((item) => ({ ...item, key: item.id })),
    [posProducts],
  );
  const posProductColumns = useMemo(() => {
    if (isPosSplit) {
      return POS_PRODUCT_COLUMNS_DESKTOP;
    }

    return width < 520
      ? POS_PRODUCT_COLUMNS_MOBILE
      : POS_PRODUCT_COLUMNS_DESKTOP;
  }, [isPosSplit, width]);
  const posProductItemHeight = useMemo(() => {
    return isPosSplit ? 92 : 108;
  }, [isPosSplit]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (item.lineTotal ?? item.price * item.quantity),
        0,
      ),
    [cart],
  );

  const total = useMemo(() => {
    const discountValue = parseNumberInput(discountInput);
    return Math.max(subtotal - discountValue, 0);
  }, [discountInput, subtotal]);

  const padAmountPreview = useMemo(() => {
    if (pendingAmountValue && pendingAmountValue > 0) {
      return pendingAmountValue;
    }
    return null;
  }, [pendingAmountValue]);

  const selectedStoreOrders = useMemo(
    () =>
      reportOrders.filter(
        (order) =>
          order.storeId === selectedStoreId &&
          (!isOnline || order.synced !== true),
      ),
    [isOnline, reportOrders, selectedStoreId],
  );

  const selectedStoreSettlements = useMemo(
    () =>
      dailySettlements.filter(
        (item) => item.storeId === selectedStoreId && item.synced !== true,
      ),
    [dailySettlements, selectedStoreId],
  );

  const selectedStoreExpenses = useMemo(
    () =>
      expenses.filter(
        (item) =>
          item.storeId === selectedStoreId &&
          (!isOnline || item.synced !== true),
      ),
    [expenses, isOnline, selectedStoreId],
  );

  const selectedStorePurchases = useMemo(
    () =>
      purchases.filter(
        (item) => item.storeId === selectedStoreId && item.synced !== true,
      ),
    [purchases, selectedStoreId],
  );

  const selectedStoreEmployees = useMemo(
    () =>
      employees.filter(
        (item) => item.storeId === selectedStoreId && item.isActive,
      ),
    [employees, selectedStoreId],
  );

  const selectedStoreAbsences = useMemo(
    () => employeeAbsences.filter((item) => item.storeId === selectedStoreId),
    [employeeAbsences, selectedStoreId],
  );

  const selectedStoreWithdrawals = useMemo(
    () =>
      employeeWithdrawals.filter((item) => item.storeId === selectedStoreId),
    [employeeWithdrawals, selectedStoreId],
  );

  const selectedStoreRemoteSettlements = useMemo(
    () => remoteSettlements.filter((item) => item.storeId === selectedStoreId),
    [remoteSettlements, selectedStoreId],
  );

  const selectedStoreRemoteSettlementDates = useMemo(
    () =>
      new Set(
        selectedStoreRemoteSettlements.map((item) => item.businessDate),
      ),
    [selectedStoreRemoteSettlements],
  );

  const [todayDate, setTodayDate] = useState(() =>
    toIsoDateOnlyInTimeZone(new Date()),
  );

  useEffect(() => {
    const refreshTodayDate = () => {
      const nextDate = toIsoDateOnlyInTimeZone(new Date());
      setTodayDate((currentDate) =>
        currentDate === nextDate ? currentDate : nextDate,
      );
    };
    const intervalId = setInterval(refreshTodayDate, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshTodayDate();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  const syncReportOrders = useCallback(
    (nextOrders: LocalOrder[], immediate = false) => {
      const version = reportOrdersSyncVersionRef.current + 1;
      reportOrdersSyncVersionRef.current = version;

      if (immediate) {
        setReportOrders(nextOrders);
        return;
      }

      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          if (reportOrdersSyncVersionRef.current === version) {
            setReportOrders(nextOrders);
          }
        }, 300);
      });
    },
    [],
  );

  useEffect(() => {
    syncReportOrders(orders, activeScreen !== "pos");
  }, [activeScreen, orders, syncReportOrders]);

  useEffect(() => {
    const version = heavyReportScreenVersionRef.current + 1;
    heavyReportScreenVersionRef.current = version;

    if (activeScreen === "pos") {
      setHeavyReportScreen("pos");
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (heavyReportScreenVersionRef.current === version) {
          setHeavyReportScreen(activeScreen);
        }
      }, 0);
    });
  }, [activeScreen]);

  const shouldComputePurchaseReports =
    heavyReportScreen === "purchases" || heavyReportScreen === "settlement";
  const shouldComputeExpenseReports =
    heavyReportScreen === "expenses" || heavyReportScreen === "settlement";
  const shouldComputeSettlementReports = heavyReportScreen === "settlement";
  const shouldComputeEmployeeReports =
    heavyReportScreen === "employees" || heavyReportScreen === "settlement";

  const settlementCycleStartIso = useMemo(() => {
    const candidates: string[] = [];

    selectedStoreSettlements.forEach((item) => {
      if (selectedStoreRemoteSettlementDates.has(item.businessDate)) {
        return;
      }

      const candidate = normalizeIsoTimestamp(
        item.syncedAt ?? item.createdLocallyAt,
      );
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
  }, [
    selectedStoreRemoteSettlementDates,
    selectedStoreRemoteSettlements,
    selectedStoreSettlements,
  ]);

  const carryInAmount = useMemo(
    () =>
      Number(
        Math.abs(cashCarryByStore[selectedStoreId] ?? 0).toFixed(2),
      ),
    [cashCarryByStore, selectedStoreId],
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

  const allMergedOrderRows = useMemo(() => {
    const rows = new Map<string, OrderHistoryRow>();

    remoteOrders
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.clientOrderId, mapApiOrderToRow(item)));

    selectedStoreOrders.forEach((item) => {
      if (!rows.has(item.clientOrderId)) {
        rows.set(item.clientOrderId, mapLocalOrderToRow(item));
      }
    });

    return Array.from(rows.values()).sort((a, b) =>
      b.orderedAt.localeCompare(a.orderedAt),
    );
  }, [remoteOrders, selectedStoreId, selectedStoreOrders]);

  const mergedOrderRows = useMemo(
    () => allMergedOrderRows,
    [allMergedOrderRows],
  );

  const lastTwoCompletedSalesOrders = useMemo(
    () =>
      allMergedOrderRows
        .filter((order) => order.status === "COMPLETED")
        .slice(0, 2)
        .map((order) => ({
          clientOrderId: order.clientOrderId,
          total: order.total,
          orderedAt: order.orderedAt,
        })),
    [allMergedOrderRows],
  );

  const mergedSettlementRows = useMemo(() => {
    const rows = new Map<string, SettlementHistoryRow>();

    remoteSettlements
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) =>
        rows.set(item.businessDate, mapApiSettlementToRow(item)),
      );

    selectedStoreSettlements.forEach((item) => {
      if (!rows.has(item.businessDate)) {
        rows.set(item.businessDate, mapLocalSettlementToRow(item));
      }
    });

    return Array.from(rows.values()).sort((a, b) =>
      b.businessDate.localeCompare(a.businessDate),
    );
  }, [remoteSettlements, selectedStoreId, selectedStoreSettlements]);

  const pendingExpenseDeletes = useMemo(
    () =>
      new Set(
        queue
          .filter(
            (job) =>
              (job.entity ?? job.type) === "EXPENSE" && job.action === "DELETE",
          )
          .map((job) => job.referenceId),
      ),
    [queue],
  );

  const pendingPurchaseDeletes = useMemo(
    () =>
      new Set(
        queue
          .filter(
            (job) =>
              (job.entity ?? job.type) === "PURCHASE" &&
              job.action === "DELETE",
          )
          .map((job) => job.referenceId),
      ),
    [queue],
  );

  const mergedExpenseRows = useMemo(() => {
    if (!shouldComputeExpenseReports) {
      return [];
    }

    const rows = new Map<string, ExpenseRow>();

    remoteExpenses
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => {
        if (!pendingExpenseDeletes.has(item.clientExpenseId)) {
          rows.set(item.clientExpenseId, mapApiExpenseToRow(item));
        }
      });

    selectedStoreExpenses.forEach((item) =>
      rows.set(item.clientExpenseId, mapLocalExpenseToRow(item)),
    );

    return Array.from(rows.values()).sort((a, b) =>
      b.expenseDate.localeCompare(a.expenseDate),
    );
  }, [
    pendingExpenseDeletes,
    remoteExpenses,
    selectedStoreExpenses,
    selectedStoreId,
    shouldComputeExpenseReports,
  ]);

  const effectiveExpenseCategoryOptions = useMemo(() => {
    const fromRecords = mergedExpenseRows.map((item) => ({
      value: normalizeExpenseCategoryValue(item.category),
      label: toExpenseCategoryFallbackLabel(item.category),
    }));

    return mergeExpenseCategoryOptions([
      ...expenseCategoryOptions,
      ...fromRecords,
    ]);
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
    if (!shouldComputePurchaseReports) {
      return [];
    }

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

    return Array.from(rows.values()).sort((a, b) =>
      b.purchaseDate.localeCompare(a.purchaseDate),
    );
  }, [
    pendingPurchaseDeletes,
    remotePurchases,
    selectedStoreId,
    selectedStorePurchases,
    shouldComputePurchaseReports,
  ]);

  const settlementRecordsByDate = useMemo(() => {
    const orders = new Map<string, OrderHistoryRow[]>();
    const expensesByDate = new Map<string, ExpenseRow[]>();
    const purchasesByDate = new Map<string, PurchaseRow[]>();
    const withdrawals = new Map<string, EmployeeWithdrawalEntry[]>();

    if (!shouldComputeSettlementReports) {
      return {
        orders,
        expenses: expensesByDate,
        purchases: purchasesByDate,
        withdrawals,
      };
    }

    const append = <T,>(map: Map<string, T[]>, key: string, value: T) => {
      const rows = map.get(key);
      if (rows) {
        rows.push(value);
        return;
      }
      map.set(key, [value]);
    };

    allMergedOrderRows.forEach((item) => {
      append(orders, toBusinessDateFromTimestamp(item.orderedAt), item);
    });
    mergedExpenseRows.forEach((item) => {
      append(expensesByDate, item.expenseDate, item);
    });
    mergedPurchaseRows.forEach((item) => {
      append(purchasesByDate, item.purchaseDate, item);
    });
    selectedStoreWithdrawals.forEach((item) => {
      append(withdrawals, item.withdrawalDate, item);
    });

    return { orders, expenses: expensesByDate, purchases: purchasesByDate, withdrawals };
  }, [
    allMergedOrderRows,
    mergedExpenseRows,
    mergedPurchaseRows,
    selectedStoreWithdrawals,
    shouldComputeSettlementReports,
  ]);

  const employeeNameById = useMemo(
    () => new Map(selectedStoreEmployees.map((employee) => [employee.id, employee.name])),
    [selectedStoreEmployees],
  );

  const settlementArchiveRows = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return mergedSettlementRows.map((settlement) => {
        const dayOrders = settlementRecordsByDate.orders.get(settlement.businessDate) ?? [];
        const dayExpenses = settlementRecordsByDate.expenses.get(settlement.businessDate) ?? [];
        const dayPurchases = settlementRecordsByDate.purchases.get(settlement.businessDate) ?? [];
        const dayWithdrawals = settlementRecordsByDate.withdrawals.get(settlement.businessDate) ?? [];

        return {
          ...settlement,
          ordersCount: dayOrders.length,
          salesAmount: Number(
            dayOrders
              .filter((item) => item.status === "COMPLETED")
              .reduce((sum, item) => sum + item.total, 0)
              .toFixed(2),
          ),
          refundAmount: Number(
            dayOrders
              .filter((item) => item.status === "REFUNDED")
              .reduce((sum, item) => sum + item.total, 0)
              .toFixed(2),
          ),
          expensesCount: dayExpenses.length,
          expensesAmount: Number(
            dayExpenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
          ),
          purchasesCount: dayPurchases.filter(
            (item) => item.purchaseKind !== "PAYMENT",
          ).length,
          purchasesAmount: Number(
            dayPurchases
              .reduce((sum, item) => sum + item.totalCost, 0)
              .toFixed(2),
          ),
          paymentsAmount: Number(
            dayPurchases
              .reduce((sum, item) => sum + item.paymentAmount, 0)
              .toFixed(2),
          ),
          withdrawalsCount: dayWithdrawals.length,
        };
      });
    },
    [
      mergedSettlementRows,
      settlementRecordsByDate,
      shouldComputeSettlementReports,
    ],
  );

  const mergedInventoryAdjustments = useMemo(() => {
    if (!shouldComputePurchaseReports) {
      return [];
    }

    const rows = new Map<
      string,
      ApiInventoryAdjustment | LocalInventoryAdjustment
    >();

    remoteInventoryAdjustments
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.clientAdjustmentId, item));
    inventoryAdjustments
      .filter(
        (item) =>
          item.storeId === selectedStoreId && item.synced !== true,
      )
      .forEach((item) => rows.set(item.clientAdjustmentId, item));

    return Array.from(rows.values()).sort((a, b) =>
      b.adjustedAt.localeCompare(a.adjustedAt),
    );
  }, [
    inventoryAdjustments,
    remoteInventoryAdjustments,
    selectedStoreId,
    shouldComputePurchaseReports,
  ]);

  const latestInventoryAdjustmentByProduct = useMemo(() => {
    const latest = new Map<
      string,
      ApiInventoryAdjustment | LocalInventoryAdjustment
    >();

    mergedInventoryAdjustments.forEach((item) => {
      if (!latest.has(item.productClientId)) {
        latest.set(item.productClientId, item);
      }
    });

    return latest;
  }, [mergedInventoryAdjustments]);

  const mergedInventoryDestructions = useMemo(() => {
    if (!shouldComputePurchaseReports) {
      return [];
    }

    const rows = new Map<
      string,
      ApiInventoryDestruction | LocalInventoryDestruction
    >();

    remoteInventoryDestructions
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.clientDestructionId, item));
    inventoryDestructions
      .filter(
        (item) => item.storeId === selectedStoreId && item.synced !== true,
      )
      .forEach((item) => rows.set(item.clientDestructionId, item));

    return Array.from(rows.values()).sort((a, b) =>
      b.destroyedAt.localeCompare(a.destroyedAt),
    );
  }, [
    inventoryDestructions,
    remoteInventoryDestructions,
    selectedStoreId,
    shouldComputePurchaseReports,
  ]);

  const isInCurrentSettlementCycle = useCallback(
    (recordDate: string, occurredAt: string) => {
      if (!settlementCycleStartIso) {
        return recordDate === todayDate;
      }

      const normalizedOccurredAt = normalizeIsoTimestamp(occurredAt);
      return normalizedOccurredAt
        ? normalizedOccurredAt > settlementCycleStartIso
        : recordDate === todayDate;
    },
    [settlementCycleStartIso, todayDate],
  );

  const ordersInCurrentCycle = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return allMergedOrderRows.filter((item) =>
        isInCurrentSettlementCycle(
          toBusinessDateFromTimestamp(item.orderedAt),
          item.orderedAt,
        ),
      );
    },
    [
      allMergedOrderRows,
      isInCurrentSettlementCycle,
      shouldComputeSettlementReports,
    ],
  );

  const expensesInCurrentCycle = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return mergedExpenseRows.filter((item) =>
        isInCurrentSettlementCycle(item.expenseDate, item.occurredAt),
      );
    },
    [
      isInCurrentSettlementCycle,
      mergedExpenseRows,
      shouldComputeSettlementReports,
    ],
  );

  const purchasesInCurrentCycle = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return mergedPurchaseRows.filter((item) =>
        isInCurrentSettlementCycle(item.purchaseDate, item.occurredAt),
      );
    },
    [
      isInCurrentSettlementCycle,
      mergedPurchaseRows,
      shouldComputeSettlementReports,
    ],
  );

  const withdrawalsInCurrentCycle = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return selectedStoreWithdrawals.filter((item) =>
        isInCurrentSettlementCycle(item.withdrawalDate, item.createdAt),
      );
    },
    [
      isInCurrentSettlementCycle,
      selectedStoreWithdrawals,
      shouldComputeSettlementReports,
    ],
  );

  const filteredExpenseRows = useMemo(
    () => {
      if (heavyReportScreen !== "expenses") {
        return [];
      }

      return mergedExpenseRows.filter((item) => {
        if (
          expenseFilterCategory !== "ALL" &&
          item.category !== expenseFilterCategory
        ) {
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
          !item.description
            .toLowerCase()
            .includes(expenseFilterText.toLowerCase())
        ) {
          return false;
        }

        return true;
      });
    },
    [
      expenseFilterCategory,
      expenseFilterFrom,
      expenseFilterText,
      expenseFilterTo,
      heavyReportScreen,
      mergedExpenseRows,
    ],
  );

  const filteredPurchaseRows = useMemo(
    () => {
      if (heavyReportScreen !== "purchases") {
        return [];
      }

      return mergedPurchaseRows.filter((item) => {
        if (purchaseFilterFrom && item.purchaseDate < purchaseFilterFrom) {
          return false;
        }

        if (purchaseFilterTo && item.purchaseDate > purchaseFilterTo) {
          return false;
        }

        if (
          purchaseFilterProduct &&
          !item.productName
            .toLowerCase()
            .includes(purchaseFilterProduct.toLowerCase())
        ) {
          return false;
        }

        return true;
      });
    },
    [
      heavyReportScreen,
      mergedPurchaseRows,
      purchaseFilterFrom,
      purchaseFilterProduct,
      purchaseFilterTo,
    ],
  );

  const purchaseHistorySummaryRows = useMemo<PurchaseHistorySummaryRow[]>(() => {
    if (heavyReportScreen !== "purchases") {
      return [];
    }

    const orderIndexByProduct = new Map(
      posProducts.map((product, index) => [
        normalizeProductKey(product.name),
        index,
      ]),
    );
    const grouped = new Map<
      string,
      PurchaseHistorySummaryRow & {
        purchaseDates: Set<string>;
        sortIndex: number;
      }
    >();

    filteredPurchaseRows
      .filter((item) => item.purchaseKind !== "PAYMENT")
      .forEach((item) => {
        const productKey = normalizeProductKey(item.productName);
        const key = `${item.purchaseKind}:${productKey}`;
        const existing = grouped.get(key);

        if (existing) {
          existing.quantity += item.quantity;
          existing.totalCost += item.totalCost;
          existing.sellPrice += item.sellPrice;
          existing.synced = existing.synced && item.synced;
          existing.pendingCount += item.synced ? 0 : 1;
          existing.firstPurchaseDate =
            item.purchaseDate < existing.firstPurchaseDate
              ? item.purchaseDate
              : existing.firstPurchaseDate;
          existing.lastPurchaseDate =
            item.purchaseDate > existing.lastPurchaseDate
              ? item.purchaseDate
              : existing.lastPurchaseDate;
          existing.purchaseDates.add(item.purchaseDate);
          return;
        }

        grouped.set(key, {
          key,
          productName: item.productName,
          purchaseKind: item.purchaseKind === "TAWASI" ? "TAWASI" : "SUPPLY",
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          sellPrice: item.sellPrice,
          firstPurchaseDate: item.purchaseDate,
          lastPurchaseDate: item.purchaseDate,
          purchaseDatesCount: 1,
          synced: item.synced,
          pendingCount: item.synced ? 0 : 1,
          purchaseDates: new Set([item.purchaseDate]),
          sortIndex:
            orderIndexByProduct.get(productKey) ?? Number.MAX_SAFE_INTEGER,
        });
      });

    return Array.from(grouped.values())
      .sort((a, b) => {
        if (a.sortIndex !== b.sortIndex) {
          return a.sortIndex - b.sortIndex;
        }
        return a.productName.localeCompare(b.productName, "ar");
      })
      .map(({ purchaseDates, sortIndex, ...row }) => {
        const quantity = Number(row.quantity.toFixed(3));
        const totalCost = Number(row.totalCost.toFixed(2));
        return {
          ...row,
          quantity,
          totalCost,
          unitCost:
            quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : 0,
          sellPrice: Number(row.sellPrice.toFixed(2)),
          purchaseDatesCount: purchaseDates.size,
        };
      });
  }, [filteredPurchaseRows, heavyReportScreen, posProducts]);

  const purchaseInvoiceRows = useMemo<TodayPurchaseInvoiceRow[]>(() => {
    if (heavyReportScreen !== "purchases") {
      return [];
    }

    const orderIndexByProduct = new Map(
      posProducts.map((product, index) => [
        normalizeProductKey(product.name),
        index,
      ]),
    );
    const grouped = new Map<
      string,
      TodayPurchaseInvoiceRow & { sortIndex: number }
    >();

    mergedPurchaseRows
      .filter(
        (item) =>
          item.purchaseDate === activePurchaseInvoiceDate &&
          item.purchaseKind !== "PAYMENT",
      )
      .forEach((item) => {
        const key =
          item.purchaseKind === "TAWASI"
            ? item.clientPurchaseId
            : normalizeProductKey(item.productName);
        const existing = grouped.get(key);
        const note = item.note?.trim();

        if (existing) {
          existing.quantity += item.quantity;
          existing.totalCost += item.totalCost;
          existing.synced = existing.synced && item.synced;
          existing.pendingCount += item.synced ? 0 : 1;
          if (note && !existing.notes.includes(note)) {
            existing.notes.push(note);
          }
          return;
        }

        grouped.set(key, {
          key,
          productName: item.productName,
          purchaseKind: item.purchaseKind === "TAWASI" ? "TAWASI" : "SUPPLY",
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          sellPrice: item.sellPrice,
          notes: note ? [note] : [],
          synced: item.synced,
          pendingCount: item.synced ? 0 : 1,
          sortIndex: orderIndexByProduct.get(key) ?? Number.MAX_SAFE_INTEGER,
        });
      });

    return Array.from(grouped.values())
      .sort((a, b) => {
        if (a.sortIndex !== b.sortIndex) {
          return a.sortIndex - b.sortIndex;
        }
        return a.productName.localeCompare(b.productName, "ar");
      })
      .map(({ sortIndex, ...row }) => {
        const quantity = Number(row.quantity.toFixed(3));
        const totalCost = Number(row.totalCost.toFixed(2));
        return {
          ...row,
          quantity,
          totalCost,
          unitCost:
            quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : 0,
        };
      });
  }, [
    activePurchaseInvoiceDate,
    heavyReportScreen,
    mergedPurchaseRows,
    posProducts,
  ]);

  const purchaseInvoicePaymentRows = useMemo<TodayPurchasePaymentRow[]>(
    () => {
      if (heavyReportScreen !== "purchases") {
        return [];
      }

      return mergedPurchaseRows
        .filter(
          (item) =>
            item.purchaseDate === activePurchaseInvoiceDate &&
            item.purchaseKind === "PAYMENT",
        )
        .map((item) => ({
          key: item.clientPurchaseId,
          amount: item.paymentAmount,
          note: item.note,
          synced: item.synced,
        }));
    },
    [activePurchaseInvoiceDate, heavyReportScreen, mergedPurchaseRows],
  );

  const purchaseInvoiceProductRows = useMemo(
    () =>
      purchaseInvoiceRows.filter(
        (item) => item.purchaseKind === "SUPPLY",
      ),
    [purchaseInvoiceRows],
  );

  const purchaseInvoiceTawasiRows = useMemo(
    () =>
      purchaseInvoiceRows.filter(
        (item) => item.purchaseKind === "TAWASI",
      ),
    [purchaseInvoiceRows],
  );

  const purchaseInvoiceTotal = useMemo(
    () =>
      Number(
        purchaseInvoiceRows
          .reduce((sum, item) => sum + item.totalCost, 0)
          .toFixed(2),
      ),
    [purchaseInvoiceRows],
  );

  const purchaseInvoicePaymentsTotal = useMemo(
    () =>
      Number(
        purchaseInvoicePaymentRows
          .reduce((sum, item) => sum + item.amount, 0)
          .toFixed(2),
      ),
    [purchaseInvoicePaymentRows],
  );

  const purchaseInvoiceBalance = useMemo(
    () =>
      Number(
        Math.max(
          purchaseInvoiceTotal - purchaseInvoicePaymentsTotal,
          0,
        ).toFixed(2),
      ),
    [purchaseInvoicePaymentsTotal, purchaseInvoiceTotal],
  );

  const updatePurchaseInvoiceNoteInput = useCallback(
    (value: string) => {
      setPurchaseInvoiceNoteInput(value);

      if (!selectedStoreId || !activePurchaseInvoiceDate) {
        return;
      }

      const key = buildPurchaseInvoiceNoteKey(
        selectedStoreId,
        activePurchaseInvoiceDate,
      );
      setPurchaseInvoiceNotesByKey((previous) => {
        const next = { ...previous };
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    },
    [activePurchaseInvoiceDate, selectedStoreId],
  );

  const openSelectedPurchasesInvoice = useCallback(
    (dateOverride?: string) => {
      if (!selectedStoreId) {
        setStatusMessage("اختر الفرع أولاً.");
        return;
      }

      const requestedDate = (dateOverride ?? purchaseInvoiceDateInput).trim();
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ||
        toIsoDateOnly(dateFromIsoOnly(requestedDate)) !== requestedDate
      ) {
        setStatusMessage("أدخل تاريخ الفاتورة بصيغة YYYY-MM-DD.");
        return;
      }

      const hasInvoiceRows = mergedPurchaseRows.some(
        (item) => item.purchaseDate === requestedDate,
      );
      if (!hasInvoiceRows) {
        setStatusMessage("لا توجد توريدات أو دفعات مسجلة لهذا التاريخ.");
        return;
      }

      setActivePurchaseInvoiceDate(requestedDate);
      setPurchaseInvoiceDateInput(requestedDate);
      setPurchaseInvoiceNoteInput(
        purchaseInvoiceNotesByKey[
          buildPurchaseInvoiceNoteKey(selectedStoreId, requestedDate)
        ] ?? "",
      );
      setIsTodayPurchasesInvoiceOpen(true);
    },
    [
      mergedPurchaseRows,
      purchaseInvoiceDateInput,
      purchaseInvoiceNotesByKey,
      selectedStoreId,
    ],
  );

  const openTodayPurchasesInvoice = useCallback(() => {
    openSelectedPurchasesInvoice(todayDate);
  }, [openSelectedPurchasesInvoice, todayDate]);

  const closeTodayPurchasesInvoice = useCallback(() => {
    setIsTodayPurchasesInvoiceOpen(false);
  }, []);

  const activePurchaseInvoiceTitle = useMemo(
    () =>
      activePurchaseInvoiceDate === todayDate
        ? "فاتورة توريدات اليوم"
        : `فاتورة توريدات ${activePurchaseInvoiceDate}`,
    [activePurchaseInvoiceDate, todayDate],
  );

  const activePurchaseInvoiceNote = purchaseInvoiceNoteInput.trim();

  const buildProductSalesSummaryRowsForOrders = useCallback(
    (sourceOrders: OrderHistoryRow[]): ProductSalesSummaryRow[] => {
      const byProduct = new Map<string, ProductSalesSummaryRow>();

      sourceOrders.forEach((order) => {
        order.items.forEach((item) => {
          const key = normalizeProductKey(item.productName);
          const fromCatalog = productByNormalizedName.get(key);
          const base = byProduct.get(key) ?? {
            productId: fromCatalog?.id ?? key,
            name: item.productName,
            unitType: fromCatalog?.unitType ?? "PIECE",
            soldQty: 0,
            refundedQty: 0,
            netQty: 0,
            netAmount: 0,
          };

          if (order.status === "REFUNDED") {
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

      return Array.from(byProduct.values())
        .map((item) => ({
          ...item,
          soldQty: Number(item.soldQty.toFixed(3)),
          refundedQty: Number(item.refundedQty.toFixed(3)),
          netQty: Number(item.netQty.toFixed(3)),
          netAmount: Number(item.netAmount.toFixed(2)),
        }))
        .sort(compareProductDisplayRows);
    },
    [compareProductDisplayRows, productByNormalizedName],
  );

  const openExpenseDetails = useCallback((item: ExpenseRow) => {
    setSelectedExpenseDetails(item);
  }, []);

  const openSettlementDetails = useCallback(
    (settlement: SettlementHistoryRow) => {
      const dayOrders = settlementRecordsByDate.orders.get(settlement.businessDate) ?? [];
      const dayExpenses = settlementRecordsByDate.expenses.get(settlement.businessDate) ?? [];
      const dayPurchases = settlementRecordsByDate.purchases.get(settlement.businessDate) ?? [];
      const dayWithdrawals = (settlementRecordsByDate.withdrawals.get(
        settlement.businessDate,
      ) ?? [])
        .map((item) => ({
          ...item,
          employeeName:
            employeeNameById.get(item.employeeId) ?? item.employeeId,
        }));
      const dayProductSalesSummaryRows =
        buildProductSalesSummaryRowsForOrders(dayOrders);

      const salesAmount = dayOrders
        .filter((item) => item.status === "COMPLETED")
        .reduce((sum, item) => sum + item.total, 0);
      const refundAmount = dayOrders
        .filter((item) => item.status === "REFUNDED")
        .reduce((sum, item) => sum + item.total, 0);
      const netSalesAmount = Number((salesAmount - refundAmount).toFixed(2));
      const expensesAmount = Number(
        dayExpenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      );
      const purchasesAmount = Number(
        dayPurchases.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2),
      );
      const withdrawalsAmount = Number(
        dayWithdrawals.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
      );

      const expectedBeforeDistributionAmount = Number(
        (settlement.expectedRevenue ?? 0).toFixed(2),
      );
      const distributedAmount = Number(
        (settlement.cashBoxAmount + settlement.sharesAmount).toFixed(2),
      );
      const expectedRemainingAmount = Number(
        Math.max(
          expectedBeforeDistributionAmount - distributedAmount,
          0,
        ).toFixed(2),
      );
      const inferredCarryInAmount = Number(
        (
          expectedBeforeDistributionAmount -
          (netSalesAmount -
            expensesAmount -
            purchasesAmount -
            withdrawalsAmount)
        ).toFixed(2),
      );
      const carryInAmount =
        settlement.carryInAmount > 0
          ? settlement.carryInAmount
          : inferredCarryInAmount;
      const actualRemainingAmount = Number(
        settlement.actualRemainingAmount.toFixed(2),
      );
      const differenceAmount = Number(
        (
          actualRemainingAmount - expectedBeforeDistributionAmount
        ).toFixed(2),
      );

      setSelectedSettlementDetail({
        businessDate: settlement.businessDate,
        orders: dayOrders,
        expenses: dayExpenses,
        purchases: dayPurchases,
        withdrawals: dayWithdrawals,
        note: settlement.note,
        salesAmount: Number(salesAmount.toFixed(2)),
        refundAmount: Number(refundAmount.toFixed(2)),
        netSalesAmount,
        expensesAmount,
        purchasesAmount,
        withdrawalsAmount,
        productSalesSummaryRows: dayProductSalesSummaryRows,
        carryInAmount,
        expectedBeforeDistributionAmount,
        distributedAmount,
        expectedRemainingAmount,
        actualRemainingAmount,
        differenceAmount,
        sharesAmount: Number(settlement.sharesAmount.toFixed(2)),
        cashBoxAmount: Number(settlement.cashBoxAmount.toFixed(2)),
      });
    },
    [
      buildProductSalesSummaryRowsForOrders,
      employeeNameById,
      settlementRecordsByDate,
    ],
  );

  const productSupplyBaseRows = useMemo<
    Array<Omit<ProductSupplyRow, "receivedToday">>
  >(() => {
    if (!shouldComputePurchaseReports) {
      return [];
    }

    const stockRowsByProductId = new Map(
      remoteInventoryStockRows
        .filter((row) => row.storeId === selectedStoreId)
        .map((row) => [row.productClientId, row]),
    );

    if (stockRowsByProductId.size > 0) {
      return posProducts.map((product) => {
        const stockRow = stockRowsByProductId.get(product.clientProductId);
        return {
          productId: product.id,
          name: product.name,
          unitType: product.unitType,
          sellPrice: product.price,
          costPrice: product.costPrice,
          remainingQty: Number((stockRow?.remainingQty ?? 0).toFixed(3)),
          previousRemainingQty: Number(
            (stockRow?.previousRemainingQty ?? 0).toFixed(3),
          ),
          loggedToday: Number((stockRow?.loggedToday ?? 0).toFixed(3)),
        };
      });
    }

    if (isOnline) {
      return posProducts.map((product) => ({
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty: 0,
        previousRemainingQty: 0,
        loggedToday: 0,
      }));
    }

    const purchasedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();
    const refundedByProduct = new Map<string, number>();
    const destroyedByProduct = new Map<string, number>();
    const previousPurchasedByProduct = new Map<string, number>();
    const previousSoldByProduct = new Map<string, number>();
    const previousRefundedByProduct = new Map<string, number>();
    const previousDestroyedByProduct = new Map<string, number>();
    const todayReceivedByProduct = new Map<string, number>();

    mergedPurchaseRows.forEach((entry) => {
      const key = normalizeProductKey(entry.productName);
      if (entry.purchaseDate === todayDate) {
        todayReceivedByProduct.set(
          key,
          (todayReceivedByProduct.get(key) ?? 0) + entry.quantity,
        );
      }

      const product = productByNormalizedName.get(key);
      const adjustment = product
        ? latestInventoryAdjustmentByProduct.get(product.clientProductId)
        : undefined;
      const purchaseTime = normalizeIsoTimestamp(entry.occurredAt);
      const adjustmentTime = normalizeIsoTimestamp(adjustment?.adjustedAt);
      if (
        adjustmentTime &&
        purchaseTime &&
        purchaseTime <= adjustmentTime
      ) {
        return;
      }

      purchasedByProduct.set(
        key,
        (purchasedByProduct.get(key) ?? 0) + entry.quantity,
      );
      if (entry.purchaseDate < todayDate) {
        previousPurchasedByProduct.set(
          key,
          (previousPurchasedByProduct.get(key) ?? 0) + entry.quantity,
        );
      }
    });

    allMergedOrderRows.forEach((order) => {
      const orderDate = toBusinessDateFromTimestamp(order.orderedAt);
      order.items.forEach((item) => {
        const key = normalizeProductKey(item.productName);
        const product = productByNormalizedName.get(key);
        const adjustment = product
          ? latestInventoryAdjustmentByProduct.get(product.clientProductId)
          : undefined;
        const orderTime = normalizeIsoTimestamp(order.orderedAt);
        const adjustmentTime = normalizeIsoTimestamp(adjustment?.adjustedAt);
        if (adjustmentTime && orderTime && orderTime <= adjustmentTime) {
          return;
        }

        if (order.status === "REFUNDED") {
          refundedByProduct.set(
            key,
            (refundedByProduct.get(key) ?? 0) + item.quantity,
          );
          if (orderDate < todayDate) {
            previousRefundedByProduct.set(
              key,
              (previousRefundedByProduct.get(key) ?? 0) + item.quantity,
            );
          }
        } else {
          soldByProduct.set(key, (soldByProduct.get(key) ?? 0) + item.quantity);
          if (orderDate < todayDate) {
            previousSoldByProduct.set(
              key,
              (previousSoldByProduct.get(key) ?? 0) + item.quantity,
            );
          }
        }
      });
    });

    mergedInventoryDestructions.forEach((destruction) => {
      const product = productByClientProductId.get(destruction.productClientId);
      const adjustment = product
        ? latestInventoryAdjustmentByProduct.get(product.clientProductId)
        : undefined;
      const destructionTime = normalizeIsoTimestamp(destruction.destroyedAt);
      const adjustmentTime = normalizeIsoTimestamp(adjustment?.adjustedAt);
      if (
        adjustmentTime &&
        destructionTime &&
        destructionTime <= adjustmentTime
      ) {
        return;
      }

      const key = product
        ? normalizeProductKey(product.name)
        : destruction.productClientId;
      destroyedByProduct.set(
        key,
        (destroyedByProduct.get(key) ?? 0) + destruction.quantity,
      );
      if (
        destructionTime &&
        toIsoDateOnlyInTimeZone(new Date(destructionTime)) < todayDate
      ) {
        previousDestroyedByProduct.set(
          key,
          (previousDestroyedByProduct.get(key) ?? 0) + destruction.quantity,
        );
      }
    });

    return posProducts.map((product) => {
      const key = normalizeProductKey(product.name);
      const purchased = purchasedByProduct.get(key) ?? 0;
      const sold = soldByProduct.get(key) ?? 0;
      const refunded = refundedByProduct.get(key) ?? 0;
      const destroyed = destroyedByProduct.get(key) ?? 0;
      const previousPurchased = previousPurchasedByProduct.get(key) ?? 0;
      const previousSold = previousSoldByProduct.get(key) ?? 0;
      const previousRefunded = previousRefundedByProduct.get(key) ?? 0;
      const previousDestroyed = previousDestroyedByProduct.get(key) ?? 0;
      const inventoryBaseline =
        latestInventoryAdjustmentByProduct.get(product.clientProductId)
          ?.actualQuantity ?? 0;
      const remainingQty = Number(
        (inventoryBaseline + purchased - sold + refunded - destroyed).toFixed(3),
      );
      const previousRemainingQty = Number(
        (
          inventoryBaseline +
          previousPurchased -
          previousSold +
          previousRefunded -
          previousDestroyed
        ).toFixed(3),
      );
      const loggedToday = Number(
        (todayReceivedByProduct.get(key) ?? 0).toFixed(3),
      );
      return {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        sellPrice: product.price,
        costPrice: product.costPrice,
        remainingQty,
        previousRemainingQty,
        loggedToday,
      };
    });
  }, [
    allMergedOrderRows,
    latestInventoryAdjustmentByProduct,
    mergedInventoryDestructions,
    mergedPurchaseRows,
    posProducts,
    productByClientProductId,
    productByNormalizedName,
    isOnline,
    remoteInventoryStockRows,
    selectedStoreId,
    shouldComputePurchaseReports,
    todayDate,
  ]);

  const productSupplyRows = useMemo<ProductSupplyRow[]>(
    () =>
      productSupplyBaseRows.map((row) => ({
        ...row,
        receivedToday: Number(
          parseNumberInput(todaySupplyInputs[row.productId] ?? "0").toFixed(3),
        ),
      })),
    [productSupplyBaseRows, todaySupplyInputs],
  );

  const settlementInventoryDestructionRows = useMemo(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return mergedInventoryDestructions
        .filter((item) =>
          isInCurrentSettlementCycle(
            toIsoDateOnlyInTimeZone(new Date(item.destroyedAt)),
            item.destroyedAt,
          ),
        )
        .map((item) => {
          const product = productByClientProductId.get(item.productClientId);
          return {
            id: item.clientDestructionId,
            productName: product?.name ?? item.productClientId,
            unitType: product?.unitType ?? 'PIECE',
            quantity: item.quantity,
            note: item.note,
            destroyedAt: item.destroyedAt,
          };
        });
    },
    [
      isInCurrentSettlementCycle,
      mergedInventoryDestructions,
      productByClientProductId,
      shouldComputeSettlementReports,
    ],
  );

  const todaySalesTotal = useMemo(
    () =>
      ordersInCurrentCycle
        .filter((item) => item.status === "COMPLETED")
        .reduce((sum, item) => sum + item.total, 0),
    [ordersInCurrentCycle],
  );

  const todayRefundTotal = useMemo(
    () =>
      ordersInCurrentCycle
        .filter((item) => item.status === "REFUNDED")
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
    () =>
      purchasesInCurrentCycle.reduce((sum, item) => sum + item.totalCost, 0),
    [purchasesInCurrentCycle],
  );

  const weekStartDate = useMemo(
    () => getWeekStartMonday(todayDate),
    [todayDate],
  );
  const weekEndDate = useMemo(
    () => getWeekEndSunday(weekStartDate),
    [weekStartDate],
  );

  const todayEmployeeWithdrawalsTotal = useMemo(
    () => withdrawalsInCurrentCycle.reduce((sum, item) => sum + item.amount, 0),
    [withdrawalsInCurrentCycle],
  );

  const employeeWeeklySnapshots = useMemo<EmployeeWeeklySnapshot[]>(
    () => {
      if (!shouldComputeEmployeeReports) {
        return [];
      }

      return selectedStoreEmployees.map((employee) => {
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
        const earnedAmount = Number(
          ((attendanceDays / 7) * employee.weeklySalary).toFixed(2),
        );
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
      });
    },
    [
      selectedStoreAbsences,
      selectedStoreEmployees,
      selectedStoreWithdrawals,
      shouldComputeEmployeeReports,
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
    () =>
      Number(
        (
          parseNumberInput(cashBoxInput) + parseNumberInput(sharesInput)
        ).toFixed(2),
      ),
    [cashBoxInput, sharesInput],
  );

  const settlementActualRemainingAmount = useMemo(
    () => Number(parseNumberInput(actualRemainingInput).toFixed(2)),
    [actualRemainingInput],
  );

  const settlementCarryForwardAmount = useMemo(
    () =>
      getActualSettlementCarryForwardAmount(
        settlementActualRemainingAmount,
        parseNumberInput(cashBoxInput),
        parseNumberInput(sharesInput),
      ),
    [cashBoxInput, settlementActualRemainingAmount, sharesInput],
  );

  const settlementOverDistributedAmount = useMemo(
    () =>
      Number(
        Math.max(
          settlementDistributedAmount - settlementActualRemainingAmount,
          0,
        ).toFixed(2),
      ),
    [settlementActualRemainingAmount, settlementDistributedAmount],
  );

  const productSalesSummaryRows = useMemo<ProductSalesSummaryRow[]>(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return buildProductSalesSummaryRowsForOrders(ordersInCurrentCycle);
    },
    [
      buildProductSalesSummaryRowsForOrders,
      ordersInCurrentCycle,
      shouldComputeSettlementReports,
    ],
  );

  const pieceStockAuditRows = useMemo<PieceStockAuditRow[]>(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      return buildPieceStockAuditRows(
        productSupplyRows,
        settlementActualInputs,
        parseNumberInput,
      );
    },
    [
      productSupplyRows,
      settlementActualInputs,
      shouldComputeSettlementReports,
    ],
  );

  const financialStockAuditRows = useMemo(
    () => (isAdmin ? [] : pieceStockAuditRows),
    [isAdmin, pieceStockAuditRows],
  );

  const auditNetSalesAmount = useMemo(
    () => getAuditNetSalesAmount(financialStockAuditRows),
    [financialStockAuditRows],
  );

  const auditSalesAmount = useMemo(
    () =>
      Number(
        financialStockAuditRows
          .filter((row) => row.diffQty !== null && row.diffQty < 0)
          .reduce((sum, row) => sum + Math.max(row.adjustmentAmount ?? 0, 0), 0)
          .toFixed(2),
      ),
    [financialStockAuditRows],
  );

  const auditRefundAmount = useMemo(
    () =>
      Number(
        financialStockAuditRows
          .filter((row) => row.diffQty !== null && row.diffQty > 0)
          .reduce((sum, row) => sum + Math.abs(row.adjustmentAmount ?? 0), 0)
          .toFixed(2),
      ),
    [financialStockAuditRows],
  );

  const settlementSalesTotalWithAudit = useMemo(
    () => Number((todaySalesTotal + auditSalesAmount).toFixed(2)),
    [auditSalesAmount, todaySalesTotal],
  );

  const settlementRefundTotalWithAudit = useMemo(
    () => Number((todayRefundTotal + auditRefundAmount).toFixed(2)),
    [auditRefundAmount, todayRefundTotal],
  );

  const settlementNetSalesWithAudit = useMemo(
    () =>
      Number(
        (
          settlementSalesTotalWithAudit - settlementRefundTotalWithAudit
        ).toFixed(2),
      ),
    [settlementRefundTotalWithAudit, settlementSalesTotalWithAudit],
  );

  const settlementProductSalesSummaryRows = useMemo<ProductSalesSummaryRow[]>(
    () => {
      if (!shouldComputeSettlementReports) {
        return [];
      }

      const byProduct = new Map<string, ProductSalesSummaryRow>();

      productSalesSummaryRows.forEach((row) => {
        byProduct.set(row.productId, { ...row });
      });

      financialStockAuditRows.forEach((row) => {
        if (row.diffQty === null || row.diffQty === 0) {
          return;
        }

        const quantity = Math.abs(row.diffQty);
        const amount = Number((quantity * row.unitPrice).toFixed(2));
        const base = byProduct.get(row.productId) ?? {
          productId: row.productId,
          name: row.productName,
          unitType: "PIECE",
          soldQty: 0,
          refundedQty: 0,
          netQty: 0,
          netAmount: 0,
        };

        if (row.diffQty < 0) {
          base.soldQty += quantity;
          base.netQty += quantity;
          base.netAmount += amount;
        } else {
          base.refundedQty += quantity;
          base.netQty -= quantity;
          base.netAmount -= amount;
        }

        byProduct.set(row.productId, base);
      });

      return Array.from(byProduct.values())
        .map((row) => ({
          ...row,
          soldQty: Number(row.soldQty.toFixed(3)),
          refundedQty: Number(row.refundedQty.toFixed(3)),
          netQty: Number(row.netQty.toFixed(3)),
          netAmount: Number(row.netAmount.toFixed(2)),
        }))
        .sort(compareProductDisplayRows);
    },
    [
      compareProductDisplayRows,
      financialStockAuditRows,
      productSalesSummaryRows,
      shouldComputeSettlementReports,
    ],
  );

  const settlementExpectedRevenueAmount = useMemo(
    () =>
      getSettlementExpectedRevenueAmount(
        todayExpectedRemaining,
        auditNetSalesAmount,
      ),
    [auditNetSalesAmount, todayExpectedRemaining],
  );

  const settlementDifferenceAmount = useMemo(
    () =>
      getSettlementDifferenceAmount(
        settlementActualRemainingAmount,
        settlementExpectedRevenueAmount,
      ),
    [settlementActualRemainingAmount, settlementExpectedRevenueAmount],
  );

  const visibleDashboardSummaries = useMemo(
    () =>
      adminDashboardStoreId === ADMIN_DASHBOARD_ALL_STORES
        ? dashboardSummaries
        : dashboardSummaries.filter(
            (item) => item.storeId === adminDashboardStoreId,
          ),
    [adminDashboardStoreId, dashboardSummaries],
  );

  const reducedDashboardTotals = useMemo(
    () => ({
      ordersCount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.ordersCount,
        0,
      ),
      completedRevenue: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.completedRevenue,
        0,
      ),
      refundAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.refundAmount,
        0,
      ),
      sharesAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.sharesAmount,
        0,
      ),
      cashBoxAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.cashBoxAmount,
        0,
      ),
      cashBoxWithdrawalsAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + (item.cashBoxWithdrawalsAmount ?? 0),
        0,
      ),
      actualCashBoxRemainingAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + (item.actualCashBoxRemainingAmount ?? 0),
        0,
      ),
      expectedCarryForwardAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.expectedCarryForwardAmount,
        0,
      ),
      actualRemainingAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.actualRemainingAmount,
        0,
      ),
      settlementDifferenceAmount: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.settlementDifferenceAmount,
        0,
      ),
      netProfit: visibleDashboardSummaries.reduce(
        (sum, item) => sum + item.netProfit,
        0,
      ),
    }),
    [visibleDashboardSummaries],
  );

  const effectiveDashboardTotals = useMemo(
    () =>
      adminDashboardStoreId === ADMIN_DASHBOARD_ALL_STORES && dashboardTotals
        ? dashboardTotals
        : reducedDashboardTotals,
    [adminDashboardStoreId, dashboardTotals, reducedDashboardTotals],
  );

  const selectedAdminCashboxRemainingAmount = useMemo(() => {
    if (adminDashboardStoreId === ADMIN_DASHBOARD_ALL_STORES) {
      return effectiveDashboardTotals.actualCashBoxRemainingAmount ?? 0;
    }

    return (
      dashboardSummaries.find((item) => item.storeId === adminDashboardStoreId)
        ?.actualCashBoxRemainingAmount ?? 0
    );
  }, [adminDashboardStoreId, dashboardSummaries, effectiveDashboardTotals]);

  const logout = useCallback((message: string) => {
    setSession(null);
    refreshTimestampsRef.current = {};
    void saveObject(STORAGE_KEYS.refreshTimestamps, {});
    setDashboardTotals(null);
    setDashboardSummaries([]);
    setRemoteOrders([]);
    setRemoteSettlements([]);
    setRemoteExpenses([]);
    setRemotePurchases([]);
    setRemoteInventoryAdjustments([]);
    setRemoteInventoryDestructions([]);
    setRemoteInventoryStockRows([]);
    setActiveScreen("pos");
    setStatusMessage(message);
  }, []);

  const handleApiFailure = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof ApiError && error.status === 401) {
        logout("انتهت الجلسة، سجّل الدخول من جديد.");
        return;
      }

      if (isLikelyNetworkError(error)) {
        setStatusMessage(
          "تعذر الوصول للسيرفر حالياً، التطبيق يعمل على البيانات المحلية.",
        );
        return;
      }

      setStatusMessage(fallbackMessage);
    },
    [logout],
  );

  const persistArrayDeferred = useCallback((key: string, value: unknown[]) => {
    const previous = deferredArrayPersistenceRef.current.get(key);
    if (previous) {
      clearTimeout(previous.timeout);
    }

    const timeout = setTimeout(() => {
      const pending = deferredArrayPersistenceRef.current.get(key);
      if (!pending || pending.timeout !== timeout) {
        return;
      }

      deferredArrayPersistenceRef.current.delete(key);
      InteractionManager.runAfterInteractions(() => {
        void saveArray(key, pending.value);
      });
    }, 350);

    deferredArrayPersistenceRef.current.set(key, { timeout, value });
  }, []);

  const flushDeferredArrayPersistence = useCallback(() => {
    deferredArrayPersistenceRef.current.forEach(({ timeout, value }, key) => {
      clearTimeout(timeout);
      void saveArray(key, value);
    });
    deferredArrayPersistenceRef.current.clear();
  }, []);

  const persistSyncQueueNow = useCallback((next: SyncJob[]) => {
    syncQueuePersistenceRef.current = syncQueuePersistenceRef.current
      .catch(() => undefined)
      .then(() => saveArray(STORAGE_KEYS.syncQueue, next));
  }, []);

  const persistSyncQueue = useCallback((next: SyncJob[]) => {
    const previous = pendingSyncQueuePersistenceRef.current;
    if (previous) {
      clearTimeout(previous.timeout);
    }

    const version = syncQueuePersistenceVersionRef.current + 1;
    syncQueuePersistenceVersionRef.current = version;
    const timeout = setTimeout(() => {
      const pending = pendingSyncQueuePersistenceRef.current;
      if (!pending || pending.timeout !== timeout) {
        return;
      }

      pendingSyncQueuePersistenceRef.current = null;
      InteractionManager.runAfterInteractions(() => {
        if (syncQueuePersistenceVersionRef.current === version) {
          persistSyncQueueNow(pending.value);
        }
      });
    }, 350);

    pendingSyncQueuePersistenceRef.current = { timeout, value: next, version };
  }, [persistSyncQueueNow]);

  const flushSyncQueuePersistence = useCallback(() => {
    const pending = pendingSyncQueuePersistenceRef.current;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingSyncQueuePersistenceRef.current = null;
    syncQueuePersistenceVersionRef.current = Math.max(
      syncQueuePersistenceVersionRef.current,
      pending.version,
    );
    persistSyncQueueNow(pending.value);
  }, [persistSyncQueueNow]);

  const persistOrdersNow = useCallback((next: LocalOrder[]) => {
    ordersPersistenceRef.current = ordersPersistenceRef.current
      .catch(() => undefined)
      .then(() => saveArray(STORAGE_KEYS.orders, next));
  }, []);

  const persistOrders = useCallback((next: LocalOrder[]) => {
    const previous = pendingOrdersPersistenceRef.current;
    if (previous) {
      clearTimeout(previous.timeout);
    }

    const version = ordersPersistenceVersionRef.current + 1;
    ordersPersistenceVersionRef.current = version;
    const timeout = setTimeout(() => {
      const pending = pendingOrdersPersistenceRef.current;
      if (!pending || pending.timeout !== timeout) {
        return;
      }

      pendingOrdersPersistenceRef.current = null;
      InteractionManager.runAfterInteractions(() => {
        if (ordersPersistenceVersionRef.current === version) {
          persistOrdersNow(pending.value);
        }
      });
    }, 250);

    pendingOrdersPersistenceRef.current = { timeout, value: next, version };
  }, [persistOrdersNow]);

  const flushOrdersPersistence = useCallback(() => {
    const pending = pendingOrdersPersistenceRef.current;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingOrdersPersistenceRef.current = null;
    ordersPersistenceVersionRef.current = Math.max(
      ordersPersistenceVersionRef.current,
      pending.version,
    );
    persistOrdersNow(pending.value);
  }, [persistOrdersNow]);

  const applyOrderSyncMarks = useCallback((referenceIds: ReadonlySet<string>) => {
    if (referenceIds.size === 0) {
      return;
    }

    setOrders((previous) => {
      let changed = false;
      const next = previous.map((order) => {
        if (!referenceIds.has(order.clientOrderId) || order.synced) {
          return order;
        }

        changed = true;
        return { ...order, synced: true };
      });

      if (changed) {
        persistOrders(next);
      }

      return changed ? next : previous;
    });
  }, [persistOrders]);

  const flushPendingOrderSyncMarks = useCallback(() => {
    if (pendingOrderSyncMarkIdsRef.current.size === 0) {
      return;
    }

    const referenceIds = new Set(pendingOrderSyncMarkIdsRef.current);
    pendingOrderSyncMarkIdsRef.current.clear();
    applyOrderSyncMarks(referenceIds);
  }, [applyOrderSyncMarks]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        flushDeferredArrayPersistence();
        flushOrdersPersistence();
        flushPendingOrderSyncMarks();
        flushSyncQueuePersistence();
      }
    });

    return () => {
      subscription.remove();
      flushDeferredArrayPersistence();
      flushOrdersPersistence();
      flushPendingOrderSyncMarks();
      flushSyncQueuePersistence();
    };
  }, [
    flushDeferredArrayPersistence,
    flushOrdersPersistence,
    flushPendingOrderSyncMarks,
    flushSyncQueuePersistence,
  ]);

  const releaseOrderBuildLock = useCallback(() => {
    isBuildingOrderRef.current = false;
  }, []);

  const markOrderSynced = useCallback((referenceId: string) => {
    if (activeScreenRef.current === "pos") {
      pendingOrderSyncMarkIdsRef.current.add(referenceId);
      return;
    }

    applyOrderSyncMarks(new Set([referenceId]));
  }, [applyOrderSyncMarks]);

  const markSettlementSynced = useCallback((referenceId: string) => {
    setDailySettlements((previous) => {
      const next = previous.filter(
        (item) => item.clientClosureId !== referenceId,
      );
      if (next.length !== previous.length) {
        void saveArray(STORAGE_KEYS.dailySettlements, next);
      }
      return next;
    });
  }, []);

  const removeSettlementAdjustmentOrders = useCallback(
    (createdAt: string) => {
      setOrders((previous) => {
        const next = previous.filter(
          (order) =>
            !(
              order.createdLocallyAt === createdAt &&
              order.clientOrderId.startsWith("audit_")
            ),
        );

        if (next.length !== previous.length) {
          persistOrders(next);
        }

        return next;
      });
      setQueue((previous) => {
        const next = previous.filter((job) => {
          const entity = job.entity ?? job.type;
          return !(
            entity === "ORDER" &&
            job.createdAt === createdAt &&
            job.referenceId.startsWith("audit_")
          );
        });

        if (next.length !== previous.length) {
          persistSyncQueue(next);
        }

        return next;
      });
    },
    [persistOrders, persistSyncQueue],
  );

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
      const next = previous.filter(
        (item) => item.clientPurchaseId !== referenceId,
      );
      persistArrayDeferred(STORAGE_KEYS.purchases, next);
      return next;
    });
  }, [persistArrayDeferred]);

  const replaceRemotePurchases = useCallback((data: ApiPurchase[]) => {
    const remoteIds = new Set(data.map((item) => item.clientPurchaseId));
    setRemotePurchases(data);
    setPurchases((previous) => {
      const next = previous.filter(
        (item) => item.synced !== true && !remoteIds.has(item.clientPurchaseId),
      );
      if (next.length !== previous.length) {
        persistArrayDeferred(STORAGE_KEYS.purchases, next);
      }
      return next;
    });
  }, [persistArrayDeferred]);

  const upsertRemoteOrder = useCallback((order: ApiOrder) => {
    setRemoteOrders((previous) => {
      const rows = new Map(previous.map((item) => [item.clientOrderId, item]));
      rows.set(order.clientOrderId, order);
      return Array.from(rows.values()).sort((a, b) =>
        b.orderedAt.localeCompare(a.orderedAt),
      );
    });
  }, []);

  const upsertRemotePurchase = useCallback((purchase: ApiPurchase) => {
    setRemotePurchases((previous) => {
      const rows = new Map(
        previous.map((item) => [item.clientPurchaseId, item]),
      );
      rows.set(purchase.clientPurchaseId, purchase);
      return Array.from(rows.values()).sort((a, b) => {
        const dateCompare = b.purchaseDate.localeCompare(a.purchaseDate);
        return dateCompare !== 0
          ? dateCompare
          : b.createdAt.localeCompare(a.createdAt);
      });
    });
  }, []);

  const upsertRemoteSettlement = useCallback(
    (settlement: ApiDailySettlement) => {
      setRemoteSettlements((previous) => {
        const rows = new Map(
          previous.map((item) => [
            `${item.storeId}:${item.businessDate}`,
            item,
          ]),
        );
        rows.set(
          `${settlement.storeId}:${settlement.businessDate}`,
          settlement,
        );
        return Array.from(rows.values()).sort((a, b) =>
          b.businessDate.localeCompare(a.businessDate),
        );
      });
    },
    [],
  );

  const removeRemotePurchase = useCallback((clientPurchaseId: string) => {
    setRemotePurchases((previous) =>
      previous.filter(
        (item) => item.clientPurchaseId !== clientPurchaseId,
      ),
    );
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

  const markInventoryAdjustmentSynced = useCallback(
    (clientAdjustmentId: string) => {
      setInventoryAdjustments((previous) => {
        const next = previous.filter(
          (item) => item.clientAdjustmentId !== clientAdjustmentId,
        );
        void saveArray(STORAGE_KEYS.inventoryAdjustments, next);
        return next;
      });
    },
    [],
  );

  const markInventoryDestructionSynced = useCallback(
    (clientDestructionId: string) => {
      setInventoryDestructions((previous) => {
        const next = previous.filter(
          (item) => item.clientDestructionId !== clientDestructionId,
        );
        void saveArray(STORAGE_KEYS.inventoryDestructions, next);
        return next;
      });
    },
    [],
  );

  const upsertRemoteInventoryAdjustment = useCallback(
    (adjustment: ApiInventoryAdjustment) => {
      setRemoteInventoryAdjustments((previous) => {
        const rows = new Map(
          previous.map((item) => [item.clientAdjustmentId, item]),
        );
        rows.set(adjustment.clientAdjustmentId, adjustment);
        return Array.from(rows.values()).sort((a, b) =>
          b.adjustedAt.localeCompare(a.adjustedAt),
        );
      });
    },
    [],
  );

  const upsertRemoteInventoryDestruction = useCallback(
    (destruction: ApiInventoryDestruction) => {
      setRemoteInventoryDestructions((previous) => {
        const rows = new Map(
          previous.map((item) => [item.clientDestructionId, item]),
        );
        rows.set(destruction.clientDestructionId, destruction);
        return Array.from(rows.values()).sort((a, b) =>
          b.destroyedAt.localeCompare(a.destroyedAt),
        );
      });
    },
    [],
  );

  const markEmployeeSynced = useCallback((referenceId: string) => {
    setEmployees((previous) => {
      const next = previous.map((item) =>
        item.id === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.employees, next);
      return next;
    });
  }, []);

  const markEmployeeAbsenceSynced = useCallback((referenceId: string) => {
    setEmployeeAbsences((previous) => {
      const next = previous.map((item) =>
        item.id === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.employeeAbsences, next);
      return next;
    });
  }, []);

  const markEmployeeWithdrawalSynced = useCallback((referenceId: string) => {
    setEmployeeWithdrawals((previous) => {
      const next = previous.map((item) =>
        item.id === referenceId ? { ...item, synced: true } : item,
      );
      void saveArray(STORAGE_KEYS.employeeWithdrawals, next);
      return next;
    });
  }, []);

  const enqueueJob = useCallback((job: SyncJob) => {
    setQueue((previous) => {
      const next = mergeSyncJobs(
        previous,
        job,
        inFlightSyncJobIdsRef.current,
      );
      persistSyncQueue(next);
      return next;
    });
  }, [persistSyncQueue]);

  const refreshStoresData = useCallback(async () => {
    if (!authToken) {
      return false;
    }

    try {
      const remoteStores = await fetchStores(authToken);
      if (remoteStores.length === 0) {
        return false;
      }

      setStores(remoteStores);
      await saveArray(STORAGE_KEYS.stores, remoteStores);
      setCashCarryByStore((previous) => ({
        ...previous,
        ...Object.fromEntries(
          remoteStores.map((store) => [
            store.id,
            Number((store.cashCarryAmount ?? 0).toFixed(2)),
          ]),
        ),
      }));

      setSelectedStoreId((previous) => {
        if (isCashier && assignedStoreId) {
          return assignedStoreId;
        }

        return previous || remoteStores[0]?.id || previous;
      });
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحميل المحلات من السيرفر.");
      return false;
    }
  }, [assignedStoreId, authToken, handleApiFailure, isCashier]);

  const refreshOrdersData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const data = await fetchOrders(authToken, {
        storeId: selectedStoreId,
        limit: ORDER_REFRESH_LIMIT,
      });
      setRemoteOrders(data);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث سجل الطلبات من السيرفر.");
      return false;
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshSettlementOrdersData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const data = await fetchOrders(authToken, {
        storeId: selectedStoreId,
      });
      setRemoteOrders(data);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "طھط¹ط°ط± طھط­ط¯ظٹط« ط·ظ„ط¨ط§طھ ط§ظ„طھط³ظˆظٹط© ظ…ظ† ط§ظ„ط³ظٹط±ظپط±.");
      return false;
    }
  }, [
    authToken,
    handleApiFailure,
    isOnline,
    selectedStoreId,
  ]);

  const refreshDailySettlementsData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const data = await fetchDailySettlements(authToken, {
        storeId: selectedStoreId,
      });
      const remoteSettlementDates = new Set(
        data.map((item) => item.businessDate),
      );
      const remoteSettlementClientIds = new Set(
        data.map((item) => item.clientClosureId),
      );
      const staleLocalSettlementTimes = new Set(
        dailySettlements
          .filter(
            (item) =>
              item.storeId === selectedStoreId &&
              (item.synced === true ||
                remoteSettlementDates.has(item.businessDate)),
          )
          .map((item) => item.createdLocallyAt || item.syncedAt),
      );

      setRemoteSettlements(data);
      setDailySettlements((previous) => {
        const next = previous.filter(
          (item) =>
            item.storeId !== selectedStoreId ||
            (item.synced !== true &&
              !remoteSettlementDates.has(item.businessDate)),
        );

        if (next.length !== previous.length) {
          void saveArray(STORAGE_KEYS.dailySettlements, next);
        }

        return next;
      });
      if (staleLocalSettlementTimes.size > 0) {
        setOrders((previous) => {
          const next = previous.filter(
            (order) =>
              !(
                staleLocalSettlementTimes.has(order.createdLocallyAt) &&
                order.clientOrderId.startsWith("audit_")
              ),
          );

          if (next.length !== previous.length) {
            persistOrders(next);
          }

          return next;
        });
      }
      setQueue((previous) => {
        const next = previous.filter((job) => {
          const entity = job.entity ?? job.type;
          if (
            entity === "ORDER" &&
            staleLocalSettlementTimes.has(job.createdAt) &&
            job.referenceId.startsWith("audit_")
          ) {
            return false;
          }

          if (entity !== "DAILY_SETTLEMENT") {
            return true;
          }

          const payload =
            job.payload as Partial<CreateDailySettlementPayload>;
          if (remoteSettlementClientIds.has(job.referenceId)) {
            return false;
          }

          return !(
            payload.storeId === selectedStoreId &&
            payload.businessDate !== undefined &&
            remoteSettlementDates.has(payload.businessDate)
          );
        });

        if (next.length !== previous.length) {
          persistSyncQueue(next);
        }

        return next;
      });
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث تسويات اليوم من السيرفر.");
      return false;
    }
  }, [
    authToken,
    dailySettlements,
    handleApiFailure,
    isOnline,
    persistOrders,
    persistSyncQueue,
    selectedStoreId,
  ]);

  const refreshExpensesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const data = await fetchExpenses(authToken, { storeId: selectedStoreId });
      setRemoteExpenses(data);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث المصاريف من السيرفر.");
      return false;
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshPurchasesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const data = await fetchPurchases(authToken, {
        storeId: selectedStoreId,
      });
      replaceRemotePurchases(data);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث المشتريات من السيرفر.");
      return false;
    }
  }, [
    authToken,
    handleApiFailure,
    isOnline,
    replaceRemotePurchases,
    selectedStoreId,
  ]);

  const refreshInventoryData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const [purchaseData, stockData, adjustmentData, destructionData] =
        await Promise.all([
        fetchPurchases(authToken, { storeId: selectedStoreId }),
        fetchInventoryStock(authToken, { storeId: selectedStoreId }),
        fetchInventoryAdjustments(authToken, { storeId: selectedStoreId }),
        fetchInventoryDestructions(authToken, { storeId: selectedStoreId }),
      ]);
      replaceRemotePurchases(purchaseData);
      setRemoteInventoryStockRows(stockData);
      setRemoteInventoryAdjustments(adjustmentData);
      setRemoteInventoryDestructions(destructionData);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث بيانات المخزون من السيرفر.");
      return false;
    }
  }, [
    authToken,
    handleApiFailure,
    isOnline,
    replaceRemotePurchases,
    selectedStoreId,
  ]);

  const refreshEmployeesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    try {
      const [remoteEmployees, remoteAbsences, remoteWithdrawals] =
        await Promise.all([
          fetchEmployees(authToken, { storeId: selectedStoreId }),
          fetchEmployeeAbsences(authToken, { storeId: selectedStoreId }),
          fetchEmployeeWithdrawals(authToken, { storeId: selectedStoreId }),
        ]);
      const pendingAbsenceDeletes = new Set(
        queue
          .filter(
            (job) =>
              job.entity === "EMPLOYEE_ABSENCE" && job.action === "DELETE",
          )
          .map((job) => job.referenceId),
      );
      const pendingWithdrawalDeletes = new Set(
        queue
          .filter(
            (job) =>
              job.entity === "EMPLOYEE_WITHDRAWAL" &&
              job.action === "DELETE",
          )
          .map((job) => job.referenceId),
      );

      setEmployees((previous) => {
        const selected = new Map<string, Employee>();
        remoteEmployees.forEach((item) => {
          selected.set(item.clientEmployeeId, {
            id: item.clientEmployeeId,
            storeId: item.storeId,
            name: item.name,
            weeklySalary: item.weeklySalary,
            isActive: item.isActive,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            synced: true,
          });
        });
        previous
          .filter(
            (item) => item.storeId === selectedStoreId && item.synced !== true,
          )
          .forEach((item) => selected.set(item.id, item));

        return [
          ...previous.filter((item) => item.storeId !== selectedStoreId),
          ...Array.from(selected.values()),
        ].sort((a, b) => a.name.localeCompare(b.name, "ar"));
      });

      setEmployeeAbsences((previous) => {
        const selected = new Map<string, EmployeeAbsenceEntry>();
        remoteAbsences.forEach((item) => {
          if (!pendingAbsenceDeletes.has(item.clientAbsenceId)) {
            selected.set(item.clientAbsenceId, {
              id: item.clientAbsenceId,
              employeeId: item.employeeClientId,
              storeId: item.storeId,
              absenceDate: item.absenceDate,
              note: item.note,
              createdAt: item.createdAt,
              synced: true,
            });
          }
        });
        previous
          .filter(
            (item) => item.storeId === selectedStoreId && item.synced !== true,
          )
          .forEach((item) => selected.set(item.id, item));

        return [
          ...previous.filter((item) => item.storeId !== selectedStoreId),
          ...Array.from(selected.values()),
        ].sort((a, b) => b.absenceDate.localeCompare(a.absenceDate));
      });

      setEmployeeWithdrawals((previous) => {
        const selected = new Map<string, EmployeeWithdrawalEntry>();
        remoteWithdrawals.forEach((item) => {
          if (!pendingWithdrawalDeletes.has(item.clientWithdrawalId)) {
            selected.set(item.clientWithdrawalId, {
              id: item.clientWithdrawalId,
              employeeId: item.employeeClientId,
              storeId: item.storeId,
              amount: item.amount,
              withdrawalDate: item.withdrawalDate,
              note: item.note,
              createdAt: item.createdAt,
              synced: true,
            });
          }
        });
        previous
          .filter(
            (item) => item.storeId === selectedStoreId && item.synced !== true,
          )
          .forEach((item) => selected.set(item.id, item));

        return [
          ...previous.filter((item) => item.storeId !== selectedStoreId),
          ...Array.from(selected.values()),
        ].sort((a, b) => b.withdrawalDate.localeCompare(a.withdrawalDate));
      });
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث بيانات الموظفين من السيرفر.");
      return false;
    }
  }, [authToken, handleApiFailure, isOnline, queue, selectedStoreId]);

  const refreshProductsData = useCallback(async () => {
    if (!authToken || !isOnline) {
      return false;
    }

    try {
      const data = await fetchProducts(authToken);
      const pendingDeleteIds = new Set(
        queue
          .filter(
            (job) =>
              (job.entity ?? job.type) === "PRODUCT" &&
              (job.action ?? "CREATE") === "DELETE",
          )
          .map((job) => job.referenceId),
      );

      setProducts((previous) => {
        const localProducts = previous.map((item) => toLocalProduct(item));
        const remoteVisibleProducts = data.filter(
          (item) => !pendingDeleteIds.has(item.clientProductId),
        );
        const next = mergeProductsWithRemote(
          remoteVisibleProducts,
          localProducts,
        );
        void saveArray(STORAGE_KEYS.products, next);
        return next;
      });
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث كتالوج المنتجات من السيرفر.");
      return false;
    }
  }, [authToken, handleApiFailure, isOnline, queue]);

  const refreshSettlementData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return false;
    }

    const refreshKey = `${authToken}:${selectedStoreId}`;
    if (settlementRefreshPromiseRef.current?.key === refreshKey) {
      return settlementRefreshPromiseRef.current.promise;
    }

    const refreshPromise = Promise.all([
      refreshSettlementOrdersData(),
      refreshInventoryData(),
      refreshDailySettlementsData(),
      refreshEmployeesData(),
      refreshExpensesData(),
      refreshProductsData(),
    ]).then((results) => results.every(Boolean));
    settlementRefreshPromiseRef.current = {
      key: refreshKey,
      promise: refreshPromise,
    };

    try {
      return await refreshPromise;
    } finally {
      if (settlementRefreshPromiseRef.current?.promise === refreshPromise) {
        settlementRefreshPromiseRef.current = null;
      }
    }
  }, [
    authToken,
    isOnline,
    refreshDailySettlementsData,
    refreshEmployeesData,
    refreshExpensesData,
    refreshInventoryData,
    refreshSettlementOrdersData,
    refreshProductsData,
    selectedStoreId,
  ]);

  const refreshDashboardData = useCallback(async () => {
    if (!isOnline || !isAdmin || !authToken) {
      return false;
    }

    if (
      adminFromDateInput &&
      adminToDateInput &&
      adminFromDateInput > adminToDateInput
    ) {
      setStatusMessage("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.");
      return;
    }

    try {
      const dashboard = await fetchDashboard(authToken, {
        from: adminFromDateInput || undefined,
        to: adminToDateInput || undefined,
      });
      setDashboardTotals(dashboard.totals);
      setDashboardSummaries(dashboard.stores);
      return true;
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث لوحة الإدارة حالياً.");
      return false;
    }
  }, [
    adminFromDateInput,
    adminToDateInput,
    authToken,
    handleApiFailure,
    isAdmin,
    isOnline,
  ]);

  const updateAdminCashboxWithdrawalAmountInput = (value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }
    setAdminCashboxWithdrawalAmountInput(normalized);
  };

  const submitAdminCashboxWithdrawal = useCallback(async () => {
    if (!isAdmin || !authToken) {
      setStatusMessage("هذه العملية متاحة للإدارة فقط.");
      return;
    }

    if (!isOnline) {
      setStatusMessage("يجب توفر اتصال بالسيرفر لتسجيل سحب من الصندوق.");
      return;
    }

    const amount = Number(
      parseNumberInput(adminCashboxWithdrawalAmountInput).toFixed(2),
    );
    if (amount <= 0) {
      setStatusMessage("أدخل مبلغ سحب صحيح.");
      return;
    }

    if (amount > selectedAdminCashboxRemainingAmount) {
      setStatusMessage(
        `مبلغ السحب أكبر من المتبقي الفعلي: ${formatMoney(selectedAdminCashboxRemainingAmount)}.`,
      );
      return;
    }

    const payload: CreateCashboxWithdrawalPayload = {
      storeId:
        adminDashboardStoreId === ADMIN_DASHBOARD_ALL_STORES
          ? undefined
          : adminDashboardStoreId,
      amount,
      note: adminCashboxWithdrawalNoteInput.trim() || undefined,
      withdrawnAt: new Date().toISOString(),
    };

    try {
      await postCashboxWithdrawal(authToken, payload);
      setAdminCashboxWithdrawalAmountInput("");
      setAdminCashboxWithdrawalNoteInput("");
      await refreshDashboardData();
      const storeName =
        adminDashboardStoreId === ADMIN_DASHBOARD_ALL_STORES
          ? "كل الفروع"
          : stores.find((store) => store.id === adminDashboardStoreId)?.name ??
            "الفرع";
      setStatusMessage(
        `تم تسجيل سحب ${formatMoney(amount)} من صندوق ${storeName}.`,
      );
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 400) {
        setStatusMessage("تعذر تسجيل السحب: المبلغ أكبر من رصيد الصندوق المتاح.");
        return;
      }

      handleApiFailure(error, "تعذر تسجيل سحب الصندوق حالياً.");
    }
  }, [
    adminCashboxWithdrawalAmountInput,
    adminCashboxWithdrawalNoteInput,
    adminDashboardStoreId,
    authToken,
    handleApiFailure,
    isAdmin,
    isOnline,
    refreshDashboardData,
    selectedAdminCashboxRemainingAmount,
    stores,
  ]);

  const markResourceFresh = useCallback((resourceKey: string) => {
    const next = {
      ...refreshTimestampsRef.current,
      [resourceKey]: Date.now(),
    };
    refreshTimestampsRef.current = next;
    void saveObject(STORAGE_KEYS.refreshTimestamps, next);
  }, []);

  const refreshResource = useCallback(
    async (
      resourceKey: string,
      refresh: () => Promise<boolean | undefined>,
      force: boolean,
    ) => {
      const refreshedAt = refreshTimestampsRef.current[resourceKey] ?? 0;
      if (!force && Date.now() - refreshedAt < RESOURCE_REFRESH_TTL_MS) {
        return true;
      }

      const inFlight = resourceRefreshPromisesRef.current.get(resourceKey);
      if (inFlight) {
        return inFlight;
      }

      const refreshPromise = refresh()
        .then((succeeded) => {
          if (succeeded) {
            markResourceFresh(resourceKey);
          }
          return Boolean(succeeded);
        })
        .finally(() => {
          if (
            resourceRefreshPromisesRef.current.get(resourceKey) ===
            refreshPromise
          ) {
            resourceRefreshPromisesRef.current.delete(resourceKey);
          }
        });

      resourceRefreshPromisesRef.current.set(resourceKey, refreshPromise);
      return refreshPromise;
    },
    [markResourceFresh],
  );

  const refreshActiveScreenData = useCallback(async (
    options: ActiveScreenRefreshOptions = {},
  ) => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    const force = options.force ?? false;
    const showIndicator = options.showIndicator ?? force;
    const refreshKey = `${activeScreen}:${selectedStoreId}:${session.accessToken}`;
    if (activeScreenRefreshPromiseRef.current?.key === refreshKey) {
      await activeScreenRefreshPromiseRef.current.promise;
      return;
    }

    const refreshPromise = (async () => {
      if (showIndicator) {
        setIsRefreshingActiveScreen(true);
      }

      const refreshForStore = (
        resource: string,
        refresh: () => Promise<boolean | undefined>,
      ) => refreshResource(`${resource}:${selectedStoreId}`, refresh, force);
      const refreshGlobal = (
        resource: string,
        refresh: () => Promise<boolean | undefined>,
      ) => refreshResource(`${resource}:global`, refresh, force);

      try {
        switch (activeScreen) {
          case "pos":
            await Promise.all([
              refreshGlobal("stores", refreshStoresData),
              refreshGlobal("products", refreshProductsData),
            ]);
            return;
          case "purchases":
            await Promise.all([
              refreshGlobal("products", refreshProductsData),
              refreshForStore("inventory", refreshInventoryData),
            ]);
            return;
          case "expenses":
            await refreshForStore("expenses", refreshExpensesData);
            return;
          case "employees":
            await refreshForStore("employees", refreshEmployeesData);
            return;
          case "orders":
            await refreshForStore("orders", refreshOrdersData);
            return;
          case "settlement":
            await Promise.all([
              refreshForStore("settlement-orders", refreshSettlementOrdersData),
              refreshForStore("inventory", refreshInventoryData),
              refreshForStore("settlements", refreshDailySettlementsData),
              refreshForStore("employees", refreshEmployeesData),
              refreshForStore("expenses", refreshExpensesData),
              refreshGlobal("products", refreshProductsData),
            ]);
            return;
          case "admin":
            await Promise.all([
              refreshGlobal("stores", refreshStoresData),
              refreshResource(
                `dashboard:${adminFromDateInput}:${adminToDateInput}`,
                refreshDashboardData,
                force,
              ),
            ]);
            return;
        }
      } finally {
        if (showIndicator) {
          setIsRefreshingActiveScreen(false);
        }
      }
    })();

    activeScreenRefreshPromiseRef.current = {
      key: refreshKey,
      promise: refreshPromise,
    };

    try {
      await refreshPromise;
    } finally {
      if (activeScreenRefreshPromiseRef.current?.promise === refreshPromise) {
        activeScreenRefreshPromiseRef.current = null;
      }
    }
  }, [
    activeScreen,
    adminFromDateInput,
    adminToDateInput,
    isOnline,
    refreshDashboardData,
    refreshEmployeesData,
    refreshExpensesData,
    refreshInventoryData,
    refreshOrdersData,
    refreshProductsData,
    refreshSettlementOrdersData,
    refreshResource,
    refreshStoresData,
    selectedStoreId,
    session?.accessToken,
  ]);

  const applyAdminDateSelection = useCallback(
    (target: "from" | "to", selectedDate: Date) => {
      const isoDate = toIsoDateOnly(selectedDate);
      if (target === "from") {
        setAdminFromDateInput(isoDate);
        return;
      }
      setAdminToDateInput(isoDate);
    },
    [],
  );

  const openAdminDatePicker = useCallback(
    (target: "from" | "to") => {
      const source = target === "from" ? adminFromDateInput : adminToDateInput;
      const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(source);
      setAdminDatePickerValue(
        isIsoDateOnly ? dateFromIsoOnly(source) : new Date(),
      );
      setAdminDatePickerTarget(target);
    },
    [adminFromDateInput, adminToDateInput],
  );

  const clearAdminDateFilters = useCallback(() => {
    setAdminFromDateInput("");
    setAdminToDateInput("");
    setStatusMessage("تم مسح فلتر التاريخ من لوحة التسوية.");
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
  }, [
    adminDatePickerTarget,
    adminDatePickerValue,
    applyAdminDateSelection,
    closeAdminDatePicker,
  ]);

  const onAdminDatePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        const target = adminDatePickerTarget;
        closeAdminDatePicker();

        if (event.type === "set" && selectedDate && target) {
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

  const applyPurchaseDateSelection = useCallback(
    (target: "from" | "to", selectedDate: Date) => {
      const isoDate = toIsoDateOnly(selectedDate);
      if (target === "from") {
        setPurchaseFilterFrom(isoDate);
        return;
      }
      setPurchaseFilterTo(isoDate);
    },
    [],
  );

  const openPurchaseDatePicker = useCallback(
    (target: "from" | "to") => {
      const source = target === "from" ? purchaseFilterFrom : purchaseFilterTo;
      const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(source);
      setPurchaseDatePickerValue(
        isIsoDateOnly ? dateFromIsoOnly(source) : new Date(),
      );
      setPurchaseDatePickerTarget(target);
    },
    [purchaseFilterFrom, purchaseFilterTo],
  );

  const clearPurchaseDateFilters = useCallback(() => {
    setPurchaseFilterFrom("");
    setPurchaseFilterTo("");
    setStatusMessage("تم مسح فلتر تاريخ المشتريات.");
  }, []);

  const closePurchaseDatePicker = useCallback(() => {
    setPurchaseDatePickerTarget(null);
  }, []);

  const confirmPurchaseDatePicker = useCallback(() => {
    if (!purchaseDatePickerTarget) {
      return;
    }

    applyPurchaseDateSelection(
      purchaseDatePickerTarget,
      purchaseDatePickerValue,
    );
    closePurchaseDatePicker();
  }, [
    applyPurchaseDateSelection,
    closePurchaseDatePicker,
    purchaseDatePickerTarget,
    purchaseDatePickerValue,
  ]);

  const onPurchaseDatePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        const target = purchaseDatePickerTarget;
        closePurchaseDatePicker();

        if (event.type === "set" && selectedDate && target) {
          applyPurchaseDateSelection(target, selectedDate);
        }
        return;
      }

      if (selectedDate) {
        setPurchaseDatePickerValue(selectedDate);
      }
    },
    [
      applyPurchaseDateSelection,
      closePurchaseDatePicker,
      purchaseDatePickerTarget,
    ],
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

      if (authUser.role === "CASHIER" && authUser.storeId) {
        setSelectedStoreId(authUser.storeId);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        logout("انتهت الجلسة، سجّل الدخول من جديد.");
        return;
      }

      if (!isLikelyNetworkError(error)) {
        setStatusMessage("تعذر التحقق من الجلسة الحالية.");
      }
    }
  }, [authToken, isOnline, logout]);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncingRef.current || queue.length === 0 || !authToken) {
      return;
    }

    const jobsToSync = queue
      .filter((job) => !job.permanentFailure)
      .map((job, index) => ({ job, index }))
      .sort((a, b) => {
        if (a.job.createdAt === b.job.createdAt) {
          const aEntity = a.job.entity ?? a.job.type;
          const bEntity = b.job.entity ?? b.job.type;
          const aIsAuditOrder =
            aEntity === "ORDER" && a.job.referenceId.startsWith("audit_");
          const bIsAuditOrder =
            bEntity === "ORDER" && b.job.referenceId.startsWith("audit_");

          if (aEntity === "DAILY_SETTLEMENT" && bIsAuditOrder) {
            return -1;
          }

          if (aIsAuditOrder && bEntity === "DAILY_SETTLEMENT") {
            return 1;
          }
        }

        return a.index - b.index;
      })
      .map((entry) => entry.job);
    if (jobsToSync.length === 0) {
      const permanentlyFailedCount = queue.filter(
        (job) => job.permanentFailure,
      ).length;
      if (activeScreenRef.current !== "pos") {
        setStatusMessage(
        `يوجد ${permanentlyFailedCount} عملية متوقفة بسبب خطأ دائم وتحتاج إلى تعديل البيانات قبل إعادة المحاولة.`,
      );
      }
      return;
    }

    isSyncingRef.current = true;
    if (activeScreenRef.current !== "pos") {
      setIsSyncing(true);
    setStatusMessage("يتم حالياً مزامنة العمليات المحلية...");
    }

    const inventoryChangesOnly = jobsToSync.every((job) =>
      ["INVENTORY_ADJUSTMENT", "INVENTORY_DESTRUCTION"].includes(
        job.entity ?? job.type ?? "",
      ),
    );
    const completedJobIds = new Set<string>();
    const retryJobs = new Map<string, SyncJob>();
    const blockedSettlementAdjustmentTimes = new Set<string>();
    let stoppedForConnection = false;
    let stoppedForAuthentication = false;

    for (let index = 0; index < jobsToSync.length; index += 1) {
      const job = jobsToSync[index];
      const precheckEntity = job.entity ?? job.type;
      if (
        precheckEntity === "ORDER" &&
        blockedSettlementAdjustmentTimes.has(job.createdAt) &&
        job.referenceId.startsWith("audit_")
      ) {
        completedJobIds.add(job.id);
        continue;
      }

      inFlightSyncJobIdsRef.current.add(job.id);

      try {
        const entity = job.entity ?? job.type;
        const action = job.action ?? "CREATE";
        let handled = true;

        if (entity === "ORDER") {
          await postOrder(authToken, job.payload as CreateOrderPayload);
          markOrderSynced(job.referenceId);
        } else if (entity === "DAILY_SETTLEMENT") {
          const settlementPayload =
            job.payload as Partial<CreateDailySettlementPayload>;
          const expectedRemainingFallback = Math.max(
            (settlementPayload.expectedRevenue ?? 0) -
              (settlementPayload.cashBoxAmount ?? 0) -
              (settlementPayload.sharesAmount ?? 0),
            0,
          );

          const settlement = await postDailySettlement(authToken, {
            ...(settlementPayload as CreateDailySettlementPayload),
            actualRemainingAmount:
              settlementPayload.actualRemainingAmount ??
              Number(expectedRemainingFallback.toFixed(2)),
          });
          upsertRemoteSettlement(settlement);
          markSettlementSynced(job.referenceId);
        } else if (entity === "EXPENSE" && action === "CREATE") {
          let payload = job.payload as CreateExpensePayload;
          const matchingExpense = expenses.find(
            (item) => item.clientExpenseId === job.referenceId,
          );
          if (!payload.imageUrl && matchingExpense?.localImageUri) {
            if (isRemoteUri(matchingExpense.localImageUri)) {
              payload = { ...payload, imageUrl: matchingExpense.localImageUri };
            } else {
              const uploadedImageUrl = await uploadExpenseImageToCloudinary(
                authToken,
                matchingExpense.localImageUri,
              );
              payload = { ...payload, imageUrl: uploadedImageUrl };
            }

            setExpenses((previous) => {
              const next = previous.map((item) =>
                item.clientExpenseId === job.referenceId
                  ? { ...item, imageUrl: payload.imageUrl }
                  : item,
              );
              void saveArray(STORAGE_KEYS.expenses, next);
              return next;
            });
          }

          await postExpense(authToken, payload);
          markExpenseSynced(job.referenceId);
        } else if (entity === "EXPENSE" && action === "UPDATE") {
          let payload = job.payload as UpdateExpensePayload;
          const matchingExpense = expenses.find(
            (item) => item.clientExpenseId === job.referenceId,
          );
          if (!payload.imageUrl && matchingExpense?.localImageUri) {
            if (isRemoteUri(matchingExpense.localImageUri)) {
              payload = { ...payload, imageUrl: matchingExpense.localImageUri };
            } else {
              const uploadedImageUrl = await uploadExpenseImageToCloudinary(
                authToken,
                matchingExpense.localImageUri,
              );
              payload = { ...payload, imageUrl: uploadedImageUrl };
            }

            setExpenses((previous) => {
              const next = previous.map((item) =>
                item.clientExpenseId === job.referenceId
                  ? { ...item, imageUrl: payload.imageUrl }
                  : item,
              );
              void saveArray(STORAGE_KEYS.expenses, next);
              return next;
            });
          }

          await patchExpense(authToken, job.referenceId, payload);
          markExpenseSynced(job.referenceId);
        } else if (entity === "EXPENSE" && action === "DELETE") {
          await deleteExpense(authToken, job.referenceId);
        } else if (entity === "PURCHASE" && action === "CREATE") {
          await postPurchase(authToken, job.payload as CreatePurchasePayload);
          markPurchaseSynced(job.referenceId);
        } else if (entity === "PURCHASE" && action === "UPDATE") {
          await patchPurchase(
            authToken,
            job.referenceId,
            job.payload as UpdatePurchasePayload,
          );
          markPurchaseSynced(job.referenceId);
        } else if (entity === "PURCHASE" && action === "DELETE") {
          await deletePurchase(authToken, job.referenceId);
        } else if (entity === "PRODUCT" && action === "CREATE") {
          await postProduct(authToken, job.payload as CreateProductPayload);
          markProductSynced(job.referenceId);
        } else if (entity === "PRODUCT" && action === "UPDATE") {
          await patchProduct(
            authToken,
            job.referenceId,
            job.payload as UpdateProductPayload,
          );
          markProductSynced(job.referenceId);
        } else if (entity === "PRODUCT" && action === "DELETE") {
          await deleteProduct(authToken, job.referenceId);
        } else if (
          entity === "INVENTORY_ADJUSTMENT" &&
          action === "CREATE"
        ) {
          if (!isAdmin) {
            retryJobs.set(job.id, job);
            continue;
          }
          const adjustmentPayload =
            job.payload as CreateInventoryAdjustmentPayload;
          const adjustment = await postInventoryAdjustment(
            authToken,
            adjustmentPayload,
          );
          upsertRemoteInventoryAdjustment(adjustment);
          markInventoryAdjustmentSynced(
            adjustmentPayload.clientAdjustmentId,
          );
        } else if (
          entity === "INVENTORY_DESTRUCTION" &&
          action === "CREATE"
        ) {
          const destructionPayload =
            job.payload as CreateInventoryDestructionPayload;
          const destruction = await postInventoryDestruction(
            authToken,
            destructionPayload,
          );
          upsertRemoteInventoryDestruction(destruction);
          markInventoryDestructionSynced(
            destructionPayload.clientDestructionId,
          );
        } else if (entity === "EMPLOYEE" && action === "CREATE") {
          await postEmployee(authToken, job.payload as CreateEmployeePayload);
          markEmployeeSynced(job.referenceId);
        } else if (entity === "EMPLOYEE" && action === "UPDATE") {
          await patchEmployee(
            authToken,
            job.referenceId,
            job.payload as UpdateEmployeePayload,
          );
          markEmployeeSynced(job.referenceId);
        } else if (entity === "EMPLOYEE_ABSENCE" && action === "CREATE") {
          await postEmployeeAbsence(
            authToken,
            job.payload as CreateEmployeeAbsencePayload,
          );
          markEmployeeAbsenceSynced(job.referenceId);
        } else if (entity === "EMPLOYEE_ABSENCE" && action === "DELETE") {
          await deleteEmployeeAbsence(authToken, job.referenceId);
        } else if (entity === "EMPLOYEE_WITHDRAWAL" && action === "CREATE") {
          await postEmployeeWithdrawal(
            authToken,
            job.payload as CreateEmployeeWithdrawalPayload,
          );
          markEmployeeWithdrawalSynced(job.referenceId);
        } else if (entity === "EMPLOYEE_WITHDRAWAL" && action === "DELETE") {
          await deleteEmployeeWithdrawal(authToken, job.referenceId);
        } else {
          handled = false;
        }

        if (!handled) {
          throw new UnsupportedSyncOperationError(
            `Unsupported sync operation: ${entity ?? "UNKNOWN"}/${action}`,
          );
        }

        completedJobIds.add(job.id);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          stoppedForAuthentication = true;
          logout("انتهت الجلسة أثناء المزامنة. الرجاء تسجيل الدخول مجدداً.");
          break;
        }

        if (isLikelyNetworkError(error)) {
          stoppedForConnection = true;
          break;
        }

        const entity = job.entity ?? job.type;
        const action = job.action ?? "CREATE";
        if (
          entity === "DAILY_SETTLEMENT" &&
          error instanceof ApiError &&
          error.status === 409
        ) {
          completedJobIds.add(job.id);
          blockedSettlementAdjustmentTimes.add(job.createdAt);
          markSettlementSynced(job.referenceId);
          removeSettlementAdjustmentOrders(job.createdAt);
          void refreshDailySettlementsData();
          void refreshStoresData();
          continue;
        }

        if (
          error instanceof ApiError &&
          error.status === 404 &&
          action === "DELETE"
        ) {
          completedJobIds.add(job.id);
          continue;
        }

        const permanentFailure = isPermanentSyncError(error);
        retryJobs.set(job.id, {
          ...job,
          retries: permanentFailure
            ? MAX_SYNC_JOB_RETRIES
            : Math.min(job.retries + 1, MAX_SYNC_JOB_RETRIES - 1),
          permanentFailure: permanentFailure || undefined,
        });
      } finally {
        inFlightSyncJobIdsRef.current.delete(job.id);
      }
    }

    setQueue((currentQueue) => {
      const next = currentQueue.flatMap((currentJob) => {
        if (completedJobIds.has(currentJob.id)) {
          return [];
        }

        const retryJob = retryJobs.get(currentJob.id);
        return retryJob ? [retryJob] : [currentJob];
      });
      persistSyncQueue(next);
      return next;
    });
    isSyncingRef.current = false;
    setIsSyncing((current) => (current ? false : current));

    const snapshotRemainingCount =
      jobsToSync.length - completedJobIds.size;
    if (snapshotRemainingCount === 0) {
      if (activeScreenRef.current !== "pos") {
      setStatusMessage(
        `تمت مزامنة ${completedJobIds.size} عملية مؤجلة بنجاح.`,
      );
      }
      if (inventoryChangesOnly) {
        return;
      }
      if (activeScreenRef.current === "pos") {
        return;
      }
      await Promise.all([
        refreshDashboardData(),
        refreshSettlementData(),
      ]);
      return;
    }

    if (stoppedForAuthentication) {
      return;
    }

    if (activeScreenRef.current !== "pos") {
    setStatusMessage(
      stoppedForConnection
        ? `توقف الاتصال بعد مزامنة ${completedJobIds.size} عملية، وستُستكمل البقية تلقائياً.`
        : `تمت مزامنة ${completedJobIds.size} عملية، وبقي ${snapshotRemainingCount} عملية معلقة.`,
    );
    }
  }, [
    isAdmin,
    isOnline,
    expenses,
    markExpenseSynced,
    markEmployeeAbsenceSynced,
    markEmployeeSynced,
    markEmployeeWithdrawalSynced,
    markInventoryAdjustmentSynced,
    markInventoryDestructionSynced,
    upsertRemoteInventoryAdjustment,
    upsertRemoteInventoryDestruction,
    markOrderSynced,
    markProductSynced,
    markPurchaseSynced,
    markSettlementSynced,
    persistSyncQueue,
    queue,
    removeSettlementAdjustmentOrders,
    authToken,
    logout,
    refreshDashboardData,
    refreshDailySettlementsData,
    refreshSettlementData,
    refreshStoresData,
    upsertRemoteSettlement,
  ]);

  const loginUser = useCallback(async () => {
    const payload: LoginPayload = {
      username: usernameInput.trim(),
      password: passwordInput,
    };

    if (!payload.username || !payload.password) {
      setStatusMessage("أدخل اسم المستخدم وكلمة المرور أولاً.");
      return;
    }

    setIsLoggingIn(true);

    try {
      const authSession = await login(payload, {
        onNetworkRetry: ({ attempt, maxAttempts }) => {
          setStatusMessage(
            `ضعف اتصال بالسيرفر، إعادة المحاولة ${attempt}/${maxAttempts}...`,
          );
        },
      });
      setSession(authSession);
      refreshTimestampsRef.current = {};
      void saveObject(STORAGE_KEYS.refreshTimestamps, {});
      setActiveScreen("pos");

      if (authSession.user.role === "CASHIER" && authSession.user.storeId) {
        setSelectedStoreId(authSession.user.storeId);
      }

      setStatusMessage(`مرحباً ${authSession.user.displayName}`);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setStatusMessage("بيانات الدخول غير صحيحة.");
        } else {
          const apiMessage = extractApiMessage(error);
          setStatusMessage(
            apiMessage
              ? `فشل تسجيل الدخول: ${apiMessage}`
              : `فشل تسجيل الدخول (${error.status}).`,
          );
        }
      } else if (isLikelyNetworkError(error)) {
        setStatusMessage(
          `تعذر الاتصال بالسيرفر بعد عدة محاولات. تأكد من تشغيل الباك اند وصحة عنوان API: ${API_BASE_URL}.`,
        );
      } else {
        setStatusMessage("حدث خطأ غير متوقع أثناء تسجيل الدخول.");
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

      setStatusMessage(
        "تأخر تحميل البيانات المحلية. تم المتابعة مع بيانات افتراضية.",
      );
      setStores(FALLBACK_STORES);
      setSelectedStoreId(FALLBACK_STORES[0]?.id ?? "");
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
          cachedInventoryAdjustments,
          cachedInventoryDestructions,
          cachedProducts,
          cachedEmployees,
          cachedEmployeeAbsences,
          cachedEmployeeWithdrawals,
          cachedCashCarryByStore,
          cachedProductOrderByStore,
          cachedPurchaseInvoiceNotes,
          cachedQueue,
          cachedRefreshTimestamps,
        ] = await Promise.all([
          loadObject<AuthSession>(STORAGE_KEYS.authSession),
          loadArray<Store>(STORAGE_KEYS.stores),
          loadArray<LocalOrder>(STORAGE_KEYS.orders),
          loadArray<LocalDailySettlement>(STORAGE_KEYS.dailySettlements),
          loadArray<LocalExpense>(STORAGE_KEYS.expenses),
          loadArray<ExpenseCategoryOption>(STORAGE_KEYS.expenseCategories),
          loadArray<LocalPurchase>(STORAGE_KEYS.purchases),
          loadArray<LocalInventoryAdjustment>(
            STORAGE_KEYS.inventoryAdjustments,
          ),
          loadArray<LocalInventoryDestruction>(
            STORAGE_KEYS.inventoryDestructions,
          ),
          loadArray<ProductTemplate | LocalProduct>(STORAGE_KEYS.products),
          loadArray<Employee>(STORAGE_KEYS.employees),
          loadArray<EmployeeAbsenceEntry>(STORAGE_KEYS.employeeAbsences),
          loadArray<EmployeeWithdrawalEntry>(STORAGE_KEYS.employeeWithdrawals),
          loadObject<Record<string, number>>(STORAGE_KEYS.cashCarryByStore),
          loadObject<Record<string, string[]>>(PRODUCT_ORDER_STORAGE_KEY),
          loadObject<Record<string, string>>(STORAGE_KEYS.purchaseInvoiceNotes),
          loadArray<SyncJob>(STORAGE_KEYS.syncQueue),
          loadObject<RefreshTimestamps>(STORAGE_KEYS.refreshTimestamps),
        ]);

        if (!mounted) {
          return;
        }

        const initialStores =
          cachedStores.length > 0 ? cachedStores : FALLBACK_STORES;
        const correctedPurchases = cachedPurchases
          .map(correctCachedPurchaseDate)
          .filter((item) => item.synced !== true);
        const correctedQueue = cachedQueue.map(correctPurchaseSyncJobDate);
        const recoveredOrderQueue = cachedOrders
          .filter((order) => order.synced !== true)
          .reduce<SyncJob[]>(
            (next, order) => mergeSyncJobs(next, buildOrderCreateSyncJob(order)),
            correctedQueue,
          );
        const recoveredQueue = cachedSettlements
          .filter((settlement) => settlement.synced !== true)
          .reduce<SyncJob[]>(
            (next, settlement) =>
              mergeSyncJobs(next, buildDailySettlementCreateSyncJob(settlement)),
            recoveredOrderQueue,
          );
        if (
          correctedPurchases.length !== cachedPurchases.length ||
          correctedPurchases.some(
            (item, index) => item !== cachedPurchases[index],
          )
        ) {
          await saveArray(STORAGE_KEYS.purchases, correctedPurchases);
        }
        if (
          recoveredQueue.length !== cachedQueue.length ||
          recoveredQueue.some((item, index) => item !== cachedQueue[index])
        ) {
          await saveArray(STORAGE_KEYS.syncQueue, recoveredQueue);
        }
        const scopedStores =
          cachedSession?.user.role === "CASHIER" && cachedSession.user.storeId
            ? initialStores.filter(
                (store) => store.id === cachedSession.user.storeId,
              )
            : initialStores;
        const effectiveStores =
          scopedStores.length > 0 ? scopedStores : initialStores;
        const initialStoreId =
          cachedSession?.user.role === "CASHIER" && cachedSession.user.storeId
            ? cachedSession.user.storeId
            : (effectiveStores[0]?.id ?? "");
        const initialProducts =
          cachedProducts.length > 0
            ? cachedProducts.map((item) => toLocalProduct(item))
            : buildProductsFromHistory(correctedPurchases, cachedOrders).map(
                (item) => toLocalProduct(item),
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
        setReportOrders(cachedOrders);
        setDailySettlements(cachedSettlements);
        setExpenses(cachedExpenses);
        setExpenseCategoryOptions(initialExpenseCategories);
        setPurchases(correctedPurchases);
        setInventoryAdjustments(cachedInventoryAdjustments);
        setInventoryDestructions(cachedInventoryDestructions);
        setProducts(initialProducts);
        setEmployees(cachedEmployees);
        setEmployeeAbsences(cachedEmployeeAbsences);
        setEmployeeWithdrawals(cachedEmployeeWithdrawals);
        hasLoadedCashCarryRef.current = true;
        setCashCarryByStore(cachedCashCarryByStore ?? {});
        setProductOrderByStore(cachedProductOrderByStore ?? {});
        setPurchaseInvoiceNotesByKey(cachedPurchaseInvoiceNotes ?? {});
        setQueue(recoveredQueue);
        refreshTimestampsRef.current = cachedRefreshTimestamps ?? {};
        setSelectedStoreId(initialStoreId);
      } catch {
        if (!mounted) {
          return;
        }

        setSession(null);
        setStores(FALLBACK_STORES);
        setOrders([]);
        setReportOrders([]);
        setDailySettlements([]);
        setExpenses([]);
        setExpenseCategoryOptions(DEFAULT_EXPENSE_CATEGORY_OPTIONS);
        setPurchases([]);
        setInventoryAdjustments([]);
        setInventoryDestructions([]);
        setProducts([]);
        setEmployees([]);
        setEmployeeAbsences([]);
        setEmployeeWithdrawals([]);
        hasLoadedCashCarryRef.current = true;
        setCashCarryByStore({});
        setProductOrderByStore({});
        setPurchaseInvoiceNotesByKey({});
        setQueue([]);
        refreshTimestampsRef.current = {};
        setSelectedStoreId(FALLBACK_STORES[0]?.id ?? "");
        setStatusMessage(
          "حدث خطأ في تحميل البيانات المحلية. تم تشغيل النظام بالوضع الافتراضي.",
        );
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
    void saveArray(STORAGE_KEYS.inventoryAdjustments, inventoryAdjustments);
  }, [inventoryAdjustments]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.inventoryDestructions, inventoryDestructions);
  }, [inventoryDestructions]);

  useEffect(() => {
    void saveArray(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    void saveObject(PRODUCT_ORDER_STORAGE_KEY, productOrderByStore);
  }, [productOrderByStore]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    void saveObject(STORAGE_KEYS.purchaseInvoiceNotes, purchaseInvoiceNotesByKey);
  }, [isBootstrapping, purchaseInvoiceNotesByKey]);

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
    if (isBootstrapping || !hasLoadedCashCarryRef.current) {
      return;
    }
    void saveObject(STORAGE_KEYS.cashCarryByStore, cashCarryByStore);
  }, [cashCarryByStore, isBootstrapping]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const canSyncStore = (storeId: string) =>
      !isCashier || !assignedStoreId || storeId === assignedStoreId;

    employees
      .filter((item) => item.synced !== true && canSyncStore(item.storeId))
      .forEach((item) => {
        enqueueJob({
          id: makeId("job"),
          referenceId: item.id,
          retries: 0,
          createdAt: item.updatedAt,
          entity: "EMPLOYEE",
          action: "CREATE",
          payload: {
            clientEmployeeId: item.id,
            storeId: item.storeId,
            name: item.name,
            weeklySalary: item.weeklySalary,
            isActive: item.isActive,
            syncedAt: item.updatedAt,
          },
        });
      });

    employeeAbsences
      .filter((item) => item.synced !== true && canSyncStore(item.storeId))
      .forEach((item) => {
        enqueueJob({
          id: makeId("job"),
          referenceId: item.id,
          retries: 0,
          createdAt: item.createdAt,
          entity: "EMPLOYEE_ABSENCE",
          action: "CREATE",
          payload: {
            clientAbsenceId: item.id,
            employeeClientId: item.employeeId,
            storeId: item.storeId,
            absenceDate: item.absenceDate,
            note: item.note,
            syncedAt: item.createdAt,
          },
        });
      });

    employeeWithdrawals
      .filter((item) => item.synced !== true && canSyncStore(item.storeId))
      .forEach((item) => {
        enqueueJob({
          id: makeId("job"),
          referenceId: item.id,
          retries: 0,
          createdAt: item.createdAt,
          entity: "EMPLOYEE_WITHDRAWAL",
          action: "CREATE",
          payload: {
            clientWithdrawalId: item.id,
            employeeClientId: item.employeeId,
            storeId: item.storeId,
            amount: item.amount,
            withdrawalDate: item.withdrawalDate,
            note: item.note,
            syncedAt: item.createdAt,
          },
        });
      });

    if (isAdmin) {
      inventoryAdjustments
        .filter((item) => item.synced !== true)
        .forEach((item) => {
          enqueueJob({
            id: makeId("job"),
            referenceId: `${item.storeId}:${item.productClientId}`,
            retries: 0,
            createdAt: item.adjustedAt,
            entity: "INVENTORY_ADJUSTMENT",
            action: "CREATE",
            payload: {
              clientAdjustmentId: item.clientAdjustmentId,
              storeId: item.storeId,
              productClientId: item.productClientId,
              actualQuantity: item.actualQuantity,
              adjustedAt: item.adjustedAt,
              syncedAt: item.syncedAt,
            },
          });
        });

    }

    inventoryDestructions
      .filter((item) => item.synced !== true && canSyncStore(item.storeId))
      .forEach((item) => {
        enqueueJob({
          id: makeId("job"),
          referenceId: item.clientDestructionId,
          retries: 0,
          createdAt: item.destroyedAt,
          entity: "INVENTORY_DESTRUCTION",
          action: "CREATE",
          payload: {
            clientDestructionId: item.clientDestructionId,
            storeId: item.storeId,
            productClientId: item.productClientId,
            quantity: item.quantity,
            note: item.note,
            destroyedAt: item.destroyedAt,
            syncedAt: item.syncedAt,
          },
        });
      });
  }, [
    assignedStoreId,
    employeeAbsences,
    employeeWithdrawals,
    employees,
    enqueueJob,
    inventoryAdjustments,
    inventoryDestructions,
    isAdmin,
    isBootstrapping,
    isCashier,
  ]);

  useEffect(() => {
    let mounted = true;

    void NetInfo.fetch().then((state) => {
      if (!mounted) {
        return;
      }

      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setIsOnline(connected);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
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
      ...(isAdmin ? (["admin"] as AppScreenKey[]) : []),
    ]);
    if (!availableKeys.has(activeScreen)) {
      setActiveScreen(navItems[0]?.key ?? "pos");
    }
  }, [activeScreen, isAdmin, navItems]);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsMobileNavVisible(false);
  }, [activeScreen]);

  useEffect(() => {
    if (activeScreen !== "pos") {
      flushPendingOrderSyncMarks();
    }
  }, [activeScreen, flushPendingOrderSyncMarks]);

  useEffect(() => {
    if (isDesktop) {
      setIsMobileNavOpen(false);
      setIsMobileNavVisible(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!isMobileNavVisible) {
      mobileNavTranslateX.setValue(mobileNavDrawerWidth + 32);
      mobileNavBackdropOpacity.setValue(0);
    }
  }, [
    isMobileNavVisible,
    mobileNavBackdropOpacity,
    mobileNavDrawerWidth,
    mobileNavTranslateX,
  ]);

  useEffect(() => {
    if (isCashier && assignedStoreId) {
      setSelectedStoreId(assignedStoreId);
    }
  }, [assignedStoreId, isCashier]);

  useEffect(() => {
    setTodaySupplyInputs({});
    setSettlementActualInputs({});
    setSelectedInventoryDestructionProductId("");
    setInventoryDestructionQuantityInput("");
    setInventoryDestructionNoteInput("");
    setInventoryDestructionInputs({});
    setInventoryDestructionNoteInputs({});
    setCashBoxInput("");
    setSharesInput("");
    setActualRemainingInput("");
    setSettlementNoteInput("");
    setEmployeeEditingId(null);
    setEmployeeNameInput("");
    setEmployeeWeeklySalaryInput("");
    setTawasiCapitalInput("");
    setTawasiSellPriceInput("");
    setTawasiNoteInput("");
    const currentDate = toIsoDateOnlyInTimeZone(new Date());
    setPurchaseInvoiceDateInput(currentDate);
    setActivePurchaseInvoiceDate(currentDate);
    setPurchaseInvoiceNoteInput("");
    setSupplyPaymentAmountInput("");
    setSupplyPaymentNoteInput("");
    setSelectedOrderInvoice(null);
    setSelectedExpenseDetails(null);
    setSelectedSettlementDetail(null);
    setIsTodayPurchasesInvoiceOpen(false);
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    const validIds = new Set(products.map((item) => item.id));
    setProductOrderByStore((previous) => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(previous).forEach(([storeId, orderedIds]) => {
        const filtered = orderedIds.filter((id) => validIds.has(id));
        if (filtered.length !== orderedIds.length) {
          changed = true;
        }
        next[storeId] = filtered;
      });

      return changed ? next : previous;
    });
  }, [products]);

  useEffect(() => {
    const normalizedCurrent =
      normalizeExpenseCategoryValue(expenseCategoryInput);
    const exists = effectiveExpenseCategoryOptions.some(
      (option) =>
        normalizeExpenseCategoryValue(option.value) === normalizedCurrent,
    );
    if (!exists) {
      setExpenseCategoryInput(
        effectiveExpenseCategoryOptions[0]?.value ?? "OTHER",
      );
    }
  }, [effectiveExpenseCategoryOptions, expenseCategoryInput]);

  useEffect(() => {
    if (expenseFilterCategory === "ALL") {
      return;
    }

    const normalizedCurrent = normalizeExpenseCategoryValue(
      expenseFilterCategory,
    );
    const exists = effectiveExpenseCategoryOptions.some(
      (option) =>
        normalizeExpenseCategoryValue(option.value) === normalizedCurrent,
    );
    if (!exists) {
      setExpenseFilterCategory("ALL");
    }
  }, [effectiveExpenseCategoryOptions, expenseFilterCategory]);

  useEffect(() => {
    if (selectedStoreEmployees.length === 0) {
      setAbsenceEmployeeIdInput("");
      setWithdrawalEmployeeIdInput("");
      return;
    }

    if (
      !selectedStoreEmployees.some((item) => item.id === absenceEmployeeIdInput)
    ) {
      setAbsenceEmployeeIdInput(selectedStoreEmployees[0].id);
    }

    if (
      !selectedStoreEmployees.some(
        (item) => item.id === withdrawalEmployeeIdInput,
      )
    ) {
      setWithdrawalEmployeeIdInput(selectedStoreEmployees[0].id);
    }
  }, [
    absenceEmployeeIdInput,
    selectedStoreEmployees,
    withdrawalEmployeeIdInput,
  ]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    void refreshActiveScreenData();
  }, [
    activeScreen,
    isOnline,
    refreshActiveScreenData,
    selectedStoreId,
    session?.accessToken,
  ]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshActiveScreenData();
    }, ACTIVE_SCREEN_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isOnline, refreshActiveScreenData, session?.accessToken]);

  useEffect(() => {
    if (!isOnline || !session?.accessToken) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshActiveScreenData();
      }
    });

    return () => subscription.remove();
  }, [isOnline, refreshActiveScreenData, session?.accessToken]);

  useEffect(() => {
    if (!session || !isOnline) {
      return;
    }

    void validateSession();
  }, [isOnline, session?.accessToken, validateSession]);

  const syncQueueTrigger = useMemo(
    () =>
      queue
        .map((job) =>
          [
            job.id,
            job.retries,
            job.permanentFailure ? "1" : "0",
          ].join(":"),
        )
        .join("|"),
    [queue],
  );

  const syncQueueRef = useRef(syncQueue);

  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);

  useEffect(() => {
    void syncQueueRef.current();
  }, [isOnline, session?.accessToken, syncQueueTrigger]);

  useEffect(() => {
    if (
      !isOnline ||
      !session?.accessToken ||
      !queue.some((job) => !job.permanentFailure)
    ) {
      return;
    }

    const intervalId = setInterval(() => {
      void syncQueueRef.current();
    }, SYNC_RETRY_DELAY_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline, queue.length, session?.accessToken]);

  const pushPadToken = (token: string) => {
    setPosPadInput((previous) => {
      if (token === "." && previous.includes(".")) {
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
    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
  };

  const applyDiscountFromPad = () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل رقم الحسم أولاً من لوحة الأرقام.");
      return;
    }

    const discountValue = parseNumberInput(posPadInput);
    setDiscountInput(String(discountValue));
    setPosPadInput("");
    setStatusMessage(`تم ضبط الحسم على ${discountValue}.`);
  };

  const activateMultiply = () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل رقم الكمية أولاً ثم اضغط ضرب.");
      return;
    }

    const multiplier = parseNumberInput(posPadInput);
    if (multiplier <= 0) {
      setStatusMessage("قيمة الضرب غير صالحة.");
      return;
    }

    setPendingMultiplier(multiplier);
    setPendingAmountValue(null);
    setPosPadInput("");
    setStatusMessage(`وضع الكمية مفعل: اختر منتجاً لإضافة ${multiplier}.`);
  };

  const activateAmountMode = () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل مبلغ البيع أولاً ثم اضغط مبلغ.");
      return;
    }

    const amountValue = parseNumberInput(posPadInput);
    if (amountValue <= 0) {
      setStatusMessage("مبلغ البيع غير صالح.");
      return;
    }

    setPendingAmountValue(amountValue);
    setPendingMultiplier(null);
    setPosPadInput("");
    setStatusMessage(
      `وضع المبلغ مفعل: اختر منتجاً للبيع بقيمة ${formatMoney(amountValue)}.`,
    );
  };

  const roundPadValue = async () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل مبلغاً أولاً لإضافته إلى الكاش.");
      return;
    }

    const cashValue = parseNumberInput(posPadInput);
    if (cashValue <= 0) {
      setStatusMessage("قيمة الكاش غير صالحة.");
      return;
    }

    const effectiveStoreId = isCashier
      ? assignedStoreId ?? ""
      : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage("اختر الفرع قبل إضافة الكاش المدوّر.");
      return;
    }

    setCashCarryByStore((previous) => ({
      ...previous,
      [effectiveStoreId]: Number(
        ((previous[effectiveStoreId] ?? 0) + cashValue).toFixed(2),
      ),
    }));
    setCashBoxInput((previous) => {
      const previousValue = parseNumberInput(previous);
      return String(Number((previousValue + cashValue).toFixed(2)));
    });
    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    if (isOnline && authToken) {
      try {
        const updatedStore = await addStoreCashCarry(
          authToken,
          effectiveStoreId,
          cashValue,
        );
        setCashCarryByStore((previous) => ({
          ...previous,
          [effectiveStoreId]: Number(
            (updatedStore.cashCarryAmount ?? 0).toFixed(2),
          ),
        }));
        setStores((previous) =>
          previous.map((store) =>
            store.id === effectiveStoreId ? updatedStore : store,
          ),
        );
        setStatusMessage(
          `تمت إضافة ${formatMoney(cashValue)} إلى المدوّر ومزامنته مع الفرع.`,
        );
        return;
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          logout("انتهت الجلسة. حُفظ المدوّر على هذا الجهاز فقط.");
          return;
        }
      }
    }

    setStatusMessage(
      `تمت إضافة ${formatMoney(cashValue)} محلياً؛ ستحتاج المزامنة عند توفر الاتصال.`,
    );
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
    let fixedLineTotalToAdd: number | undefined;
    let operationMessage = "";

    if (pendingMultiplier && pendingMultiplier > 0) {
      quantityToAdd = normalizeQuantityForUnit(
        product.unitType,
        pendingMultiplier,
      );
      if (quantityToAdd <= 0) {
        setStatusMessage(
          product.unitType === "KG"
            ? "قيمة الكمية المدخلة غير صالحة."
            : "منتج القطعة يحتاج كمية أكبر من أو تساوي 1.",
        );
        return;
      }

      operationMessage = `تمت إضافة ${quantityToAdd} من ${product.name}.`;
    } else if (pendingAmountValue && pendingAmountValue > 0) {
      if (product.price <= 0) {
        setStatusMessage("لا يمكن البيع بالمبلغ لأن سعر المنتج غير صالح.");
        return;
      }

      quantityToAdd = normalizeQuantityForUnit(
        product.unitType,
        pendingAmountValue / product.price,
      );
      if (quantityToAdd <= 0) {
        setStatusMessage("تعذر حساب الكمية من المبلغ المدخل.");
        return;
      }

      fixedLineTotalToAdd = pendingAmountValue;
      operationMessage = `تمت إضافة ${product.name} بقيمة ${formatMoney(
        pendingAmountValue,
      )} (كمية ${quantityToAdd}).`;
    } else if (posPadInput.trim()) {
      const directQuantityValue = parseNumberInput(posPadInput);
      if (directQuantityValue <= 0) {
        setStatusMessage("قيمة الكمية المدخلة غير صالحة.");
        return;
      }

      quantityToAdd = normalizeQuantityForUnit(
        product.unitType,
        directQuantityValue,
      );
      if (quantityToAdd <= 0) {
        setStatusMessage(
          product.unitType === "KG"
            ? "قيمة الكمية المدخلة غير صالحة."
            : "منتج القطعة يحتاج كمية أكبر من أو تساوي 1.",
        );
        return;
      }

      operationMessage = `تمت إضافة ${quantityToAdd} من ${product.name}.`;
    }

    setCart((previous) => {
      const found = previous.find((item) => item.id === product.id);

      if (!found) {
        return [
          ...previous,
          {
            ...product,
            quantity: quantityToAdd,
            lineTotal: fixedLineTotalToAdd,
          },
        ];
      }

      return previous.map((item) =>
        item.id === product.id
          ? {
              ...item,
              quantity: item.quantity + quantityToAdd,
              lineTotal:
                item.lineTotal !== undefined ||
                fixedLineTotalToAdd !== undefined
                  ? (item.lineTotal ?? item.price * item.quantity) +
                    (fixedLineTotalToAdd ?? product.price * quantityToAdd)
                  : undefined,
            }
          : item,
      );
    });

    if (operationMessage) {
      setStatusMessage(operationMessage);
    }

    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
  };

  const addMiscAmountToCart = () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل مبلغ المنوعات من لوحة الأرقام أولاً.");
      return;
    }

    const miscAmount = parseNumberInput(posPadInput);
    if (miscAmount <= 0) {
      setStatusMessage("مبلغ المنوعات غير صالح.");
      return;
    }

    const miscItem: CartItem = {
      id: MISC_CART_ITEM_ID,
      name: MISC_CART_ITEM_NAME,
      unitType: "PIECE",
      quantity: 1,
      price: miscAmount,
      costPrice: 0,
    };

    setCart((previous) => [...previous, miscItem]);
    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setStatusMessage(`تمت إضافة منوعات بقيمة ${formatMoney(miscAmount)}.`);
  };

  const addTawasiSupplyFromPad = async () => {
    if (isBuildingOrderRef.current) {
      return;
    }

    if (!posPadInput.trim()) {
      setStatusMessage("أدخل مبلغ التواصي من لوحة الأرقام أولاً.");
      return;
    }

    const tawasiAmount = parseNumberInput(posPadInput);
    if (tawasiAmount <= 0) {
      setStatusMessage("مبلغ التواصي غير صالح.");
      return;
    }

    if (!session) {
      setStatusMessage("سجّل الدخول أولاً.");
      return;
    }

    const effectiveStoreId = isCashier
      ? assignedStoreId ?? ""
      : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage("اختر المحل أولاً.");
      return;
    }

    isBuildingOrderRef.current = true;
    const orderedAt = new Date().toISOString();
    const clientOrderId = makeId("order");
    const payload: CreateOrderPayload = {
      clientOrderId,
      storeId: effectiveStoreId,
      cashierName: session.user.displayName,
      status: "COMPLETED",
      paymentMethod: "CASH",
      subtotal: tawasiAmount,
      discount: 0,
      tax: 0,
      total: tawasiAmount,
      items: [
        {
          productName: "تواصي",
          quantity: 1,
          unitPrice: tawasiAmount,
          lineTotal: tawasiAmount,
        },
      ],
      orderedAt,
    };

    const localOrder: LocalOrder = {
      ...payload,
      synced: false,
      createdLocallyAt: orderedAt,
    };

    setOrders((previous) => {
      const next = [localOrder, ...previous];
      persistOrders(next);
      return next;
    });

    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setIsRefundMode(false);

    const syncJob: SyncJob = {
      id: makeId("job"),
      referenceId: clientOrderId,
      retries: 0,
      createdAt: orderedAt,
      entity: "ORDER",
      action: "CREATE",
      payload,
    };

    enqueueJob(syncJob);
    releaseOrderBuildLock();
    setStatusMessage(
      `تم حفظ بيع التواصي بقيمة ${formatMoney(tawasiAmount)} محلياً وجاري رفعه بالخلفية.`,
    );
    return;

  };

  const handlePosProductDragEnd = ({ data }: { data: LocalProduct[] }) => {
    if (!selectedStoreId) {
      return;
    }

    setProductOrderByStore((previous) => ({
      ...previous,
      [selectedStoreId]: data.map((item) => item.id),
    }));
    setStatusMessage("تم حفظ ترتيب المنتجات محلياً على هذا الجهاز.");
  };

  const decreaseProductInCart = (productId: string) => {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.id !== productId) {
            return item;
          }

          const quantity = Math.max(item.quantity - 1, 0);
          return {
            ...item,
            quantity,
            lineTotal:
              item.lineTotal === undefined
                ? undefined
                : quantity === 0
                ? 0
                : Math.max(
                    item.lineTotal - item.price,
                    0,
                  ),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const cancelCurrentOrder = () => {
    if (cart.length === 0) {
      setStatusMessage("السلة فارغة بالفعل.");
      return;
    }

    setCart([]);
    setDiscountInput("0");
    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setIsRefundMode(false);
    setStatusMessage("تم إلغاء الطلب ومسح السلة.");
  };

  const submitOrder = async () => {
    if (isBuildingOrderRef.current) {
      return;
    }

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

    isBuildingOrderRef.current = true;
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
      tax: 0,
      total,
      items: cart.map((item) => ({
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.lineTotal ?? item.quantity * item.price,
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
      persistOrders(next);
      return next;
    });

    setCart([]);
    setDiscountInput('0');
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

    enqueueJob(syncJob);
    releaseOrderBuildLock();
    setStatusMessage('تم حفظ الطلب محلياً وجاري رفعه بالخلفية.');
    return;

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
    const businessDate = toIsoDateOnlyInTimeZone(new Date(createdAt));
    const cashBoxAmount = parseNumberInput(cashBoxInput);
    const sharesAmount = parseNumberInput(sharesInput);
    const actualRemainingAmount = Number(parseNumberInput(actualRemainingInput).toFixed(2));
    if (actualRemainingAmount < 0) {
      setStatusMessage('المبلغ المتبقي الفعلي يجب أن يكون صفراً أو أكبر.');
      return;
    }
    const distributedAmount = Number((cashBoxAmount + sharesAmount).toFixed(2));
    const carryForwardAmount = getActualSettlementCarryForwardAmount(
      actualRemainingAmount,
      cashBoxAmount,
      sharesAmount,
    );

    const adjustmentRows = isCashier
      ? pieceStockAuditRows.filter(
          (row) => row.diffQty !== null && Math.abs(row.diffQty) > 0,
        )
      : [];
    const { adjustmentRecords, adjustmentJobs } = buildSettlementAdjustmentOrders({
      adjustmentRows,
      products,
      storeId: effectiveStoreId,
      cashierName: session.user.displayName,
      createdAt,
      makeId,
    });

    if (adjustmentRecords.length > 0) {
      setOrders((previous) => {
        const next = [...adjustmentRecords, ...previous];
        persistOrders(next);
        return next;
      });
    }

    const payload: CreateDailySettlementPayload = {
      clientClosureId,
      storeId: effectiveStoreId,
      businessDate,
      cashBoxAmount,
      sharesAmount,
      actualRemainingAmount,
      expectedRevenue: settlementExpectedRevenueAmount,
      carryInAmount,
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
    setCashCarryByStore((previous) => ({
      ...previous,
      [effectiveStoreId]: carryForwardAmount,
    }));
    setSettlementActualInputs({});
    setSelectedInventoryDestructionProductId("");
    setInventoryDestructionQuantityInput("");
    setInventoryDestructionNoteInput("");
    setInventoryDestructionInputs({});
    setInventoryDestructionNoteInputs({});

    const syncJob: SyncJob = {
      id: makeId('job'),
      referenceId: clientClosureId,
      retries: 0,
      createdAt,
      entity: 'DAILY_SETTLEMENT',
      action: 'CREATE',
      payload,
    };

    const postedAdjustmentJobIds = new Set<string>();
    let postedSettlement = false;

    if (isOnline && authToken) {
      try {
        const settlement = await postDailySettlement(authToken, payload);
        postedSettlement = true;
        upsertRemoteSettlement(settlement);
        markSettlementSynced(clientClosureId);

        for (const job of adjustmentJobs) {
          await postOrder(authToken, job.payload as CreateOrderPayload);
          postedAdjustmentJobIds.add(job.id);
          markOrderSynced(job.referenceId);
        }

        setStatusMessage(
          adjustmentRecords.length > 0
            ? `تم تسجيل التسوية، وتوليد ${adjustmentRecords.length} حركة ضبط جرد. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`
            : `تم تسجيل تسوية اليوم في السيرفر. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`,
        );
        void refreshDashboardData();
        void refreshOrdersData();
        void refreshDailySettlementsData();
        return;
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 409) {
          markSettlementSynced(clientClosureId);
          removeSettlementAdjustmentOrders(createdAt);
          void refreshDailySettlementsData();
          void refreshStoresData();
          setStatusMessage(
            "طھظ… ط¥ظ„ط؛ط§ط، ط§ظ„طھط³ظˆظٹط© ط§ظ„ظ…ط­ظ„ظٹط© ظ„ط£ظ† ط§ظ„ط³ظٹط±ظپط± ظٹط­طھظˆظٹ طھط³ظˆظٹط© ظ…ط³ط¬ظ„ط© ظ„ظ‡ط°ط§ ط§ظ„ظٹظˆظ….",
          );
          return;
        }

        adjustmentJobs
          .filter((job) => !postedAdjustmentJobIds.has(job.id))
          .forEach((job) => enqueueJob(job));
        if (!postedSettlement) {
          enqueueJob(syncJob);
        }

        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ التسوية محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage('تم حفظ التسوية محلياً وسيتم رفعها تلقائياً.');
        return;
      }
    }

    enqueueJob(syncJob);
    adjustmentJobs.forEach((job) => enqueueJob(job));
    setStatusMessage(
      adjustmentRecords.length > 0
        ? `لا يوجد إنترنت: تم تخزين التسوية وتوليد ${adjustmentRecords.length} حركة ضبط محلياً. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`
        : `لا يوجد إنترنت: تم تخزين التسوية محلياً. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`,
    );
  };

  const resetExpenseForm = () => {
    setExpenseEditingId(null);
    setExpenseDateInput(toIsoDateOnly(new Date()));
    setExpenseCategoryInput(effectiveExpenseCategoryOptions[0]?.value ?? 'OTHER');
    setExpenseDescriptionInput('');
    setExpenseAmountInput('');
    setExpenseNoteInput('');
    setExpenseImageLocalUri(null);
  };

  const pickExpenseImage = async () => {
    if (isPickingExpenseImage) {
      return;
    }

    setIsPickingExpenseImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatusMessage('يجب منح صلاحية الوصول للصور لإرفاق صورة المصروف.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.75,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      setExpenseImageLocalUri(result.assets[0].uri);
      setStatusMessage('تم اختيار صورة المصروف.');
    } catch {
      setStatusMessage('تعذر اختيار الصورة حالياً.');
    } finally {
      setIsPickingExpenseImage(false);
    }
  };

  const clearExpenseImage = () => {
    setExpenseImageLocalUri(null);
    setStatusMessage('تم حذف صورة المصروف من النموذج.');
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
    setSelectedExpenseDetails(null);
    setExpenseEditingId(item.clientExpenseId);
    setExpenseDateInput(item.expenseDate);
    setExpenseCategoryInput(item.category);
    setExpenseDescriptionInput(item.description);
    setExpenseAmountInput(String(item.amount));
    setExpenseNoteInput(item.note ?? '');
    setExpenseImageLocalUri(item.localImageUri ?? item.imageUrl ?? null);
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
    const trimmedNote = expenseNoteInput.trim() || undefined;
    const imagePreviewUri = expenseImageLocalUri?.trim() || '';

    if (!expenseEditingId) {
      const clientExpenseId = makeId('exp');
      const persistedLocalImageUri =
        imagePreviewUri && !isRemoteUri(imagePreviewUri)
          ? await persistExpenseImageLocally(imagePreviewUri, clientExpenseId)
          : undefined;

      const payload: CreateExpensePayload = {
        clientExpenseId,
        storeId: effectiveStoreId,
        expenseDate: expenseDateInput,
        category: expenseCategoryValue,
        description: expenseDescriptionInput.trim(),
        amount,
        imageUrl: imagePreviewUri && isRemoteUri(imagePreviewUri) ? imagePreviewUri : undefined,
        note: trimmedNote,
        syncedAt: now,
      };

      const localRecord: LocalExpense = {
        ...payload,
        localImageUri: persistedLocalImageUri,
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
          let payloadToSend = payload;
          if (localRecord.localImageUri) {
            const uploadedImageUrl = await uploadExpenseImageToCloudinary(
              authToken,
              localRecord.localImageUri,
            );
            payloadToSend = { ...payloadToSend, imageUrl: uploadedImageUrl };
            setExpenses((previous) => {
              const next = previous.map((item) =>
                item.clientExpenseId === clientExpenseId
                  ? { ...item, imageUrl: uploadedImageUrl }
                  : item,
              );
              void saveArray(STORAGE_KEYS.expenses, next);
              return next;
            });
          }

          await postExpense(authToken, payloadToSend);
          markExpenseSynced(clientExpenseId);
          void refreshExpensesData();
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

    const existingLocalRecord = expenses.find((item) => item.clientExpenseId === expenseEditingId);
    const persistedLocalImageUri =
      imagePreviewUri && !isRemoteUri(imagePreviewUri)
        ? await persistExpenseImageLocally(imagePreviewUri, expenseEditingId)
        : undefined;

    const hasNewLocalImage = Boolean(persistedLocalImageUri);
    const updatePayload: UpdateExpensePayload = {
      expenseDate: expenseDateInput,
      category: expenseCategoryValue,
      description: expenseDescriptionInput.trim(),
      amount,
      imageUrl:
        imagePreviewUri && isRemoteUri(imagePreviewUri)
          ? imagePreviewUri
          : hasNewLocalImage
            ? undefined
            : existingLocalRecord?.imageUrl,
      note: trimmedNote,
      syncedAt: now,
    };

    setExpenses((previous) => {
      const next = previous.map((item) =>
        item.clientExpenseId === expenseEditingId
          ? {
              ...item,
              ...updatePayload,
              localImageUri: persistedLocalImageUri,
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
        let payloadToSend = updatePayload;
        if (persistedLocalImageUri) {
          const uploadedImageUrl = await uploadExpenseImageToCloudinary(
            authToken,
            persistedLocalImageUri,
          );
          payloadToSend = { ...payloadToSend, imageUrl: uploadedImageUrl };
          setExpenses((previous) => {
            const next = previous.map((item) =>
              item.clientExpenseId === expenseEditingId
                ? { ...item, imageUrl: uploadedImageUrl }
                : item,
            );
            void saveArray(STORAGE_KEYS.expenses, next);
            return next;
          });
        }

        await patchExpense(authToken, expenseEditingId, payloadToSend);
        markExpenseSynced(expenseEditingId);
        void refreshExpensesData();
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
    if (selectedExpenseDetails?.clientExpenseId === clientExpenseId) {
      setSelectedExpenseDetails(null);
    }
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
        void refreshExpensesData();
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
        void refreshProductsData();
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
    if (!isAdmin) {
      setStatusMessage('حذف المنتجات متاح للأدمن فقط.');
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const now = new Date().toISOString();
    setProducts((previous) => previous.filter((item) => item.id !== productId));
    setCart((previous) => previous.filter((item) => item.id !== productId));
    if (selectedStoreId) {
      setProductOrderByStore((previous) => ({
        ...previous,
        [selectedStoreId]: (previous[selectedStoreId] ?? []).filter((id) => id !== productId),
      }));
    }
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
        void refreshProductsData();
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

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const purchaseDate = toIsoDateOnly(nowDate);

    const localRecords: LocalPurchase[] = rowsToReceive.map((row) => {
      const payload: CreatePurchasePayload = {
        clientPurchaseId: makeId('pur'),
        storeId: effectiveStoreId,
        productName: row.name,
        quantity: row.receivedToday,
        unitCost: row.costPrice,
        totalCost: Number((row.receivedToday * row.costPrice).toFixed(2)),
        purchaseKind: 'SUPPLY',
        paymentAmount: 0,
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
      persistArrayDeferred(STORAGE_KEYS.purchases, next);
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
        purchaseKind: record.purchaseKind,
        sellPrice: record.sellPrice,
        paymentAmount: record.paymentAmount,
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
          const remotePurchase = await postPurchase(authToken, payload);
          markPurchaseSynced(record.clientPurchaseId);
          upsertRemotePurchase(remotePurchase as ApiPurchase);
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
    if (isSavingTawasi) {
      return;
    }

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

    setIsSavingTawasi(true);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const tawasiNote = tawasiNoteInput.trim();
    const payload: CreatePurchasePayload = {
      clientPurchaseId: makeId('pur'),
      storeId: effectiveStoreId,
      productName: 'تواصي',
      quantity: 1,
      unitCost: capitalAmount,
      totalCost: capitalAmount,
      purchaseKind: 'TAWASI',
      sellPrice: sellAmount,
      paymentAmount: 0,
      purchaseDate: toIsoDateOnly(nowDate),
      note: tawasiNote || undefined,
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
      persistArrayDeferred(STORAGE_KEYS.purchases, next);
      return next;
    });

    setTawasiCapitalInput('');
    setTawasiSellPriceInput('');
    setTawasiNoteInput('');

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
        const remotePurchase = await postPurchase(authToken, payload);
        markPurchaseSynced(localRecord.clientPurchaseId);
        upsertRemotePurchase(remotePurchase as ApiPurchase);
        setIsSavingTawasi(false);
        setStatusMessage('تم تسجيل التواصي على السيرفر.');
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);

        if (error instanceof ApiError && error.status === 401) {
          setIsSavingTawasi(false);
          logout('انتهت الجلسة وتم حفظ التواصي محلياً لحين تسجيل الدخول.');
          return;
        }

        setIsSavingTawasi(false);
        setStatusMessage('تم حفظ التواصي محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    setIsSavingTawasi(false);
    setStatusMessage('لا يوجد إنترنت: تم تخزين التواصي محلياً.');
  };

  const registerSupplyPayment = async () => {
    if (isSavingSupplyPayment) {
      return;
    }

    if (!session) {
      setStatusMessage('سجّل الدخول أولاً.');
      return;
    }

    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: تسجيل دفعات التوريدات غير متاح.');
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? '' : selectedStoreId;
    if (!effectiveStoreId) {
      setStatusMessage('اختر المحل أولاً.');
      return;
    }

    const paymentAmount = parseNumberInput(supplyPaymentAmountInput);
    if (paymentAmount <= 0) {
      setStatusMessage('أدخل قيمة دفعة صحيحة.');
      return;
    }

    setIsSavingSupplyPayment(true);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const payload: CreatePurchasePayload = {
      clientPurchaseId: makeId('pay'),
      storeId: effectiveStoreId,
      productName: 'دفعة فاتورة التوريدات',
      quantity: 0,
      unitCost: 0,
      totalCost: 0,
      purchaseKind: 'PAYMENT',
      paymentAmount,
      purchaseDate: toIsoDateOnly(nowDate),
      note: supplyPaymentNoteInput.trim() || undefined,
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
      persistArrayDeferred(STORAGE_KEYS.purchases, next);
      return next;
    });
    setSupplyPaymentAmountInput('');
    setSupplyPaymentNoteInput('');

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
        const remotePurchase = await postPurchase(authToken, payload);
        markPurchaseSynced(localRecord.clientPurchaseId);
        upsertRemotePurchase(remotePurchase as ApiPurchase);
        setIsSavingSupplyPayment(false);
        setStatusMessage('تم تسجيل دفعة فاتورة التوريدات من دون احتسابها في التسوية.');
        return;
      } catch (error: unknown) {
        enqueueJob(syncJob);
        if (error instanceof ApiError && error.status === 401) {
          setIsSavingSupplyPayment(false);
          logout('انتهت الجلسة وتم حفظ الدفعة محلياً.');
          return;
        }
        setIsSavingSupplyPayment(false);
        setStatusMessage('تم حفظ الدفعة محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    setIsSavingSupplyPayment(false);
    setStatusMessage('لا يوجد إنترنت: تم تخزين الدفعة محلياً.');
  };

  const deletePurchaseRecord = async (clientPurchaseId: string) => {
    if (!canManageInventory) {
      setStatusMessage('وضع القراءة فقط: حذف المشتريات متاح للكاشير أو الأدمن فقط.');
      return;
    }

    if (pendingPurchaseDeleteIds[clientPurchaseId]) {
      return;
    }

    setPendingPurchaseDeleteIds((previous) => ({
      ...previous,
      [clientPurchaseId]: true,
    }));
    const finishDelete = () => {
      setPendingPurchaseDeleteIds((previous) => {
        const { [clientPurchaseId]: _, ...next } = previous;
        return next;
      });
    };

    const now = new Date().toISOString();
    setPurchases((previous) => {
      const next = previous.filter((item) => item.clientPurchaseId !== clientPurchaseId);
      persistArrayDeferred(STORAGE_KEYS.purchases, next);
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
        removeRemotePurchase(clientPurchaseId);
        finishDelete();
        setStatusMessage('تم حذف التوريد من السيرفر.');
        return;
      } catch {
        enqueueJob(syncJob);
        finishDelete();
        setStatusMessage('تم حذف التوريد محلياً بانتظار المزامنة.');
        return;
      }
    }

    enqueueJob(syncJob);
    finishDelete();
    setStatusMessage('تم حذف التوريد محلياً بانتظار المزامنة.');
  };

  const resetEmployeeForm = () => {
    setEmployeeEditingId(null);
    setEmployeeNameInput("");
    setEmployeeWeeklySalaryInput("");
  };

  const beginEmployeeEdit = (employeeId: string) => {
    if (!canManageInventory) {
      setStatusMessage("وضع القراءة فقط: تعديل الموظفين متاح للكاشير أو الأدمن فقط.");
      return;
    }

    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      setStatusMessage("تعذر إيجاد الموظف المطلوب تعديله.");
      return;
    }

    setEmployeeEditingId(employee.id);
    setEmployeeNameInput(employee.name);
    setEmployeeWeeklySalaryInput(String(employee.weeklySalary));
    setStatusMessage(`تعديل راتب ${employee.name}.`);
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

    const isEditing = Boolean(employeeEditingId);
    const existingEmployee = isEditing
      ? employees.find((item) => item.id === employeeEditingId)
      : null;
    if (isEditing && !existingEmployee) {
      setStatusMessage("تعذر إيجاد الموظف المطلوب تعديله.");
      return;
    }

    const exists = employees.some(
      (item) =>
        item.storeId === effectiveStoreId &&
        item.id !== employeeEditingId &&
        normalizeProductKey(item.name) === normalizeProductKey(name) &&
        item.isActive,
    );
    if (exists) {
      setStatusMessage('الموظف موجود مسبقاً في هذا الفرع.');
      return;
    }

    const now = new Date().toISOString();
    const employeeId = existingEmployee?.id ?? makeId('emp');
    const employee: Employee = {
      id: employeeId,
      storeId: effectiveStoreId,
      name,
      weeklySalary,
      isActive: existingEmployee?.isActive ?? true,
      createdAt: existingEmployee?.createdAt ?? now,
      updatedAt: now,
      synced: false,
    };

    setEmployees((previous) => {
      const next = isEditing
        ? previous.map((item) => (item.id === employee.id ? employee : item))
        : [...previous, employee];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });

    const createPayload: CreateEmployeePayload = {
      clientEmployeeId: employee.id,
      storeId: employee.storeId,
      name: employee.name,
      weeklySalary: employee.weeklySalary,
      isActive: employee.isActive,
      syncedAt: now,
    };
    const updatePayload: UpdateEmployeePayload = {
      name: employee.name,
      weeklySalary: employee.weeklySalary,
      isActive: employee.isActive,
      syncedAt: now,
    };

    const syncJob: SyncJob = isEditing
      ? {
          id: makeId('job'),
          referenceId: employee.id,
          retries: 0,
          createdAt: now,
          entity: 'EMPLOYEE',
          action: 'UPDATE',
          payload: updatePayload,
        }
      : {
          id: makeId('job'),
          referenceId: employee.id,
          retries: 0,
          createdAt: now,
          entity: 'EMPLOYEE',
          action: 'CREATE',
          payload: createPayload,
        };

    enqueueJob(syncJob);
    resetEmployeeForm();
    if (!isEditing) {
      setAbsenceEmployeeIdInput((previous) => previous || employee.id);
      setWithdrawalEmployeeIdInput((previous) => previous || employee.id);
    }
    setStatusMessage(
      isEditing
        ? `تم تعديل راتب الموظف ${name}.`
        : `تمت إضافة الموظف ${name}.`,
    );
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

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(absenceDateInput) ||
      toIsoDateOnly(dateFromIsoOnly(absenceDateInput)) !== absenceDateInput
    ) {
      setStatusMessage('أدخل تاريخ غياب صحيح بصيغة YYYY-MM-DD.');
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
      synced: false,
    };

    setEmployeeAbsences((previous) => [nextEntry, ...previous]);
    enqueueJob({
      id: makeId('job'),
      referenceId: nextEntry.id,
      retries: 0,
      createdAt: now,
      entity: 'EMPLOYEE_ABSENCE',
      action: 'CREATE',
      payload: {
        clientAbsenceId: nextEntry.id,
        employeeClientId: nextEntry.employeeId,
        storeId: nextEntry.storeId,
        absenceDate: nextEntry.absenceDate,
        note: nextEntry.note,
        syncedAt: now,
      },
    });
    setAbsenceNoteInput('');
    setStatusMessage(
      absenceDateInput >= weekStartDate && absenceDateInput <= weekEndDate
        ? 'تم تسجيل الغياب وتحديث المستحق.'
        : `تم تسجيل الغياب، لكنه خارج أسبوع الحساب ${weekStartDate} إلى ${weekEndDate}.`,
    );
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

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(withdrawalDateInput) ||
      toIsoDateOnly(dateFromIsoOnly(withdrawalDateInput)) !==
        withdrawalDateInput
    ) {
      setStatusMessage('أدخل تاريخ سحبة صحيح بصيغة YYYY-MM-DD.');
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
      synced: false,
    };

    setEmployeeWithdrawals((previous) => [nextEntry, ...previous]);
    enqueueJob({
      id: makeId('job'),
      referenceId: nextEntry.id,
      retries: 0,
      createdAt: now,
      entity: 'EMPLOYEE_WITHDRAWAL',
      action: 'CREATE',
      payload: {
        clientWithdrawalId: nextEntry.id,
        employeeClientId: nextEntry.employeeId,
        storeId: nextEntry.storeId,
        amount: nextEntry.amount,
        withdrawalDate: nextEntry.withdrawalDate,
        note: nextEntry.note,
        syncedAt: now,
      },
    });
    setWithdrawalAmountInput('');
    setWithdrawalNoteInput('');
    setStatusMessage(
      withdrawalDateInput >= weekStartDate &&
        withdrawalDateInput <= weekEndDate
        ? 'تم تسجيل السحبة وتحديث المستحق النهائي.'
        : `تم تسجيل السحبة، لكنها خارج أسبوع الحساب ${weekStartDate} إلى ${weekEndDate}.`,
    );
  };

  const removeEmployeeAbsence = (entryId: string) => {
    if (!canManageInventory) {
      return;
    }

    const entry = employeeAbsences.find((item) => item.id === entryId);
    setEmployeeAbsences((previous) => previous.filter((item) => item.id !== entryId));
    if (entry) {
      enqueueJob({
        id: makeId('job'),
        referenceId: entryId,
        retries: 0,
        createdAt: new Date().toISOString(),
        entity: 'EMPLOYEE_ABSENCE',
        action: 'DELETE',
        payload: { clientAbsenceId: entryId },
      });
    }
    setStatusMessage('تم حذف قيد الغياب.');
  };

  const removeEmployeeWithdrawal = (entryId: string) => {
    if (!canManageInventory) {
      return;
    }

    const entry = employeeWithdrawals.find((item) => item.id === entryId);
    setEmployeeWithdrawals((previous) => previous.filter((item) => item.id !== entryId));
    if (entry) {
      enqueueJob({
        id: makeId('job'),
        referenceId: entryId,
        retries: 0,
        createdAt: new Date().toISOString(),
        entity: 'EMPLOYEE_WITHDRAWAL',
        action: 'DELETE',
        payload: { clientWithdrawalId: entryId },
      });
    }
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

  const updateInventoryDestructionInput = (
    productId: string,
    value: string,
  ) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }

    setInventoryDestructionInputs((previous) => ({
      ...previous,
      [productId]: normalized,
    }));
  };

  const updateInventoryDestructionNoteInput = (
    productId: string,
    value: string,
  ) => {
    setInventoryDestructionNoteInputs((previous) => ({
      ...previous,
      [productId]: value,
    }));
  };

  const updateInventoryDestructionQuantityInput = (value: string) => {
    const normalized = normalizeNumericInputText(value);
    if (normalized && !/^\d*\.?\d*$/.test(normalized)) {
      return;
    }

    setInventoryDestructionQuantityInput(normalized);
  };

  const recordInventoryDestruction = async () => {
    if (!canManageInventory || !session) {
      return;
    }

    const productId = selectedInventoryDestructionProductId;
    if (!productId) {
      setStatusMessage("ط§ط®طھط± ط§ظ„ظ…ظ†طھط¬ ط§ظ„ظ…ط±ط§ط¯ ط¥طھظ„ط§ظپظ‡ ط£ظˆظ„ط§ظ‹.");
      return;
    }

    const rawValue = inventoryDestructionQuantityInput.trim();
    if (!rawValue || !/^\d+(?:\.\d+)?$/.test(rawValue)) {
      setStatusMessage("أدخل كمية إتلاف صحيحة أولاً.");
      return;
    }

    const effectiveStoreId = isCashier ? assignedStoreId ?? "" : selectedStoreId;
    const product = products.find(
      (item) => item.clientProductId === productId || item.id === productId,
    );
    const stockRow = productSupplyRows.find(
      (item) => item.productId === productId,
    );
    if (!effectiveStoreId || !product || !stockRow) {
      setStatusMessage("تعذر تحديد المنتج أو الفرع لتسجيل الإتلاف.");
      return;
    }

    const quantity = Number(parseNumberInput(rawValue).toFixed(3));
    if (quantity <= 0) {
      setStatusMessage("كمية الإتلاف يجب أن تكون أكبر من صفر.");
      return;
    }
    if (quantity > stockRow.remainingQty) {
      setStatusMessage(
        `كمية الإتلاف أكبر من الرصيد المتاح (${formatQuantity(Math.max(stockRow.remainingQty, 0))}).`,
      );
      return;
    }

    const note = inventoryDestructionNoteInput.trim();
    const now = new Date().toISOString();
    const clientDestructionId = makeId("destroy");
    const payload: CreateInventoryDestructionPayload = {
      clientDestructionId,
      storeId: effectiveStoreId,
      productClientId: product.clientProductId,
      quantity,
      note: note || undefined,
      destroyedAt: now,
      syncedAt: now,
    };
    const localDestruction: LocalInventoryDestruction = {
      ...payload,
      synced: false,
      createdLocallyAt: now,
    };
    const syncJob: SyncJob = {
      id: makeId("job"),
      referenceId: clientDestructionId,
      retries: 0,
      createdAt: now,
      entity: "INVENTORY_DESTRUCTION",
      action: "CREATE",
      payload,
    };

    setSelectedInventoryDestructionProductId("");
    setInventoryDestructionQuantityInput("");
    setInventoryDestructionNoteInput("");
    setInventoryDestructions((previous) => {
      const next = [localDestruction, ...previous];
      void saveArray(STORAGE_KEYS.inventoryDestructions, next);
      return next;
    });

    if (!isOnline || !authToken) {
      enqueueJob(syncJob);
      setStatusMessage(
        `تم تسجيل إتلاف ${formatQuantity(quantity)} من ${product.name} محلياً وسيتم رفعه عند عودة الاتصال.`,
      );
      return;
    }

    try {
      const destruction = await postInventoryDestruction(authToken, payload);
      upsertRemoteInventoryDestruction(destruction);
      markInventoryDestructionSynced(clientDestructionId);
      setQueue((previous) => {
        const next = previous.filter(
          (job) =>
            !(
              (job.entity ?? job.type) === "INVENTORY_DESTRUCTION" &&
              job.referenceId === clientDestructionId
            ),
        );
        if (next.length !== previous.length) {
          persistSyncQueue(next);
        }
        return next;
      });
      setStatusMessage(
        `تم تسجيل إتلاف ${formatQuantity(quantity)} من ${product.name}. لا يؤثر الإتلاف على نتيجة التسوية.`,
      );
    } catch (error: unknown) {
      enqueueJob(syncJob);
      if (error instanceof ApiError && error.status === 401) {
        logout("انتهت الجلسة وتم حفظ الإتلاف محلياً.");
        return;
      }
      setStatusMessage(
        `تم حفظ إتلاف ${product.name} محلياً وسيتم رفعه تلقائياً.`,
      );
    }
  };

  const commitInventoryAdjustment = async (productId: string) => {
    if (!isAdmin || !session) {
      return;
    }

    const rawValue = settlementActualInputs[productId]?.trim() ?? "";
    if (!rawValue) {
      return;
    }
    if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
      setStatusMessage("أدخل كمية مخزون صحيحة قبل مغادرة الخانة.");
      return;
    }

    const effectiveStoreId = selectedStoreId;
    const product = products.find(
      (item) => item.clientProductId === productId || item.id === productId,
    );
    const stockRow = productSupplyRows.find(
      (item) => item.productId === productId,
    );
    if (!effectiveStoreId || !product || !stockRow) {
      setStatusMessage("تعذر تحديد المنتج أو الفرع لضبط المخزون.");
      return;
    }

    const actualQuantity = Number(parseNumberInput(rawValue).toFixed(3));
    if (actualQuantity < 0) {
      setStatusMessage("كمية المخزون الفعلية يجب أن تكون صفراً أو أكبر.");
      return;
    }

    setSettlementActualInputs((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });
    setInventoryDestructionInputs((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });
    setInventoryDestructionNoteInputs((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });

    if (actualQuantity === stockRow.remainingQty) {
      setStatusMessage(`مخزون ${product.name} مطابق ولا يحتاج إلى ضبط.`);
      return;
    }

    const now = new Date().toISOString();
    const clientAdjustmentId = makeId("stock");
    const payload: CreateInventoryAdjustmentPayload = {
      clientAdjustmentId,
      storeId: effectiveStoreId,
      productClientId: product.clientProductId,
      actualQuantity,
      adjustedAt: now,
      syncedAt: now,
    };
    const localAdjustment: LocalInventoryAdjustment = {
      ...payload,
      synced: false,
      createdLocallyAt: now,
    };
    const queueReference = `${effectiveStoreId}:${product.clientProductId}`;
    const syncJob: SyncJob = {
      id: makeId("job"),
      referenceId: queueReference,
      retries: 0,
      createdAt: now,
      entity: "INVENTORY_ADJUSTMENT",
      action: "CREATE",
      payload,
    };

    setInventoryAdjustments((previous) => {
      const withoutOlderPending = previous.filter(
        (item) =>
          !(
            item.storeId === effectiveStoreId &&
            item.productClientId === product.clientProductId &&
            !item.synced
          ),
      );
      const next = [localAdjustment, ...withoutOlderPending];
      void saveArray(STORAGE_KEYS.inventoryAdjustments, next);
      return next;
    });
    setStatusMessage(
      `تم اعتماد مخزون ${product.name}: ${formatQuantity(actualQuantity)}.`,
    );

    if (!isOnline || !authToken) {
      enqueueJob(syncJob);
      setStatusMessage(
        `تم ضبط مخزون ${product.name} محلياً وسيتم رفعه عند عودة الاتصال.`,
      );
      return;
    }

    try {
      const adjustment = await postInventoryAdjustment(authToken, payload);
      upsertRemoteInventoryAdjustment(adjustment);
      markInventoryAdjustmentSynced(clientAdjustmentId);
      setQueue((previous) => {
        const next = previous.filter(
          (job) =>
            !(
              (job.entity ?? job.type) === "INVENTORY_ADJUSTMENT" &&
              job.referenceId === queueReference
            ),
        );
        if (next.length !== previous.length) {
          persistSyncQueue(next);
        }
        return next;
      });
      setStatusMessage(
        `تم ضبط مخزون ${product.name} إلى ${formatQuantity(actualQuantity)} ومزامنته.`,
      );
    } catch (error: unknown) {
      enqueueJob(syncJob);
      if (error instanceof ApiError && error.status === 401) {
        logout("انتهت الجلسة وتم حفظ ضبط المخزون محلياً.");
        return;
      }
      setStatusMessage(
        `تم ضبط مخزون ${product.name} محلياً وسيتم رفعه تلقائياً.`,
      );
    }
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
      ['التاريخ', 'النوع', 'المنتج', 'الكمية', 'تكلفة الوحدة', 'سعر المبيع', 'الإجمالي', 'قيمة الدفعة', 'الملاحظة', 'الحالة'],
      filteredPurchaseRows.map((item) => [
        item.purchaseDate,
        item.purchaseKind,
        item.productName,
        item.quantity,
        item.unitCost,
        item.sellPrice,
        item.totalCost,
        item.paymentAmount,
        item.note ?? '',
        item.synced ? 'متزامن' : 'معلق',
      ]),
    );
    await exportCsv(csv, `${EXPORT_FILE_PREFIX}-purchases-${formatDateOnly(new Date().toISOString())}.csv`);
    setStatusMessage('تم تصدير المشتريات.');
  };

  const exportPurchaseInvoicePdf = async () => {
    if (
      purchaseInvoiceRows.length === 0 &&
      purchaseInvoicePaymentRows.length === 0
    ) {
      setStatusMessage("لا توجد توريدات أو دفعات مسجلة لهذا التاريخ لإنشاء فاتورة.");
      return;
    }

    const generatedAt = toShortDate(new Date().toISOString());
    const buildSupplyRowHtml = (
      row: TodayPurchaseInvoiceRow,
      index: number,
    ) => `
          <tr>
            <td>${index + 1}</td>
            <td>${row.purchaseKind === "TAWASI" ? "تواصي" : "توريد"}</td>
            <td>${escapeHtml(row.productName)}</td>
            <td>${escapeHtml(formatQuantity(row.quantity))}</td>
            <td>${row.purchaseKind === "SUPPLY" ? escapeHtml(formatMoney(row.unitCost)) : "-"}</td>
            <td>${row.purchaseKind === "TAWASI" ? escapeHtml(formatMoney(row.totalCost)) : "-"}</td>
            <td>${row.purchaseKind === "TAWASI" ? escapeHtml(formatMoney(row.sellPrice)) : "-"}</td>
            <td>${escapeHtml(formatMoney(row.totalCost))}</td>
            <td>-</td>
            <td>${escapeHtml(row.notes.join(" | ") || "-")}</td>
            <td>${row.synced ? "متزامن" : `معلق (${row.pendingCount})`}</td>
          </tr>
        `;
    const productRowsHtml = purchaseInvoiceProductRows
      .map((row, index) => buildSupplyRowHtml(row, index))
      .join("");
    const tawasiRowsHtml = purchaseInvoiceTawasiRows
      .map((row, index) =>
        buildSupplyRowHtml(row, purchaseInvoiceProductRows.length + index),
      )
      .join("");
    const paymentRowsHtml = purchaseInvoicePaymentRows
      .map(
        (row, index) => `
          <tr>
            <td>${purchaseInvoiceRows.length + index + 1}</td>
            <td>دفعة</td>
            <td>دفعة فاتورة التوريدات</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>${escapeHtml(formatMoney(row.amount))}</td>
            <td>${escapeHtml(row.note ?? "-")}</td>
            <td>${row.synced ? "متزامن" : "معلق"}</td>
          </tr>
        `,
      )
      .join("");
    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              direction: rtl;
              font-family: Arial, Tahoma, sans-serif;
              color: #3f1d32;
              margin: 18px;
            }
            @page { size: A4 landscape; margin: 12mm; }
            h1 {
              margin: 0 0 10px;
              font-size: 24px;
              color: #9d174d;
            }
            .meta {
              margin: 4px 0;
              font-size: 13px;
              color: #6f425f;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 18px;
              font-size: 10px;
            }
            th,
            td {
              border: 1px solid #efcadb;
              padding: 6px;
              text-align: right;
              vertical-align: top;
            }
            th {
              background: #f8e8ee;
              color: #831843;
            }
            .group-row td {
              background: #fdf4f7;
              color: #831843;
              font-size: 12px;
              font-weight: 700;
              padding: 8px;
            }
            .summary {
              display: flex;
              gap: 12px;
              margin-top: 16px;
            }
            .total {
              flex: 1;
              border: 1px solid #efcadb;
              background: #fdf4f7;
              padding: 10px;
              font-size: 13px;
              font-weight: 700;
              color: #9d174d;
            }
            tr {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(activePurchaseInvoiceTitle)}</h1>
          <div class="meta">المحل: ${escapeHtml(selectedStore?.name ?? "-")}</div>
          <div class="meta">التاريخ: ${escapeHtml(activePurchaseInvoiceDate)}</div>
          <div class="meta">وقت الإنشاء: ${escapeHtml(generatedAt)}</div>
          ${
            activePurchaseInvoiceNote
              ? `<div class="meta">ملاحظة الفاتورة: ${escapeHtml(activePurchaseInvoiceNote)}</div>`
              : ""
          }
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>النوع</th>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>تكلفة الوحدة</th>
                <th>رأس المال</th>
                <th>سعر مبيع التواصي</th>
                <th>إجمالي التوريد</th>
                <th>الدفعة</th>
                <th>الملاحظة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr class="group-row"><td colspan="11">المنتجات</td></tr>
              ${productRowsHtml || '<tr><td colspan="11">لا توجد منتجات موردة.</td></tr>'}
              ${tawasiRowsHtml ? `<tr class="group-row"><td colspan="11">التواصي</td></tr>${tawasiRowsHtml}` : ""}
              ${paymentRowsHtml ? `<tr class="group-row"><td colspan="11">الدفعات</td></tr>${paymentRowsHtml}` : ""}
            </tbody>
          </table>
          <div class="summary">
            <div class="total">إجمالي التوريدات: ${escapeHtml(formatMoney(purchaseInvoiceTotal))}</div>
            <div class="total">إجمالي الدفعات: ${escapeHtml(formatMoney(purchaseInvoicePaymentsTotal))}</div>
            <div class="total">الرصيد المتبقي: ${escapeHtml(formatMoney(purchaseInvoiceBalance))}</div>
          </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank", "width=1280,height=900");
        if (!printWindow) {
          setStatusMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
          return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 300);
        setStatusMessage("تم فتح فاتورة الجدول للطباعة أو الحفظ PDF.");
        return;
      }

      const pdf = await Print.printToFileAsync({ html });
      if (!pdf?.uri) {
        setStatusMessage("تم فتح نافذة الطباعة لفاتورة التوريدات.");
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setStatusMessage("تم إنشاء ملف PDF، لكن المشاركة غير متاحة على هذا الجهاز.");
        return;
      }

      await Sharing.shareAsync(pdf.uri, {
        mimeType: "application/pdf",
        dialogTitle: activePurchaseInvoiceTitle,
        UTI: "com.adobe.pdf",
      });
      setStatusMessage("تم إنشاء ومشاركة فاتورة التوريدات PDF.");
    } catch (error: unknown) {
      setStatusMessage("تعذر إنشاء ملف PDF لفاتورة التوريدات.");
    }
  };

  const appScreenContext = {
    Animated,
    BRAND_CATEGORY,
    BRAND_FULL,
    BRAND_NAME,
    Date,
    DateTimePicker,
    DraggableGrid,
    Image,
    MISC_CART_ITEM_ID,
    MISC_CART_ITEM_NAME,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    absenceDateInput,
    absenceEmployeeIdInput,
    absenceNoteInput,
    activateAmountMode,
    activateMultiply,
    activePosProductKey,
    activeScreen,
    activeScreenLabel,
    actualRemainingInput,
    addEmployeeAbsence,
    addEmployeeDefinition,
    addEmployeeWithdrawal,
    addExpenseCategoryOption,
    addMiscAmountToCart,
    addProductToCart,
    addTawasiSupplyFromPad,
    adminCashboxWithdrawalAmountInput,
    adminCashboxWithdrawalNoteInput,
    adminDatePickerTarget,
    adminDatePickerValue,
    adminDashboardAllStoresKey: ADMIN_DASHBOARD_ALL_STORES,
    adminDashboardStoreId,
    adminFromDateInput,
    adminToDateInput,
    applyDiscountFromPad,
    assignedStoreId,
    auditNetSalesAmount,
    backspacePad,
    beginExpenseEdit,
    beginEmployeeEdit,
    beginProductEdit,
    canManageExpenses,
    canManageInventory,
    canSwitchStore,
    cancelCurrentOrder,
    carryInAmount,
    cart,
    cashBoxInput,
    clearAdminDateFilters,
    clearExpenseImage,
    clearPad,
    clearPurchaseDateFilters,
    commitInventoryAdjustment,
    closeAdminDatePicker,
    closePurchaseDatePicker,
    closeMobileNav,
    closeTodayPurchasesInvoice,
    confirmAdminDatePicker,
    confirmPurchaseDatePicker,
    dashboardSummaries: visibleDashboardSummaries,
    decreaseProductInCart,
    deleteExpenseRecord,
    deleteProductDefinition,
    deletePurchaseRecord,
    discountInput,
    effectiveDashboardTotals,
    effectiveExpenseCategoryOptions,
    employeeNameInput,
    employeeEditingId,
    employeeWeeklySalaryInput,
    employeeWeeklySnapshots,
    expenseAmountInput,
    expenseCategoryInput,
    expenseDateInput,
    expenseDescriptionInput,
    expenseEditingId,
    expenseFilterCategory,
    expenseFilterFrom,
    expenseFilterText,
    expenseFilterTo,
    expenseImageLocalUri,
    expenseNoteInput,
    expenses,
    exportExpensesData,
    exportPurchaseInvoicePdf,
    exportPurchasesData,
    filteredExpenseRows,
    filteredPurchaseRows,
    formatMoney,
    formatQuantity,
    handlePosProductDragEnd,
    isAdmin,
    isDesktop,
    isLoggingIn,
    isMobileNavOpen,
    isMobileNavVisible,
    isOnline,
    isPickingExpenseImage,
    isPosProductReordering,
    isPosSplit,
    isProductFormOpen,
    isRefundMode,
    isRefreshingActiveScreen,
    isSavingSupplyPayment,
    isSavingTawasi,
    isSubmittingOrder,
    isTodayPurchasesInvoiceOpen,
    isSyncing,
    loginUser,
    logout,
    mergedOrderRows,
    mergedSettlementRows,
    settlementArchiveRows,
    mobileNavBackdropOpacity,
    mobileNavDrawerWidth,
    mobileNavItems,
    mobileNavTranslateX,
    navItems,
    newExpenseCategoryLabelInput,
    newProductCostPriceInput,
    newProductNameInput,
    newProductSellPriceInput,
    newProductUnitType,
    onAdminDatePickerChange,
    onPurchaseDatePickerChange,
    openAdminDatePicker,
    openExpenseDetails,
    openProductCreateForm,
    openPurchaseDatePicker,
    openSelectedPurchasesInvoice,
    openSettlementDetails,
    openTodayPurchasesInvoice,
    orders,
    padAmountPreview,
    passwordInput,
    pendingPurchaseDeleteIds,
    pendingMultiplier,
    pickExpenseImage,
    pieceStockAuditRows,
    posPadInput,
    posProductColumns,
    posProductGridData,
    posProductItemHeight,
    posProducts,
    productEditingId,
    productSalesSummaryRows,
    productSupplyRows,
    purchaseFilterFrom,
    purchaseFilterProduct,
    purchaseFilterTo,
    purchaseDatePickerTarget,
    purchaseDatePickerValue,
    purchaseHistorySummaryRows,
    purchaseInvoiceDateInput,
    purchaseInvoiceNoteInput,
    purchaseInvoiceTitle: activePurchaseInvoiceTitle,
    purchases,
    pushPadToken,
    queue,
    receiveTodaySupplies,
    recentAbsenceRows,
    recentWithdrawalRows,
    refreshDailySettlementsData,
    refreshDashboardData,
    refreshEmployeesData,
    refreshExpensesData,
    refreshInventoryData,
    refreshOrdersData,
    refreshProductsData,
    refreshPurchasesData,
    refreshActiveScreenData,
    refreshSettlementData,
    recordInventoryDestruction,
    registerTawasiSupply,
    registerSupplyPayment,
    removeEmployeeAbsence,
    removeEmployeeWithdrawal,
    resetExpenseForm,
    resetEmployeeForm,
    resetProductForm,
    roundPadValue,
    saveExpense,
    saveProductDefinition,
    selectedAdminCashboxRemainingAmount,
    selectedExpenseDetails,
    selectedInventoryDestructionProductId,
    selectedOrderInvoice,
    selectedSettlementDetail,
    selectedStore,
    selectedStoreEmployees,
    selectedStoreId,
    session,
    setAbsenceDateInput,
    setAbsenceEmployeeIdInput,
    setAbsenceNoteInput,
    setActivePosProductKey,
    setActiveScreen,
    setActualRemainingInput,
    setAdminCashboxWithdrawalNoteInput,
    setAdminDashboardStoreId,
    setDiscountInput,
    setEmployeeNameInput,
    setEmployeeWeeklySalaryInput,
    setExpenseAmountInput,
    setExpenseCategoryInput,
    setExpenseDateInput,
    setExpenseDescriptionInput,
    setExpenseFilterCategory,
    setExpenseFilterFrom,
    setExpenseFilterText,
    setExpenseFilterTo,
    setExpenseNoteInput,
    setIsPosProductReordering,
    setIsRefundMode,
    setNewExpenseCategoryLabelInput,
    setNewProductCostPriceInput,
    setNewProductNameInput,
    setNewProductSellPriceInput,
    setNewProductUnitType,
    setPasswordInput,
    setPurchaseFilterFrom,
    setPurchaseFilterProduct,
    setPurchaseFilterTo,
    setPurchaseInvoiceDateInput,
    setSelectedExpenseDetails,
    setSelectedInventoryDestructionProductId,
    setSelectedOrderInvoice,
    setSelectedSettlementDetail,
    setSelectedStoreId,
    setInventoryDestructionNoteInput,
    setSettlementNoteInput,
    setStatusMessage,
    setTawasiCapitalInput,
    setTawasiNoteInput,
    setTawasiSellPriceInput,
    setSupplyPaymentAmountInput,
    setSupplyPaymentNoteInput,
    setUsernameInput,
    setWithdrawalAmountInput,
    setWithdrawalDateInput,
    setWithdrawalEmployeeIdInput,
    setWithdrawalNoteInput,
    settlementActualInputs,
    inventoryDestructionQuantityInput,
    inventoryDestructionNoteInput,
    inventoryDestructionInputs,
    inventoryDestructionNoteInputs,
    settlementCarryForwardAmount,
    settlementCycleStartIso,
    settlementDifferenceAmount,
    settlementExpectedRevenueAmount,
    settlementInventoryDestructionRows,
    settlementNetSalesWithAudit,
    settlementNoteInput,
    settlementOverDistributedAmount,
    settlementProductSalesSummaryRows,
    settlementRefundTotalWithAudit,
    settlementSalesTotalWithAudit,
    sharesInput,
    showPageSwitchControls,
    statusMessage,
    stores,
    styles,
    submitAdminCashboxWithdrawal,
    submitDailySettlement,
    submitOrder,
    subtotal,
    tawasiCapitalInput,
    tawasiNoteInput,
    tawasiSellPriceInput,
    supplyPaymentAmountInput,
    supplyPaymentNoteInput,
    toExpenseCategoryLabel,
    toOrderStatusLabel,
    toPaymentMethodLabel,
    toShortDate,
    todayEmployeeWithdrawalsTotal,
    todayDate,
    todayExpectedRemaining,
    todayExpensesTotal,
    todayNetSales,
    activePurchaseInvoiceDate,
    purchaseInvoiceRows,
    purchaseInvoiceTotal,
    purchaseInvoiceProductRows,
    purchaseInvoiceTawasiRows,
    purchaseInvoicePaymentRows,
    purchaseInvoicePaymentsTotal,
    purchaseInvoiceBalance,
    todayPurchasesTotal,
    todayRefundTotal,
    todaySalesTotal,
    todaySupplyInputs,
    toggleMobileNav,
    total,
    updateAdminCashboxWithdrawalAmountInput,
    updateCashBoxInput,
    updateInventoryDestructionInput,
    updateInventoryDestructionNoteInput,
    updateInventoryDestructionQuantityInput,
    updateSettlementActualInput,
    updateSharesInput,
    updatePurchaseInvoiceNoteInput,
    updateTodaySupplyInput,
    usernameInput,
    weekEndDate,
    weekStartDate,
    withdrawalAmountInput,
    withdrawalDateInput,
    withdrawalEmployeeIdInput,
    withdrawalNoteInput,
  };

  const appShellContext = useMemo(
    () => ({
      BRAND_CATEGORY,
      BRAND_FULL,
      BRAND_NAME,
      Pressable,
      activeScreen,
      activeScreenLabel,
      assignedStoreId,
      canSwitchStore,
      formatMoney,
      isAdmin,
      isDesktop,
      isMobileNavOpen,
      isOnline,
      lastTwoCompletedSalesOrders,
      logout,
      navItems,
      selectedStoreId,
      session,
      setActiveScreen,
      setSelectedStoreId,
      showPageSwitchControls,
      stores,
      toggleMobileNav,
    }),
    [
      activeScreen,
      activeScreenLabel,
      assignedStoreId,
      canSwitchStore,
      isAdmin,
      isDesktop,
      isMobileNavOpen,
      isOnline,
      lastTwoCompletedSalesOrders,
      logout,
      navItems,
      selectedStoreId,
      session,
      showPageSwitchControls,
      stores,
      toggleMobileNav,
    ],
  );

  return {
    appScreenContext,
    appShellContext,
    isBootstrapping,
    session,
    playTapSound,
    isDesktop,
    isPortraitMobile,
    swipePanResponder,
    isPosProductReordering,
    isRefreshingActiveScreen,
    refreshActiveScreenData,
  };
}
