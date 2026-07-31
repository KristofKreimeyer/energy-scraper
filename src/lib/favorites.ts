import { useSyncExternalStore } from "react";

// Favorisierte Marken – rein clientseitig (localStorage), kein Konto/Worker
// nötig. Externer Store, damit alle Karten + der „Meine Marken"-Filter über
// useSyncExternalStore synchron reagieren, auch tab-übergreifend.

const KEY = "energyhunt:fav-brands";
type Listener = () => void;
const listeners = new Set<Listener>();

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let cache: string[] = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Speicher voll/blockiert – Favoriten bleiben dann nur für diese Session. */
  }
}

function emit() {
  for (const l of listeners) l();
}

// Änderungen aus anderen Tabs übernehmen.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = load();
      emit();
    }
  });
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getFavorites(): string[] {
  return cache;
}

export function isFavorite(brand: string): boolean {
  return cache.includes(brand);
}

export function toggleFavorite(brand: string) {
  cache = cache.includes(brand)
    ? cache.filter((b) => b !== brand)
    : [...cache, brand];
  persist();
  emit();
}

/** Reaktive Liste der favorisierten Marken. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, getFavorites, () => []);
}
