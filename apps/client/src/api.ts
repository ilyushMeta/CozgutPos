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
  DebtorInput,
  DebtPaymentInput,
  SupplierUpsertInput,
  SupplierPaymentInput,
  OpenDayInput,
  DepositInput,
  WithdrawInput,
  ReturnInput,
  RevisionLineInput,
  StocktakeScanInput,
  SecondShopSaleInput,
  RecipeInput,
  NeededProductInput,
  CreateUserInput,
  UpdateUserInput,
  UpdateDiscountInput,
  AddExchangeRateInput,
  ActivateLicenseInput,
  DashboardSummary,
  ProfitByMonth,
  CategoryBreakdown,
  BackupFileInfo,
  PaymentMethod,
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

export async function changeOwnPassword(newPassword: string): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/change-password', { newPassword });
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

// ── Suppliers / Karz dükan (SPEC §5.6) ───────────────────────────────────────

export async function listSuppliers() {
  const { data } = await api.get('/suppliers');
  return data as { id: number; code: string; name: string; balance: string }[];
}

export async function getSupplier(id: number) {
  const { data } = await api.get(`/suppliers/${id}`);
  return data;
}

export async function generateSupplierCode() {
  const { data } = await api.post('/suppliers/generate-code');
  return data as { code: string };
}

export async function createSupplier(input: SupplierUpsertInput) {
  const { data } = await api.post('/suppliers', input);
  return data;
}

export async function updateSupplier(id: number, input: SupplierUpsertInput) {
  const { data } = await api.put(`/suppliers/${id}`, input);
  return data;
}

export async function deleteSupplier(id: number) {
  await api.delete(`/suppliers/${id}`);
}

export async function listSupplierMoves(id: number) {
  const { data } = await api.get(`/suppliers/${id}/moves`);
  return data;
}

export async function paySupplierDebt(id: number, input: SupplierPaymentInput) {
  const { data } = await api.post(`/suppliers/${id}/pay`, input);
  return data;
}

// ── Debtors / Karz klient (SPEC §5.5) ────────────────────────────────────────

export async function listDebtors(search?: string) {
  const { data } = await api.get('/debtors', { params: search ? { search } : undefined });
  return data as Array<{
    id: number;
    code: string;
    name: string;
    phone: string | null;
    note: string | null;
    accountCurrency: 'TMT' | 'USD';
    balance: string;
    overdueAmount: string;
    isOverdue: boolean;
    nextDueDate: string | null;
  }>;
}

export async function getDebtor(id: number) {
  const { data } = await api.get(`/debtors/${id}`);
  return data;
}

export async function generateDebtorCode() {
  const { data } = await api.post('/debtors/generate-code');
  return data as { code: string };
}

export async function createDebtor(input: DebtorInput) {
  const { data } = await api.post('/debtors', input);
  return data;
}

export async function updateDebtor(id: number, input: DebtorInput) {
  const { data } = await api.put(`/debtors/${id}`, input);
  return data;
}

export async function deleteDebtor(id: number) {
  await api.delete(`/debtors/${id}`);
}

export async function payDebtorDebt(id: number, input: DebtPaymentInput) {
  const { data } = await api.post(`/debtors/${id}/pay`, input);
  return data;
}

// ── SMS gateway (SPEC §7.4) ───────────────────────────────────────────────────

