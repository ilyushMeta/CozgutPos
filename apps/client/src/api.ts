import axios from 'axios';
import type {
  AuthResult,
  LicenseStatus,
  CategoryInput,
  ProductInput,
  UnitPackInput,
  ReceivingInput,
  StockBatchUpdateInput,
  CreateSaleInput,
} from '@cozgut/shared';
import { useAuthStore } from './store/auth';

const baseURL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api';

export const api = axios.create({ baseURL });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(username: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', { username, password });
  return data;
}

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const { data } = await api.get<LicenseStatus>('/license/status');
  return data;
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data } = await api.get<Record<string, string>>('/settings');
  return data;
}

/** Public — works before login, unlike the rest of /settings. */
export async function fetchFirstRunStatus(): Promise<boolean> {
  const { data } = await api.get<{ done: boolean }>('/settings/first-run-status');
  return data.done;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await api.put('/settings', { key, value });
}

/** Public one-shot action — see server SettingsService.completeFirstRun. */
export async function completeFirstRun(
  mode: 'SERVER' | 'CLIENT',
  serverIp?: string,
): Promise<void> {
  await api.post('/settings/first-run', { mode, serverIp });
}

// ── Categories (SPEC §5.4) ───────────────────────────────────────────────────

export async function listCategories() {
  const { data } = await api.get('/categories');
  return data as { id: number; name: string }[];
}

export async function createCategory(input: CategoryInput) {
  const { data } = await api.post('/categories', input);
  return data;
}

export async function updateCategory(id: number, input: CategoryInput) {
  const { data } = await api.put(`/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: number) {
  await api.delete(`/categories/${id}`);
}

// ── Products (SPEC §5.3/§5.4) ────────────────────────────────────────────────

export async function listProducts(search?: string) {
  const { data } = await api.get('/products', { params: search ? { search } : undefined });
  return data as Array<{
    id: number;
    name: string;
    code: string;
    categoryId: number | null;
    isScaleItem: boolean;
    lowStockThreshold: string;
    expiryDate: string | null;
    discountPercent: string;
    secondPrice: string | null;
    category: { id: number; name: string } | null;
    unitPacks: Array<{
      id: number;
      name: string;
      qtyInside: string;
      buyPrice: string;
      sellPrice: string;
    }>;
  }>;
}

export async function getProduct(id: number) {
  const { data } = await api.get(`/products/${id}`);
  return data;
}

export async function generateProductCode() {
  const { data } = await api.post('/products/generate-code');
  return data as { code: string };
}

export async function createProduct(input: ProductInput) {
  const { data } = await api.post('/products', input);
  return data;
}

export async function updateProduct(id: number, input: ProductInput) {
  const { data } = await api.put(`/products/${id}`, input);
  return data;
}

export async function deleteProduct(id: number) {
  await api.delete(`/products/${id}`);
}

export async function listUnitPacks(productId: number) {
  const { data } = await api.get(`/products/${productId}/unit-packs`);
  return data;
}

export async function createUnitPack(productId: number, input: UnitPackInput) {
  const { data } = await api.post(`/products/${productId}/unit-packs`, input);
  return data;
}

export async function updateUnitPack(id: number, input: UnitPackInput) {
  const { data } = await api.put(`/unit-packs/${id}`, input);
  return data;
}

export async function deleteUnitPack(id: number) {
  await api.delete(`/unit-packs/${id}`);
}

/** Opens the label PDF in a new tab. A plain <a href> can't send the Bearer
 * token (the endpoint requires auth), so we fetch it as a blob ourselves. */
export async function openLabelPdf(productId: number, copies: number): Promise<void> {
  const { data } = await api.get(`/products/${productId}/label`, {
    params: { copies },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function updateStockBatch(id: number, input: StockBatchUpdateInput) {
  const { data } = await api.put(`/stock-batches/${id}`, input);
  return data;
}

export async function deleteStockBatch(id: number) {
  await api.delete(`/stock-batches/${id}`);
}

// ── Receiving (SPEC §5.3/§6.8) ───────────────────────────────────────────────

export async function submitReceiving(input: ReceivingInput) {
  const { data } = await api.post('/receiving', input);
  return data;
}

// ── Suppliers (minimal read — full CRUD is Phase 4) ──────────────────────────

export async function listSuppliers() {
  const { data } = await api.get('/suppliers');
  return data as { id: number; code: string; name: string; balance: string }[];
}

// ── Stock views (SPEC §5.4) ──────────────────────────────────────────────────

export async function fetchAmmar(search?: string) {
  const { data } = await api.get('/stock/ammar', { params: search ? { search } : undefined });
  return data;
}

export async function fetchOutOfStock() {
  const { data } = await api.get('/stock/out-of-stock');
  return data;
}

export async function fetchLowStock() {
  const { data } = await api.get('/stock/low-stock');
  return data;
}

export async function fetchExpiringSoon(days: number, categoryId?: number) {
  const { data } = await api.get('/stock/expiring-soon', { params: { days, categoryId } });
  return data;
}

/** Downloads an authenticated CSV endpoint as a file (plain <a href> can't send the Bearer token). */
export async function downloadCsv(
  path: string,
  filename: string,
  params: Record<string, string | number | undefined> = {},
): Promise<void> {
  const { data } = await api.get(path, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Sales / POS (SPEC §5.2/§6.3/§6.4) ────────────────────────────────────────

export async function createSale(input: CreateSaleInput) {
  const { data } = await api.post('/sales', input);
  return data;
}

export async function priceCheck(productId: number) {
  const { data } = await api.get(`/products/${productId}/price-check`);
  return data;
}

/** Opens the A4 faktur PDF in a new tab (same auth-blob pattern as openLabelPdf). */
export async function openFakturPdf(saleId: number): Promise<void> {
  const { data } = await api.get(`/sales/${saleId}/faktur`, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
