import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '../config';
import {
  ApiExpense,
  ApiInventoryAdjustment,
  ApiInventoryDestruction,
  ApiEmployee,
  ApiEmployeeAbsence,
  ApiEmployeeWithdrawal,
  ApiDailySettlement,
  CloudinarySignatureResponse,
  ApiOrder,
  ApiProduct,
  ApiPurchase,
  AuthSession,
  CreateExpensePayload,
  CreateInventoryAdjustmentPayload,
  CreateInventoryDestructionPayload,
  CreateEmployeeAbsencePayload,
  CreateEmployeePayload,
  CreateEmployeeWithdrawalPayload,
  CreateDailySettlementPayload,
  CreateOrderPayload,
  CreateProductPayload,
  CreatePurchasePayload,
  DashboardResponse,
  LoginPayload,
  Store,
  UpdateProductPayload,
  UpdateEmployeePayload,
  UpdateExpensePayload,
  UpdatePurchasePayload,
} from '../types';

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_MAX_NETWORK_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 500;
const WRITE_REQUEST_OPTIONS = {
  timeoutMs: REQUEST_TIMEOUT_MS,
  maxNetworkRetries: 0,
} as const;
const INVENTORY_WRITE_REQUEST_OPTIONS = {
  timeoutMs: 8000,
  maxNetworkRetries: 0,
} as const;
let lastReachableBaseUrl: string | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(bodyText || `Request failed with status ${status}`);
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
  maxNetworkRetries?: number;
  onNetworkRetry?: (info: { attempt: number; maxAttempts: number; baseUrl: string }) => void;
}

