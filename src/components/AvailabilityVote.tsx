import { useState } from "react";
import { productKey, type GroupedOffer } from "../lib/offers";
import { getVoterId, getMyVote, setMyVote, type VoteChoice } from "../utils/community";
import type { VoteTally } from "../hooks/useCommunityVotes";

// „Noch verfügbar?" – anonymes Daumen-hoch/runter je Angebot. Eine Stimme je
// Browser (localStorage-Voter-ID); optimistisches Update, Server bestätigt.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export function AvailabilityVote({ offer, tally }: { offer: GroupedOffer; tally?: VoteTally }) {
  const pk = productKey(offer);
  const [counts, setCounts] = useState<VoteTally>({ up: tally?.up ?? 0, down: tally?.down ?? 0 });
  const [mine, setMine] = useState<VoteChoice | null>(() => getMyVote(pk));

  function vote(choice: VoteChoice) {
    if (mine === choice) return; // schon so gestimmt
    // Optimistisch: alte Stimme (aus Server-Zählung) abziehen, neue addieren.
    setCounts((c) => ({
      up: c.up + (choice === "up" ? 1 : 0) - (mine === "up" ? 1 : 0),
      down: c.down + (choice === "down" ? 1 : 0) - (mine === "down" ? 1 : 0),
    }));
    setMine(choice);
    setMyVote(pk, choice);
    fetch(`${API_BASE}/api/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productKey: pk, vote: choice, voterId: getVoterId() }),
    }).catch(() => {
      /* Netzfehler ignorieren – die optimistische Anzeige bleibt, nicht kritisch. */
    });
  }

  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[0.76rem] font-semibold cursor-pointer ${
      active
        ? "bg-accent text-white border-accent"
        : "bg-surface text-muted border-border-strong hover:text-ink"
    }`;

  return (
    <div
      className="relative z-10 mt-2 flex items-center gap-2 text-[0.78rem]"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-muted">Noch verfügbar?</span>
      <button
        type="button"
        className={btn(mine === "up")}
        aria-pressed={mine === "up"}
        aria-label="Noch verfügbar"
        onClick={() => vote("up")}
      >
        <span aria-hidden="true">👍</span>
        <span className="tabular-nums">{counts.up}</span>
      </button>
      <button
        type="button"
        className={btn(mine === "down")}
        aria-pressed={mine === "down"}
        aria-label="Vergriffen"
        onClick={() => vote("down")}
      >
        <span aria-hidden="true">👎</span>
        <span className="tabular-nums">{counts.down}</span>
      </button>
    </div>
  );
}