export async function testSms(to: string, message?: string) {
  const { data } = await api.post('/sms/test', { to, message });
  return data as { sent: boolean; reason?: string };
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

// ── Kassa (SPEC §5.7) ─────────────────────────────────────────────────────────

export async function fetchCashToday() {
  const { data } = await api.get('/cash/today');
  return data as {
    date: string;
    openingBalance: string;
    income: string;
    expense: string;
    closingBalance: string;
  };
}

export async function fetchCashMoves(from?: string, to?: string) {
  const { data } = await api.get('/cash/moves', { params: { from, to } });
  return data as Array<{
    id: number;
    datetime: string;
    type: string;
    amount: string;
    balanceBefore: string;
    note: string | null;
  }>;
}

export async function openCashDay(input: OpenDayInput) {
  const { data } = await api.post('/cash/open', input);
  return data;
}

export async function depositCash(input: DepositInput) {
  const { data } = await api.post('/cash/deposit', input);
  return data;
}

export async function withdrawCash(input: WithdrawInput) {
  const { data } = await api.post('/cash/withdraw', input);
  return data;
}

// ── Yzyna goýmak (SPEC §5.8/§6.12) ────────────────────────────────────────────

export async function searchSoldLines(params: {
  receiptNo?: number;
  saleId?: number;
  code?: string;
  date?: string;
}) {
  const { data } = await api.get('/returns/search', { params });
  return data as Array<{
    saleLineId: number;
    saleId: number;
    receiptNo: number;
    datetime: string;
    productName: string;
    productCode: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
    returnable: string;
  }>;
}

export async function createReturn(input: ReturnInput) {
  const { data } = await api.post('/returns', input);
  return data;
}

// ── Rewiz (SPEC §5.9) ─────────────────────────────────────────────────────────

export async function fetchSystemQty(productId: number) {
  const { data } = await api.get(`/revision/${productId}/system-qty`);
  return data as { productId: number; systemQty: string };
}

export async function createRevisionLine(input: RevisionLineInput) {
  const { data } = await api.post('/revision/lines', input);
  return data;
}

export async function listRevisionLines() {
  const { data } = await api.get('/revision');
  return data;
}

// ── Tükelleme (SPEC §5.9) ─────────────────────────────────────────────────────

export async function startStocktake() {
  const { data } = await api.post('/stocktake/start');
  return data as { id: number; status: string };
}

export async function scanStocktake(stocktakeId: number, input: StocktakeScanInput) {
  const { data } = await api.post(`/stocktake/${stocktakeId}/scan`, input);
  return data;
}

export async function finishStocktake(stocktakeId: number) {
  const { data } = await api.post(`/stocktake/${stocktakeId}/finish`);
  return data;
}

export async function getStocktake(stocktakeId: number) {
  const { data } = await api.get(`/stocktake/${stocktakeId}`);
  return data as {
    id: number;
    status: string;
    lines: Array<{
      id: number;
      productId: number;
      countedQty: string;
      systemQty: string;
      diff: string;
      product: { name: string; code: string };
    }>;
  };
}

// ── Ikinji dükan (SPEC §5.10/§6.11) ───────────────────────────────────────────

export async function createSecondShopSale(input: SecondShopSaleInput) {
  const { data } = await api.post('/second-shop/sales', input);
  return data;
}

export async function fetchSecondShopReport(from?: string, to?: string) {
  const { data } = await api.get('/second-shop/sales', { params: { from, to } });
  return data as {
    lines: Array<{
      id: number;
      saleId: number;
      receiptNo: number;
      datetime: string;
      productName: string;
      qty: string;
      unitPrice: string;
      lineTotal: string;
    }>;
    total: string;
  };
}

// ── Önüm / Recipes (SPEC §5.12/§6.6) ──────────────────────────────────────────

export async function listRecipes() {
  const { data } = await api.get('/recipes');
  return data;
}

export async function createRecipe(input: RecipeInput) {
  const { data } = await api.post('/recipes', input);
  return data;
}

export async function deleteRecipe(id: number) {
  await api.delete(`/recipes/${id}`);
}

// ── Gerekli harytlar ───────────────────────────────────────────────────────────

export async function listNeededProducts() {
  const { data } = await api.get('/needed-products');
  return data;
}

export async function createNeededProduct(input: NeededProductInput) {
  const { data } = await api.post('/needed-products', input);
  return data;
}

export async function deleteNeededProduct(id: number) {
  await api.delete(`/needed-products/${id}`);
}

// ── Hasabatlar / Dashboard (SPEC §5.13/§6.13) ────────────────────────────────

export async function fetchDashboardSummary(from?: string, to?: string) {
  const { data } = await api.get<DashboardSummary>('/reports/dashboard', { params: { from, to } });
  return data;
}

export async function fetchProfitByMonth(months = 12) {
  const { data } = await api.get<ProfitByMonth[]>('/reports/profit-by-month', {
    params: { months },
  });
  return data;
}

export async function fetchCategoryBreakdown(from?: string, to?: string) {
  const { data } = await api.get<CategoryBreakdown[]>('/reports/category-breakdown', {
    params: { from, to },
  });
  return data;
}

export async function rebuildDailySummary(from?: string, to?: string) {
  const { data } = await api.post('/reports/daily-summary/rebuild', { from, to });
  return data;
}

export interface SoldItemRow {
  id: number;
  productNameSnapshot: string;
  categoryNameSnapshot: string | null;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  product: { code: string };
  sale: { receiptNo: number; datetime: string };
}

export async function fetchSoldItems(params: {
  from?: string;
  to?: string;
  search?: string;
  category?: string;
  receiptNo?: number;
  paymentMethod?: PaymentMethod;
}) {
  const { data } = await api.get<SoldItemRow[]>('/reports/sold-items', { params });
  return data;
}

export interface ReceiptRow {
  id: number;
  receiptNo: number;
  datetime: string;
  total: string;
  paidCash: string;
  paidCard: string;
  paidDebt: string;
  cashier: { username: string };
  debtor: { name: string } | null;
}

export async function fetchReceipts(params: { from?: string; to?: string; receiptNo?: number }) {
  const { data } = await api.get<ReceiptRow[]>('/reports/receipts', { params });
  return data;
}

export interface LoginAuditRow {
  id: number;
  at: string;
  user: { username: string };
}

export async function fetchLoginAudit(params: { from?: string; to?: string }) {
  const { data } = await api.get<LoginAuditRow[]>('/reports/login-audit', { params });
  return data;
}

export interface DebtPaymentRow {
  id: number;
  datetime: string;
  amount: string;
  currency: string;
  note: string | null;
  debtor: { name: string };
}

export async function fetchDebtPaymentsReport(params: { from?: string; to?: string }) {
  const { data } = await api.get<DebtPaymentRow[]>('/reports/debt-payments', { params });
  return data;
}

export interface SupplierDebtMoveRow {
  id: number;
  txDate: string;
  type: string;
  amount: string;
  opening: string;
  closing: string;
  supplier: { name: string };
}

export async function fetchSupplierDebtMovesReport(params: { from?: string; to?: string }) {
  const { data } = await api.get<SupplierDebtMoveRow[]>('/reports/supplier-debt-moves', { params });
  return data;
}

// ── Ulanyjylar (SPEC §5.14) ───────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export async function listUsers() {
  const { data } = await api.get<UserRow[]>('/users');
  return data;
}