interface ListQuery {
  storeId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

interface ExpenseListQuery extends ListQuery {
  category?: string;
  description?: string;
}

interface PurchaseListQuery extends ListQuery {
  product?: string;
}

interface DateRangeQuery {
  from?: string;
  to?: string;
}

function getOrderedTargets(targets: string[]): string[] {
  if (!lastReachableBaseUrl || !targets.includes(lastReachableBaseUrl)) {
    return targets;
  }

  return [lastReachableBaseUrl, ...targets.filter((item) => item !== lastReachableBaseUrl)];
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const originalSignal = options.signal;
  const onAbort = () => controller.abort();

  if (originalSignal) {
    if (originalSignal.aborted) {
      controller.abort();
    } else {
      originalSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (originalSignal) {
      originalSignal.removeEventListener('abort', onAbort);
    }
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

function buildListQuery(params: ListQuery): string {
  return buildQuery({
    storeId: params.storeId,
    from: params.from,
    to: params.to,
    limit: params.limit === undefined ? undefined : String(params.limit),
    offset: params.offset === undefined ? undefined : String(params.offset),
  });
}

function buildExpenseQuery(params: ExpenseListQuery): string {
  return buildQuery({
    storeId: params.storeId,
    from: params.from,
    to: params.to,
    category: params.category,
    description: params.description,
  });
}

function buildPurchaseQuery(params: PurchaseListQuery): string {
  return buildQuery({
    storeId: params.storeId,
    from: params.from,
    to: params.to,
    product: params.product,
  });
}

function buildDateRangeQuery(params: DateRangeQuery): string {
  return buildQuery({
    from: params.from,
    to: params.to,
  });
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const {
    token,
    timeoutMs = REQUEST_TIMEOUT_MS,
    maxNetworkRetries = DEFAULT_MAX_NETWORK_RETRIES,
    onNetworkRetry,
    ...requestOptions
  } = options ?? {};
  const headers = new Headers(requestOptions.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const configuredTargets =
    API_BASE_URL_CANDIDATES.length > 0 ? API_BASE_URL_CANDIDATES : [API_BASE_URL];
  const targets = getOrderedTargets(configuredTargets);
  let lastNetworkError: TypeError | null = null;

  for (const baseUrl of targets) {
    for (let attempt = 1; attempt <= maxNetworkRetries + 1; attempt += 1) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}${path}`,
          {
            ...requestOptions,
            headers,
          },
          timeoutMs,
        );

        if (!response.ok) {
          const bodyText = await response.text();
          throw new ApiError(response.status, bodyText);
        }

        lastReachableBaseUrl = baseUrl;
        return (await response.json()) as T;
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          throw error;
        }

        const isAbort = error instanceof Error && error.name === 'AbortError';
        const isNetwork = isAbort || error instanceof TypeError;
        if (!isNetwork) {
          throw error;
        }

        if (attempt <= maxNetworkRetries) {
          onNetworkRetry?.({
            attempt: attempt + 1,
            maxAttempts: maxNetworkRetries + 1,
            baseUrl,
          });
          await wait(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }

        lastNetworkError = isAbort
          ? new TypeError(`Network timeout after ${timeoutMs}ms`)
          : (error as TypeError);
      }
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError;
  }

  throw new Error(`Unable to reach API using configured endpoints: ${targets.join(', ')}`);
}

export function login(
  payload: LoginPayload,
  options?: Pick<RequestOptions, 'onNetworkRetry'>,
): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 45000,
    maxNetworkRetries: 4,
    onNetworkRetry: options?.onNetworkRetry,
  });
}

export function fetchMe(token: string): Promise<AuthSession['user']> {
  return request<AuthSession['user']>('/auth/me', { token });
}

export function fetchStores(token: string): Promise<Store[]> {
  return request<Store[]>('/stores', { token });
}

export function addStoreCashCarry(
  token: string,
  storeId: string,
  amount: number,
): Promise<Store> {
  return request<Store>(`/stores/${encodeURIComponent(storeId)}/cash-carry/add`, {
    method: 'PATCH',
    body: JSON.stringify({ amount }),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function postOrder(token: string, payload: CreateOrderPayload) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function postDailySettlement(token: string, payload: CreateDailySettlementPayload) {
  return request('/daily-settlements', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function fetchOrders(token: string, query: ListQuery = {}): Promise<ApiOrder[]> {
  return request<ApiOrder[]>(`/orders${buildListQuery(query)}`, { token });
}

export function fetchDailySettlements(
  token: string,
  query: ListQuery = {},
): Promise<ApiDailySettlement[]> {
  return request<ApiDailySettlement[]>(`/daily-settlements${buildListQuery(query)}`, {
    token,
  });
}

export function fetchDashboard(token: string, query: DateRangeQuery = {}): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/admin/dashboard${buildDateRangeQuery(query)}`, { token });
}

export function postExpense(token: string, payload: CreateExpensePayload): Promise<ApiExpense> {
  return request<ApiExpense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function patchExpense(
  token: string,
  clientExpenseId: string,
  payload: UpdateExpensePayload,
): Promise<ApiExpense> {
  return request<ApiExpense>(`/expenses/${encodeURIComponent(clientExpenseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function deleteExpense(token: string, clientExpenseId: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/expenses/${encodeURIComponent(clientExpenseId)}`, {
    method: 'DELETE',
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function fetchExpenses(
  token: string,
  query: ExpenseListQuery = {},
): Promise<ApiExpense[]> {
  return request<ApiExpense[]>(`/expenses${buildExpenseQuery(query)}`, { token });
}

export function fetchEmployees(token: string, query: ListQuery = {}): Promise<ApiEmployee[]> {
  return request<ApiEmployee[]>(`/employees${buildListQuery(query)}`, { token });
}

export function postEmployee(
  token: string,
  payload: CreateEmployeePayload,
): Promise<ApiEmployee> {
  return request<ApiEmployee>('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function patchEmployee(
  token: string,
  clientEmployeeId: string,
  payload: UpdateEmployeePayload,
): Promise<ApiEmployee> {
  return request<ApiEmployee>(`/employees/${encodeURIComponent(clientEmployeeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function fetchEmployeeAbsences(
  token: string,
  query: ListQuery = {},
): Promise<ApiEmployeeAbsence[]> {
  return request<ApiEmployeeAbsence[]>(`/employees/absences${buildListQuery(query)}`, {
    token,
  });
}

export function postEmployeeAbsence(
  token: string,
  payload: CreateEmployeeAbsencePayload,
): Promise<ApiEmployeeAbsence> {
  return request<ApiEmployeeAbsence>('/employees/absences', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function deleteEmployeeAbsence(
  token: string,
  clientAbsenceId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(
    `/employees/absences/${encodeURIComponent(clientAbsenceId)}`,
    {
      method: 'DELETE',
      token,
      ...WRITE_REQUEST_OPTIONS,
    },
  );
}

export function fetchEmployeeWithdrawals(
  token: string,
  query: ListQuery = {},
): Promise<ApiEmployeeWithdrawal[]> {
  return request<ApiEmployeeWithdrawal[]>(
    `/employees/withdrawals${buildListQuery(query)}`,
    { token },
  );
}

export function postEmployeeWithdrawal(
  token: string,
  payload: CreateEmployeeWithdrawalPayload,
): Promise<ApiEmployeeWithdrawal> {
  return request<ApiEmployeeWithdrawal>('/employees/withdrawals', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function deleteEmployeeWithdrawal(
  token: string,
  clientWithdrawalId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(
    `/employees/withdrawals/${encodeURIComponent(clientWithdrawalId)}`,
    {
      method: 'DELETE',
      token,
      ...WRITE_REQUEST_OPTIONS,
    },
  );
}

export function postPurchase(
  token: string,
  payload: CreatePurchasePayload,
): Promise<ApiPurchase> {
  return request<ApiPurchase>('/purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function patchPurchase(
  token: string,
  clientPurchaseId: string,
  payload: UpdatePurchasePayload,
): Promise<ApiPurchase> {
  return request<ApiPurchase>(`/purchases/${encodeURIComponent(clientPurchaseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function deletePurchase(
  token: string,
  clientPurchaseId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/purchases/${encodeURIComponent(clientPurchaseId)}`, {
    method: 'DELETE',
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function fetchPurchases(
  token: string,
  query: PurchaseListQuery = {},
): Promise<ApiPurchase[]> {
  return request<ApiPurchase[]>(`/purchases${buildPurchaseQuery(query)}`, { token });
}

export function fetchInventoryAdjustments(
  token: string,
  query: ListQuery = {},
): Promise<ApiInventoryAdjustment[]> {
  return request<ApiInventoryAdjustment[]>(
    `/inventory-adjustments${buildListQuery(query)}`,
    { token },
  );
}

export function postInventoryAdjustment(
  token: string,
  payload: CreateInventoryAdjustmentPayload,
): Promise<ApiInventoryAdjustment> {
  return request<ApiInventoryAdjustment>('/inventory-adjustments', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...INVENTORY_WRITE_REQUEST_OPTIONS,
  });
}

export function fetchInventoryDestructions(
  token: string,
  query: ListQuery = {},
): Promise<ApiInventoryDestruction[]> {
  return request<ApiInventoryDestruction[]>(
    `/inventory-destructions${buildListQuery(query)}`,
    { token },
  );
}

export function postInventoryDestruction(
  token: string,
  payload: CreateInventoryDestructionPayload,
): Promise<ApiInventoryDestruction> {
  return request<ApiInventoryDestruction>('/inventory-destructions', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...INVENTORY_WRITE_REQUEST_OPTIONS,
  });
}

export function fetchProducts(token: string): Promise<ApiProduct[]> {
  return request<ApiProduct[]>('/products', { token });
}

export function fetchCloudinarySignature(
  token: string,
  payload: { folder?: string } = {},
): Promise<CloudinarySignatureResponse> {
  return request<CloudinarySignatureResponse>('/uploads/cloudinary-signature', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function postProduct(token: string, payload: CreateProductPayload): Promise<ApiProduct> {
  return request<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function patchProduct(
  token: string,
  clientProductId: string,
  payload: UpdateProductPayload,
): Promise<ApiProduct> {
  return request<ApiProduct>(`/products/${encodeURIComponent(clientProductId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}

export function deleteProduct(
  token: string,
  clientProductId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/products/${encodeURIComponent(clientProductId)}`, {
    method: 'DELETE',
    token,
    ...WRITE_REQUEST_OPTIONS,
  });
}
