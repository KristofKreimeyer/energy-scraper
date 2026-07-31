import type { SortKey } from "../types";

// Zentrale Sortier-Optionen – genutzt vom Filter-Overlay (Langtext) und vom
// Sort-Dropdown der ControlsBar (Kurztext, damit die Leiste kompakt bleibt).
export const SORT_OPTIONS: { value: SortKey; text: string; short: string }[] = [
  { value: "liter", text: "Grundpreis €/L (günstigste zuerst)", short: "Grundpreis €/L" },
  { value: "price", text: "Dosenpreis (günstigste zuerst)", short: "Dosenpreis" },
  { value: "savings", text: "Größte Ersparnis", short: "Größte Ersparnis" },
  { value: "brand", text: "Marke A–Z", short: "Marke A–Z" },
  { value: "ending", text: "Läuft bald ab", short: "Läuft bald ab" },
];