export async function createUser(input: CreateUserInput) {
  const { data } = await api.post<UserRow>('/users', input);
  return data;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const { data } = await api.put<UserRow>(`/users/${id}`, input);
  return data;
}

// ── Skidka (Discounts) ────────────────────────────────────────────────────────

export interface DiscountRow {
  method: PaymentMethod;
  percent: string;
}

export async function listDiscounts() {
  const { data } = await api.get<DiscountRow[]>('/discounts');
  return data;
}

export async function updateDiscount(method: PaymentMethod, input: UpdateDiscountInput) {
  const { data } = await api.put<DiscountRow>(`/discounts/${method}`, input);
  return data;
}

// ── Walýuta (Currency) ────────────────────────────────────────────────────────

export interface ExchangeRateRow {
  id: number;
  rate: string;
  effectiveFrom: string;
}

export async function fetchCurrentRate() {
  const { data } = await api.get<ExchangeRateRow | null>('/currency/current');
  return data;
}

export async function fetchRateHistory() {
  const { data } = await api.get<ExchangeRateRow[]>('/currency/history');
  return data;
}

export async function addExchangeRate(input: AddExchangeRateInput) {
  const { data } = await api.post<ExchangeRateRow>('/currency', input);
  return data;
}

// ── Lisenziýa (License) ───────────────────────────────────────────────────────

export async function activateLicense(input: ActivateLicenseInput) {
  const { data } = await api.post<LicenseStatus>('/license/activate', input);
  return data;
}

export async function rebindLicense() {
  const { data } = await api.post<LicenseStatus>('/license/rebind');
  return data;
}

// ── Ätiýaçlyk nusga (Backup) ──────────────────────────────────────────────────

export async function listBackups() {
  const { data } = await api.get<BackupFileInfo[]>('/backup');
  return data;
}

export async function createBackup() {
  const { data } = await api.post<BackupFileInfo>('/backup/create');
  return data;
}

export async function deleteBackup(filename: string) {
  await api.delete(`/backup/${filename}`);
}

export async function restoreBackup(file: File, password: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('password', password);
  await api.post('/backup/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } });
}
