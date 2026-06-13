import { useAudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
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
  Image,
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
  postEmployee,
  postEmployeeAbsence,
  postEmployeeWithdrawal,
  postExpense,
  postOrder,
  postProduct,
  postPurchase,
  deleteProduct,
} from "../services/api";
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
  CreateEmployeeAbsencePayload,
  CreateEmployeePayload,
  CreateEmployeeWithdrawalPayload,
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
} from "../types";
import { exportCsv, toCsv } from "../utils/csv";
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

const SYNC_RETRY_DELAY_MS = 60000;

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
  const isSyncingRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState("جاهز للعمل.");

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [dailySettlements, setDailySettlements] = useState<
    LocalDailySettlement[]
  >([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [purchases, setPurchases] = useState<LocalPurchase[]>([]);
  const [queue, setQueue] = useState<SyncJob[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [posPadInput, setPosPadInput] = useState("");
  const [pendingMultiplier, setPendingMultiplier] = useState<number | null>(
    null,
  );
  const [pendingAmountValue, setPendingAmountValue] = useState<number | null>(
    null,
  );
  const [posCashCarryAmount, setPosCashCarryAmount] = useState(0);
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
  const [selectedOrderInvoice, setSelectedOrderInvoice] =
    useState<OrderHistoryRow | null>(null);
  const [selectedSettlementDetail, setSelectedSettlementDetail] =
    useState<SettlementDayDetail | null>(null);
  const [selectedExpenseDetails, setSelectedExpenseDetails] =
    useState<ExpenseRow | null>(null);

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
  const [tawasiCapitalInput, setTawasiCapitalInput] = useState("");
  const [tawasiSellPriceInput, setTawasiSellPriceInput] = useState("");
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
  const [adminFromDateInput, setAdminFromDateInput] = useState("");
  const [adminToDateInput, setAdminToDateInput] = useState("");
  const [adminDatePickerTarget, setAdminDatePickerTarget] = useState<
    "from" | "to" | null
  >(null);
  const [adminDatePickerValue, setAdminDatePickerValue] = useState(new Date());
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
    return isPosSplit ? 112 : 120;
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

  const todayDate = useMemo(() => toIsoDateOnly(new Date()), []);

  const settlementCycleStartIso = useMemo(() => {
    const candidates: string[] = [];

    selectedStoreSettlements.forEach((item) => {
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

  const allMergedOrderRows = useMemo(() => {
    const rows = new Map<string, OrderHistoryRow>();

    remoteOrders
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) => rows.set(item.clientOrderId, mapApiOrderToRow(item)));

    selectedStoreOrders.forEach((item) =>
      rows.set(item.clientOrderId, mapLocalOrderToRow(item)),
    );

    return Array.from(rows.values()).sort((a, b) =>
      b.orderedAt.localeCompare(a.orderedAt),
    );
  }, [remoteOrders, selectedStoreId, selectedStoreOrders]);

  const mergedOrderRows = useMemo(
    () => allMergedOrderRows.slice(0, 12),
    [allMergedOrderRows],
  );

  const mergedSettlementRows = useMemo(() => {
    const rows = new Map<string, SettlementHistoryRow>();

    remoteSettlements
      .filter((item) => item.storeId === selectedStoreId)
      .forEach((item) =>
        rows.set(item.businessDate, mapApiSettlementToRow(item)),
      );

    selectedStoreSettlements.forEach((item) =>
      rows.set(item.businessDate, mapLocalSettlementToRow(item)),
    );

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
  ]);

  const filteredExpenseRows = useMemo(
    () =>
      mergedExpenseRows.filter((item) => {
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
      }),
    [
      expenseFilterCategory,
      expenseFilterFrom,
      expenseFilterText,
      expenseFilterTo,
      mergedExpenseRows,
    ],
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
          !item.productName
            .toLowerCase()
            .includes(purchaseFilterProduct.toLowerCase())
        ) {
          return false;
        }

        return true;
      }),
    [
      mergedPurchaseRows,
      purchaseFilterFrom,
      purchaseFilterProduct,
      purchaseFilterTo,
    ],
  );

  const openExpenseDetails = useCallback((item: ExpenseRow) => {
    setSelectedExpenseDetails(item);
  }, []);

  const openSettlementDetails = useCallback(
    (settlement: SettlementHistoryRow) => {
      const dayOrders = allMergedOrderRows.filter(
        (item) => item.orderedAt.slice(0, 10) === settlement.businessDate,
      );
      const dayExpenses = mergedExpenseRows.filter(
        (item) => item.expenseDate === settlement.businessDate,
      );
      const dayPurchases = mergedPurchaseRows.filter(
        (item) => item.purchaseDate === settlement.businessDate,
      );
      const employeeNameLookup = new Map(
        selectedStoreEmployees.map((employee) => [employee.id, employee.name]),
      );
      const dayWithdrawals = selectedStoreWithdrawals
        .filter((item) => item.withdrawalDate === settlement.businessDate)
        .map((item) => ({
          ...item,
          employeeName:
            employeeNameLookup.get(item.employeeId) ?? item.employeeId,
        }));

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
      const carryInAmount = Number(
        (
          expectedBeforeDistributionAmount -
          (netSalesAmount -
            expensesAmount -
            purchasesAmount -
            withdrawalsAmount)
        ).toFixed(2),
      );
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
      allMergedOrderRows,
      mergedExpenseRows,
      mergedPurchaseRows,
      selectedStoreEmployees,
      selectedStoreWithdrawals,
    ],
  );

  const productSupplyRows = useMemo<ProductSupplyRow[]>(() => {
    const purchasedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();
    const refundedByProduct = new Map<string, number>();
    const todayReceivedByProduct = new Map<string, number>();

    mergedPurchaseRows.forEach((entry) => {
      const key = normalizeProductKey(entry.productName);
      purchasedByProduct.set(
        key,
        (purchasedByProduct.get(key) ?? 0) + entry.quantity,
      );

      if (entry.purchaseDate === todayDate) {
        todayReceivedByProduct.set(
          key,
          (todayReceivedByProduct.get(key) ?? 0) + entry.quantity,
        );
      }
    });

    allMergedOrderRows.forEach((order) => {
      order.items.forEach((item) => {
        const key = normalizeProductKey(item.productName);
        if (order.status === "REFUNDED") {
          refundedByProduct.set(
            key,
            (refundedByProduct.get(key) ?? 0) + item.quantity,
          );
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
      const loggedToday = Number(
        (todayReceivedByProduct.get(key) ?? 0).toFixed(3),
      );
      const receivedToday = Number(
        parseNumberInput(todaySupplyInputs[product.id] ?? "0").toFixed(3),
      );

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
  }, [
    allMergedOrderRows,
    mergedPurchaseRows,
    products,
    todayDate,
    todaySupplyInputs,
  ]);

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

  const productSalesSummaryRows = useMemo<ProductSalesSummaryRow[]>(() => {
    const byProduct = new Map<string, ProductSalesSummaryRow>();

    ordersInCurrentCycle.forEach((order) => {
      order.items.forEach((item) => {
        const key = normalizeProductKey(item.productName);
        const fromCatalog = products.find(
          (entry) => normalizeProductKey(entry.name) === key,
        );
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
      buildPieceStockAuditRows(
        productSupplyRows,
        settlementActualInputs,
        parseNumberInput,
      ),
    [productSupplyRows, settlementActualInputs],
  );

  const auditNetSalesAmount = useMemo(
    () => getAuditNetSalesAmount(pieceStockAuditRows),
    [pieceStockAuditRows],
  );

  const auditSalesAmount = useMemo(
    () =>
      Number(
        pieceStockAuditRows
          .filter((row) => row.diffQty !== null && row.diffQty < 0)
          .reduce((sum, row) => sum + Math.max(row.adjustmentAmount ?? 0, 0), 0)
          .toFixed(2),
      ),
    [pieceStockAuditRows],
  );

  const auditRefundAmount = useMemo(
    () =>
      Number(
        pieceStockAuditRows
          .filter((row) => row.diffQty !== null && row.diffQty > 0)
          .reduce((sum, row) => sum + Math.abs(row.adjustmentAmount ?? 0), 0)
          .toFixed(2),
      ),
    [pieceStockAuditRows],
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
      const byProduct = new Map<string, ProductSalesSummaryRow>();

      productSalesSummaryRows.forEach((row) => {
        byProduct.set(row.productId, { ...row });
      });

      pieceStockAuditRows.forEach((row) => {
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

      return Array.from(byProduct.values()).map((row) => ({
        ...row,
        soldQty: Number(row.soldQty.toFixed(3)),
        refundedQty: Number(row.refundedQty.toFixed(3)),
        netQty: Number(row.netQty.toFixed(3)),
        netAmount: Number(row.netAmount.toFixed(2)),
      }));
    },
    [pieceStockAuditRows, productSalesSummaryRows],
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

  const effectiveDashboardTotals = useMemo(
    () =>
      dashboardTotals ?? {
        ordersCount: dashboardSummaries.reduce(
          (sum, item) => sum + item.ordersCount,
          0,
        ),
        completedRevenue: dashboardSummaries.reduce(
          (sum, item) => sum + item.completedRevenue,
          0,
        ),
        refundAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.refundAmount,
          0,
        ),
        sharesAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.sharesAmount,
          0,
        ),
        cashBoxAmount: dashboardSummaries.reduce(
          (sum, item) => sum + item.cashBoxAmount,
          0,
        ),
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
        netProfit: dashboardSummaries.reduce(
          (sum, item) => sum + item.netProfit,
          0,
        ),
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

  const markOrderSynced = useCallback((referenceId: string) => {
    setOrders((previous) => {
      const next = previous.map((order) =>
        order.clientOrderId === referenceId
          ? { ...order, synced: true }
          : order,
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
        item.clientPurchaseId === referenceId
          ? { ...item, synced: true }
          : item,
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
      handleApiFailure(error, "تعذر تحميل المحلات من السيرفر.");
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
      handleApiFailure(error, "تعذر تحديث سجل الطلبات من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshDailySettlementsData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchDailySettlements(authToken, {
        storeId: selectedStoreId,
      });
      setRemoteSettlements(data);
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث تسويات اليوم من السيرفر.");
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
      handleApiFailure(error, "تعذر تحديث المصاريف من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshPurchasesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const data = await fetchPurchases(authToken, {
        storeId: selectedStoreId,
      });
      setRemotePurchases(data);
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث المشتريات من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshInventoryData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
    }

    try {
      const [purchaseData, orderData] = await Promise.all([
        fetchPurchases(authToken, { storeId: selectedStoreId }),
        fetchOrders(authToken, { storeId: selectedStoreId }),
      ]);
      setRemotePurchases(purchaseData);
      setRemoteOrders(orderData);
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث بيانات المخزون من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, selectedStoreId]);

  const refreshEmployeesData = useCallback(async () => {
    if (!authToken || !selectedStoreId || !isOnline) {
      return;
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
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث بيانات الموظفين من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, queue, selectedStoreId]);

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
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث كتالوج المنتجات من السيرفر.");
    }
  }, [authToken, handleApiFailure, isOnline, queue]);

  const refreshDashboardData = useCallback(async () => {
    if (!isOnline || !isAdmin || !authToken) {
      return;
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
    } catch (error: unknown) {
      handleApiFailure(error, "تعذر تحديث لوحة الإدارة حالياً.");
    }
  }, [
    adminFromDateInput,
    adminToDateInput,
    authToken,
    handleApiFailure,
    isAdmin,
    isOnline,
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

    isSyncingRef.current = true;
    setIsSyncing(true);
    setStatusMessage("يتم حالياً مزامنة العمليات المحلية...");

    const remaining: SyncJob[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const job = queue[index];

      try {
        const entity = job.entity ?? job.type;
        const action = job.action ?? "CREATE";

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

          await postDailySettlement(authToken, {
            ...(settlementPayload as CreateDailySettlementPayload),
            actualRemainingAmount:
              settlementPayload.actualRemainingAmount ??
              Number(expectedRemainingFallback.toFixed(2)),
          });
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
        } else if (entity === "EMPLOYEE" && action === "CREATE") {
          await postEmployee(authToken, job.payload as CreateEmployeePayload);
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
        }
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          remaining.push(...queue.slice(index));
          logout("انتهت الجلسة أثناء المزامنة. الرجاء تسجيل الدخول مجدداً.");
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
    isSyncingRef.current = false;
    setIsSyncing(false);

    if (remaining.length === 0) {
      setStatusMessage("تمت مزامنة كل العمليات المؤجلة.");
      await Promise.all([
        refreshDashboardData(),
        refreshInventoryData(),
        refreshDailySettlementsData(),
        refreshEmployeesData(),
        refreshExpensesData(),
        refreshProductsData(),
      ]);
      return;
    }

    setStatusMessage(`بقي ${remaining.length} عملية بانتظار المزامنة.`);
  }, [
    isOnline,
    expenses,
    markExpenseSynced,
    markEmployeeAbsenceSynced,
    markEmployeeSynced,
    markEmployeeWithdrawalSynced,
    markOrderSynced,
    markProductSynced,
    markPurchaseSynced,
    markSettlementSynced,
    queue,
    authToken,
    logout,
    refreshDailySettlementsData,
    refreshEmployeesData,
    refreshExpensesData,
    refreshInventoryData,
    refreshProductsData,
    refreshDashboardData,
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
          cachedProducts,
          cachedEmployees,
          cachedEmployeeAbsences,
          cachedEmployeeWithdrawals,
          cachedProductOrderByStore,
          cachedQueue,
        ] = await Promise.all([
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
          loadObject<Record<string, string[]>>(PRODUCT_ORDER_STORAGE_KEY),
          loadArray<SyncJob>(STORAGE_KEYS.syncQueue),
        ]);

        if (!mounted) {
          return;
        }

        const initialStores =
          cachedStores.length > 0 ? cachedStores : FALLBACK_STORES;
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
            : buildProductsFromHistory(cachedPurchases, cachedOrders).map(
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
        setDailySettlements(cachedSettlements);
        setExpenses(cachedExpenses);
        setExpenseCategoryOptions(initialExpenseCategories);
        setPurchases(cachedPurchases);
        setProducts(initialProducts);
        setEmployees(cachedEmployees);
        setEmployeeAbsences(cachedEmployeeAbsences);
        setEmployeeWithdrawals(cachedEmployeeWithdrawals);
        setProductOrderByStore(cachedProductOrderByStore ?? {});
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
        setProductOrderByStore({});
        setQueue([]);
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
    void saveArray(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    void saveObject(PRODUCT_ORDER_STORAGE_KEY, productOrderByStore);
  }, [productOrderByStore]);

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
  }, [
    assignedStoreId,
    employeeAbsences,
    employeeWithdrawals,
    employees,
    enqueueJob,
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
    setActualRemainingInput("");
    setTawasiCapitalInput("");
    setTawasiSellPriceInput("");
    setSelectedOrderInvoice(null);
    setSelectedExpenseDetails(null);
    setSelectedSettlementDetail(null);
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

    void refreshInventoryData();
    void refreshDailySettlementsData();
    void refreshEmployeesData();
    void refreshExpensesData();
    void refreshProductsData();
  }, [
    isOnline,
    refreshDailySettlementsData,
    refreshEmployeesData,
    refreshExpensesData,
    refreshInventoryData,
    refreshProductsData,
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
    if (
      !isOnline ||
      !session?.accessToken ||
      !isAdmin ||
      activeScreen !== "admin"
    ) {
      return;
    }

    void refreshDashboardData();
  }, [
    activeScreen,
    isAdmin,
    isOnline,
    refreshDashboardData,
    session?.accessToken,
  ]);

  const syncQueueTrigger = useMemo(
    () =>
      JSON.stringify(
        queue.map((job) => ({
          ...job,
          retries: 0,
        })),
      ),
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
    if (!isOnline || !session?.accessToken || queue.length === 0) {
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

  const roundPadValue = () => {
    if (!posPadInput.trim()) {
      setStatusMessage("أدخل مبلغاً أولاً لإضافته إلى الكاش.");
      return;
    }

    const cashValue = parseNumberInput(posPadInput);
    if (cashValue <= 0) {
      setStatusMessage("قيمة الكاش غير صالحة.");
      return;
    }

    setPosCashCarryAmount((previous) =>
      Number((previous + cashValue).toFixed(2)),
    );
    setCashBoxInput((previous) => {
      const previousValue = parseNumberInput(previous);
      return String(Number((previousValue + cashValue).toFixed(2)));
    });
    setPosPadInput("");
    setPendingMultiplier(null);
    setPendingAmountValue(null);
    setStatusMessage(
      `تمت إضافة ${formatMoney(cashValue)} إلى كاش الصندوق (مدور).`,
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
      void saveArray(STORAGE_KEYS.orders, next);
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
    const carryForwardAmount = getActualSettlementCarryForwardAmount(
      actualRemainingAmount,
      cashBoxAmount,
      sharesAmount,
    );

    const adjustmentRows = pieceStockAuditRows.filter(
      (row) => row.diffQty !== null && Math.abs(row.diffQty) > 0,
    );
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
        void saveArray(STORAGE_KEYS.orders, next);
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

    const postedAdjustmentJobIds = new Set<string>();

    if (isOnline && authToken) {
      try {
        for (const job of adjustmentJobs) {
          await postOrder(authToken, job.payload as CreateOrderPayload);
          postedAdjustmentJobIds.add(job.id);
          markOrderSynced(job.referenceId);
        }

        await postDailySettlement(authToken, payload);
        markSettlementSynced(clientClosureId);
        setStatusMessage(
          adjustmentRecords.length > 0
            ? `تم تسجيل التسوية، وتوليد ${adjustmentRecords.length} حركة ضبط جرد. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`
            : `تم تسجيل تسوية اليوم في السيرفر. رصيد المدوّر الجديد: ${formatMoney(carryForwardAmount)}.`,
        );
        await refreshDashboardData();
        await refreshOrdersData();
        await refreshDailySettlementsData();
        return;
      } catch (error: unknown) {
        adjustmentJobs
          .filter((job) => !postedAdjustmentJobIds.has(job.id))
          .forEach((job) => enqueueJob(job));
        enqueueJob(syncJob);

        if (error instanceof ApiError && error.status === 401) {
          logout('انتهت الجلسة وتم حفظ التسوية محلياً لحين تسجيل الدخول.');
          return;
        }

        setStatusMessage('تم حفظ التسوية محلياً وسيتم رفعها تلقائياً.');
        return;
      }
    }

    adjustmentJobs.forEach((job) => enqueueJob(job));
    enqueueJob(syncJob);
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
      synced: false,
    };

    setEmployees((previous) =>
      [...previous, employee].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    );
    enqueueJob({
      id: makeId('job'),
      referenceId: employee.id,
      retries: 0,
      createdAt: now,
      entity: 'EMPLOYEE',
      action: 'CREATE',
      payload: {
        clientEmployeeId: employee.id,
        storeId: employee.storeId,
        name: employee.name,
        weeklySalary: employee.weeklySalary,
        isActive: employee.isActive,
        syncedAt: now,
      },
    });
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
    adminDatePickerTarget,
    adminDatePickerValue,
    adminFromDateInput,
    adminToDateInput,
    applyDiscountFromPad,
    assignedStoreId,
    auditNetSalesAmount,
    backspacePad,
    beginExpenseEdit,
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
    closeAdminDatePicker,
    closeMobileNav,
    confirmAdminDatePicker,
    dashboardSummaries,
    decreaseProductInCart,
    deleteExpenseRecord,
    deleteProductDefinition,
    deletePurchaseRecord,
    discountInput,
    effectiveDashboardTotals,
    effectiveExpenseCategoryOptions,
    employeeNameInput,
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
    isSyncing,
    loginUser,
    logout,
    mergedOrderRows,
    mergedSettlementRows,
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
    openAdminDatePicker,
    openExpenseDetails,
    openProductCreateForm,
    openSettlementDetails,
    orders,
    padAmountPreview,
    passwordInput,
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
    registerTawasiSupply,
    removeEmployeeAbsence,
    removeEmployeeWithdrawal,
    resetExpenseForm,
    resetProductForm,
    roundPadValue,
    saveExpense,
    saveProductDefinition,
    selectedExpenseDetails,
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
    setSelectedExpenseDetails,
    setSelectedOrderInvoice,
    setSelectedSettlementDetail,
    setSelectedStoreId,
    setSettlementNoteInput,
    setStatusMessage,
    setTawasiCapitalInput,
    setTawasiSellPriceInput,
    setUsernameInput,
    setWithdrawalAmountInput,
    setWithdrawalDateInput,
    setWithdrawalEmployeeIdInput,
    setWithdrawalNoteInput,
    settlementActualInputs,
    settlementCarryForwardAmount,
    settlementCycleStartIso,
    settlementDifferenceAmount,
    settlementExpectedRevenueAmount,
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
    submitDailySettlement,
    submitOrder,
    subtotal,
    tawasiCapitalInput,
    tawasiSellPriceInput,
    toExpenseCategoryLabel,
    toOrderStatusLabel,
    toPaymentMethodLabel,
    toShortDate,
    todayEmployeeWithdrawalsTotal,
    todayExpectedRemaining,
    todayExpensesTotal,
    todayNetSales,
    todayPurchasesTotal,
    todayRefundTotal,
    todaySalesTotal,
    todaySupplyInputs,
    toggleMobileNav,
    total,
    updateCashBoxInput,
    updateSettlementActualInput,
    updateSharesInput,
    updateTodaySupplyInput,
    usernameInput,
    weekEndDate,
    weekStartDate,
    withdrawalAmountInput,
    withdrawalDateInput,
    withdrawalEmployeeIdInput,
    withdrawalNoteInput,
  };

  return {
    appScreenContext,
    isBootstrapping,
    session,
    playTapSound,
    isDesktop,
    isPortraitMobile,
    swipePanResponder,
    isPosProductReordering,
  };
}
