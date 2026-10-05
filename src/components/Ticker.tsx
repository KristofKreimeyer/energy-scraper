import { formatNumber, type GroupedOffer } from "../lib/offers";

// Live-Preis-Ticker: die günstigsten €/L der Woche als laufendes Band.
// Rein dekorativ (aria-hidden) – die Daten stehen barrierefrei in den Karten.
// Blendet sich bei reduzierter Motion via .app-ticker komplett aus.
export default function Ticker({ offers }: { offers: GroupedOffer[] }) {
  const items = offers
    .filter((o) => o.perLiter != null)
    .sort((a, b) => a.perLiter! - b.perLiter!)
    .slice(0, 12);
  if (items.length === 0) return null;

  const row = items.map((o) => (
    <span key={o.id} className="mx-4">
      <span className="uppercase tracking-[0.04em]">{o.brand}</span> <b>{formatNumber(o.perLiter!)} €/L</b>{" "}
      <span className="opacity-80">{o.market}</span>
    </span>
  ));

  return (
    <div className="app-ticker ticker-band overflow-hidden" aria-hidden="true">
      <div className="ticker-track py-2 text-[1rem] font-mono font-bold">
        <span className="mr-2 font-bold">⚡ Live €/L</span>
        {row}
        <span className="mr-2 font-bold">⚡ Live €/L</span>
        {row}
      </div>
    </div>
  );
}
