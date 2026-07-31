import type { SortKey } from "../types";

// Zentrale Sortier-Optionen – genutzt vom Filter-Overlay.
export const SORT_OPTIONS: { value: SortKey; text: string }[] = [
  { value: "liter", text: "Grundpreis €/L (günstigste zuerst)" },
  { value: "price", text: "Dosenpreis (günstigste zuerst)" },
  { value: "savings", text: "Größte Ersparnis" },
  { value: "brand", text: "Marke A–Z" },
  { value: "ending", text: "Läuft bald ab" },
];
