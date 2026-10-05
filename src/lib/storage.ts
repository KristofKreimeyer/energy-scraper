// localStorage-Zugriff, der nie wirft (privater Modus, blockierter/voller
// Speicher). Lesen liefert dann `null`/den Fallback, Schreiben wird still
// ignoriert – alle Aufrufer behandeln den Speicher ohnehin nur als Komfort.

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* Storage nicht verfügbar */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* Storage nicht verfügbar */
    }
  },
  /** JSON lesen; bei fehlendem/defektem Eintrag `fallback`. */
  getJSON<T>(key: string, fallback: T): T {
    const raw = storage.get(key)
    if (raw == null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  setJSON(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value))
  },
}
