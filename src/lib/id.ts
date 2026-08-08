/** Ýerli ulgam üçin ýeterlik unikal id. Backend goşulanda serwer id-si ulanylar. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
