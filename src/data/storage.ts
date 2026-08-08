import type { AppState } from './schema'
import { SCHEMA_VERSION, STORAGE_KEY } from './schema'

/**
 * Häzir localStorage ulanylýar. Backend ýa-da IndexedDB-e geçilende diňe şu
 * modul çalşylmaly — galan kod `AppState` bilen işleýär.
 */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isAppState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    // Kwota dolan ýa-da brauzer gadagan eden bolsa — satyşy togtatmaýarys.
    console.error('CozgutPos: ýatda saklap bolmady', error)
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AppState>
  return (
    candidate.version === SCHEMA_VERSION &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.orders) &&
    typeof candidate.settings === 'object' &&
    candidate.settings !== null &&
    typeof candidate.receiptCounter === 'object' &&
    candidate.receiptCounter !== null
  )
}
