import { NativeModules, Platform } from 'react-native';
import { ExpenseCategory, ProductTemplate, Store } from './types';

const RENDER_API_FALLBACK_URL = 'https://cachierzirba.onrender.com/api';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function buildBaseUrlVariants(value: string): string[] {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) {
    return [];
  }

  const variants = [normalized];

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname === '' || pathname === '/') {
      parsed.pathname = '/api';
      const withApiPath = normalizeBaseUrl(parsed.toString());
      if (!variants.includes(withApiPath)) {
        variants.unshift(withApiPath);
      }
    }
  } catch {
    if (!normalized.toLowerCase().endsWith('/api')) {
      const withApiPath = `${normalized}/api`;
      if (!variants.includes(withApiPath)) {
        variants.unshift(withApiPath);
      }
    }
  }

  return variants;
}

function normalizeHost(host: string): string {
  return host.trim();
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isIpv4Address(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  return match.slice(1).every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function isPrivateIpv4Address(host: string): boolean {
  if (!isIpv4Address(host)) {
    return false;
  }

  if (host.startsWith('10.')) {
    return true;
  }

  if (host.startsWith('192.168.')) {
    return true;
  }

  if (host.startsWith('127.')) {
    return true;
  }

  const [first, second] = host.split('.').map(Number);
  return first === 172 && second >= 16 && second <= 31;
}

function isLikelyTunnelHost(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower.endsWith('.expo.dev') ||
    lower.endsWith('.exp.direct') ||
    lower.endsWith('.ngrok.io') ||
    lower.endsWith('.ngrok-free.app')
  );
}

function inferMetroHost(): string | null {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) {
    return null;
  }

  const normalizedScriptUrl = scriptURL.startsWith('exp://')
    ? scriptURL.replace('exp://', 'http://')
    : scriptURL;

  try {
    const host = new URL(normalizedScriptUrl).hostname;
    return host ? normalizeHost(host) : null;
  } catch {
    const match = normalizedScriptUrl.match(/\/\/([^/:?#]+)(?::\d+)?/);
    return match?.[1] ? normalizeHost(match[1]) : null;
  }
}

function resolveDefaultApiBaseUrl(): string {
  const inferredHost = inferMetroHost()?.toLowerCase() ?? null;
  if (inferredHost && !isLikelyTunnelHost(inferredHost)) {
    if (Platform.OS === 'android' && isLoopbackHost(inferredHost)) {
      return 'http://127.0.0.1:3000/api';
    }

    return `http://${normalizeHost(inferredHost)}:3000/api`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://127.0.0.1:3000/api';
}

function resolveApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  const append = (value: string | null | undefined) => {
    if (!value) {
      return;
    }

    const variants = buildBaseUrlVariants(value);
    for (const variant of variants) {
      if (!candidates.includes(variant)) {
        candidates.push(variant);
      }
    }
  };

  append(configuredApiBaseUrl);

  if (!__DEV__) {
    if (!configuredApiBaseUrl) {
      append(RENDER_API_FALLBACK_URL);
    }

    return candidates;
  }

  const inferredHost = inferMetroHost()?.toLowerCase() ?? null;
  if (inferredHost && !isLikelyTunnelHost(inferredHost)) {
    if (Platform.OS === 'android' && isLoopbackHost(inferredHost)) {
      append('http://127.0.0.1:3000/api');
      append('http://localhost:3000/api');
      append('http://10.0.2.2:3000/api');
    } else {
      append(`http://${normalizeHost(inferredHost)}:3000/api`);
    }
  }

  if (inferredHost && isPrivateIpv4Address(inferredHost)) {
    append(`http://${inferredHost}:3000/api`);
  }

  if (Platform.OS === 'android') {
    // Physical Android devices can reach the host via `adb reverse`.
    append('http://127.0.0.1:3000/api');
    append('http://localhost:3000/api');
    // Android emulator default loopback to host machine.
    append('http://10.0.2.2:3000/api');
  }

  if (Platform.OS !== 'android') {
    append('http://127.0.0.1:3000/api');
    append('http://localhost:3000/api');
  }

  return candidates;
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const defaultApiBaseUrl =
  configuredApiBaseUrl ?? (__DEV__ ? resolveDefaultApiBaseUrl() : RENDER_API_FALLBACK_URL);
const defaultApiVariants = buildBaseUrlVariants(defaultApiBaseUrl);
export const API_BASE_URL = defaultApiVariants[0] ?? normalizeBaseUrl(defaultApiBaseUrl);
export const API_BASE_URL_CANDIDATES = resolveApiBaseCandidates();

export const STORAGE_KEYS = {
  authSession: 'zirba.auth.session.v1',
  stores: 'zirba.cached.stores.v1',
  orders: 'zirba.cached.orders.v1',
  dailySettlements: 'zirba.cached.dailySettlements.v1',
  expenses: 'zirba.cached.expenses.v1',
  expenseCategories: 'zirba.cached.expenseCategories.v1',
  purchases: 'zirba.cached.purchases.v1',
  products: 'zirba.cached.products.v1',
  employees: 'zirba.cached.employees.v1',
  employeeAbsences: 'zirba.cached.employeeAbsences.v1',
  employeeWithdrawals: 'zirba.cached.employeeWithdrawals.v1',
  syncQueue: 'zirba.sync.queue.v1',
} as const;

export const FALLBACK_STORES: Store[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'محافظة',
    code: 'ZIRBA_MAIN',
    isActive: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'فرقان',
    code: 'ZIRBA_MALL',
    isActive: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'اندلس',
    code: 'ZIRBA_BASHAR',
    isActive: true,
  },
];

export const PRODUCT_CATALOG: ProductTemplate[] = [];

export const DEFAULT_EXPENSE_CATEGORY_OPTIONS: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'CLEANING', label: 'منظفات' },
  { value: 'DRINKS', label: 'مشروبات' },
  { value: 'OTHER', label: 'أخرى' },
];

