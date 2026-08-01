import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

// Generischer GET-Hook für optionale Community-Daten: lädt `path` (relativ zur
// API_BASE) einmal beim Mount, wählt via `select` den Wert aus der Antwort und
// liefert ihn – sonst `fallback`. Fehler werden still geschluckt (die Daten sind
// überall optionales Beiwerk; die UI blendet Leeres aus).
//
// Hinweis: `path` und `select` müssen stabile Referenzen sein (String-Literal
// bzw. modulweite Funktion), sonst würde der Fetch bei jedem Render neu laufen.
export function useApiData<T>(
  path: string,
  fallback: T,
  select: (json: unknown) => T | null | undefined,
): T {
  const [data, setData] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}${path}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive) return;
        const value = json == null ? null : select(json);
        if (value != null) setData(value);
      })
      .catch(() => {
        /* still schlucken */
      });
    return () => {
      alive = false;
    };
  }, [path, select]);
  return data;
}
