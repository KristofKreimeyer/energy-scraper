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
      <span className="uppercase tracking-[0.08em]">{o.brand}</span>{" "}
      <b className="text-accent-strong">{formatNumber(o.perLiter!)} €/L</b>{" "}
      <span className="text-muted">{o.market}</span>
    </span>
  ));

  return (
    <div className="app-ticker border-b border-border overflow-hidden" aria-hidden="true">
      <div className="ticker-track py-2 text-[0.76rem] font-mono text-muted">
        <span className="mr-2 font-semibold text-accent-strong">⚡ Live €/L</span>
        {row}
        <span className="mr-2 font-semibold text-accent-strong">⚡ Live €/L</span>
        {row}
      </div>
    </div>
  );
}
