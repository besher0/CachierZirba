import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '../config';
import {
  ApiExpense,
  ApiDailySettlement,
  ApiOrder,
  ApiPurchase,
  AuthSession,
  CreateExpensePayload,
  CreateDailySettlementPayload,
  CreateOrderPayload,
  CreatePurchasePayload,
  DashboardResponse,
  LoginPayload,
  Store,
  UpdateExpensePayload,
  UpdatePurchasePayload,
} from '../types';

const REQUEST_TIMEOUT_MS = 4500;
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
}

interface ListQuery {
  storeId?: string;
  from?: string;
  to?: string;
}

interface ExpenseListQuery extends ListQuery {
  category?: string;
  description?: string;
}

interface PurchaseListQuery extends ListQuery {
  product?: string;
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

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');

  if (options?.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const configuredTargets =
    API_BASE_URL_CANDIDATES.length > 0 ? API_BASE_URL_CANDIDATES : [API_BASE_URL];
  const targets = getOrderedTargets(configuredTargets);
  let lastNetworkError: TypeError | null = null;

  for (const baseUrl of targets) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, {
        ...options,
        headers,
      }, REQUEST_TIMEOUT_MS);

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

      if (error instanceof Error && error.name === 'AbortError') {
        lastNetworkError = new TypeError(`Network timeout after ${REQUEST_TIMEOUT_MS}ms`);
        continue;
      }

      if (error instanceof TypeError) {
        lastNetworkError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError;
  }

  throw new Error(`Unable to reach API using configured endpoints: ${targets.join(', ')}`);
}

export function login(payload: LoginPayload): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMe(token: string): Promise<AuthSession['user']> {
  return request<AuthSession['user']>('/auth/me', { token });
}

export function fetchStores(token: string): Promise<Store[]> {
  return request<Store[]>('/stores', { token });
}

export function postOrder(token: string, payload: CreateOrderPayload) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
}

export function postDailySettlement(token: string, payload: CreateDailySettlementPayload) {
  return request('/daily-settlements', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
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

export function fetchDashboard(token: string): Promise<DashboardResponse> {
  return request<DashboardResponse>('/admin/dashboard', { token });
}

export function postExpense(token: string, payload: CreateExpensePayload): Promise<ApiExpense> {
  return request<ApiExpense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
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
  });
}

export function deleteExpense(token: string, clientExpenseId: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/expenses/${encodeURIComponent(clientExpenseId)}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchExpenses(
  token: string,
  query: ExpenseListQuery = {},
): Promise<ApiExpense[]> {
  return request<ApiExpense[]>(`/expenses${buildExpenseQuery(query)}`, { token });
}

export function postPurchase(
  token: string,
  payload: CreatePurchasePayload,
): Promise<ApiPurchase> {
  return request<ApiPurchase>('/purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
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
  });
}

export function deletePurchase(
  token: string,
  clientPurchaseId: string,
): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/purchases/${encodeURIComponent(clientPurchaseId)}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchPurchases(
  token: string,
  query: PurchaseListQuery = {},
): Promise<ApiPurchase[]> {
  return request<ApiPurchase[]>(`/purchases${buildPurchaseQuery(query)}`, { token });
}
