import { useEffect, useState } from "react";
import { WRAP } from "../utils/helper";
import { MARKET_CANDIDATES, getMyMarketVote, voteMarket } from "../lib/marketVote";

// Community-Roadmap: Nutzer stimmen ab, welchen Supermarkt wir als Nächstes
// aufnehmen. Bindet die Community ein UND liefert echte Priorisierungs-Daten.
// Optimistisches Update; eine Stimme je Browser (Wechsel erlaubt).

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export default function MarketVote() {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [candidates, setCandidates] = useState<string[]>(MARKET_CANDIDATES);
  const [mine, setMine] = useState<string | null>(() => getMyMarketVote());

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/market-votes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { candidates?: string[]; votes?: Record<string, number> } | null) => {
        if (!alive || !d) return;
        setVotes(d.votes ?? {});
        if (Array.isArray(d.candidates) && d.candidates.length) setCandidates(d.candidates);
      })
      .catch(() => {
        /* optionales Beiwerk – still schlucken */
      });
    return () => {
      alive = false;
    };
  }, []);

  function pick(market: string) {
    if (mine === market) return;
    setVotes((v) => {
      const next = { ...v };
      if (mine) next[mine] = Math.max(0, (next[mine] ?? 1) - 1);
      next[market] = (next[market] ?? 0) + 1;
      return next;
    });
    setMine(market);
    voteMarket(market);
  }

  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const ranked = [...candidates].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0));

  return (
    <section className={`${WRAP} mt-9`} aria-labelledby="market-vote-title">
      <div className="glass-card rounded-card p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2
            id="market-vote-title"
            className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-accent-strong"
          >
            🗳 Welcher Markt als Nächstes?
          </h2>
          <span className="text-[0.75rem] text-muted">
            {total} {total === 1 ? "Stimme" : "Stimmen"}
          </span>
        </div>
        <p className="mt-1 text-[0.85rem] text-muted">
          Stimm ab, welchen Supermarkt wir als Nächstes aufnehmen – die
          meistgewählten kommen zuerst dran.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {ranked.map((market) => {
            const count = votes[market] ?? 0;
            const pct = total ? Math.round((count / total) * 100) : 0;
            const active = mine === market;
            return (
              <li key={market}>
                <button
                  type="button"
                  onClick={() => pick(market)}
                  aria-pressed={active}
                  className={`relative w-full h-11 rounded-lg border overflow-hidden text-left cursor-pointer transition-colors duration-150 ${
                    active
                      ? "border-accent-strong"
                      : "border-border-strong hover:border-accent"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 ${active ? "bg-accent-tint" : "bg-surface-2"}`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex items-center justify-between h-full px-3 gap-2">
                    <span className="font-semibold text-ink text-[0.9rem] inline-flex items-center gap-1.5">
                      {active && <span aria-hidden="true" className="text-accent-strong">✓</span>}
                      {market}
                    </span>
                    <span className="font-mono text-[0.8rem] tabular-nums text-muted">
                      {count} · {pct}%
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[0.8rem] text-muted" role="status">
          {mine
            ? `Danke! Du hast für ${mine} gestimmt – tippe eine andere Option, um zu wechseln.`
            : "Deine Stimme zählt anonym, eine pro Gerät."}
        </p>
      </div>
    </section>
  );
}
