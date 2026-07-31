import { WRAP } from "../utils/helper";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { COMMUNITY_URL, COMMUNITY_LABEL } from "../lib/community-config";

// „Top-Hunter der Woche": öffentliches, spielerisches Ranking der aktivsten
// Beitragenden + Einladung in den Community-Kanal. Sozialer Beweis (andere sind
// aktiv) trifft Status-Anreiz (selbst nach oben klettern). Blendet sich aus,
// solange noch niemand oben steht – kein toter „leeres Board"-Zustand.

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const board = useLeaderboard();
  if (board.length === 0) return null;

  return (
    <section className={`${WRAP} mt-9`} aria-labelledby="leaderboard-title">
      <div className="glass-card rounded-card p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2
            id="leaderboard-title"
            className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-accent-strong"
          >
            🏆 Top-Hunter der Woche
          </h2>
          <span className="text-[0.75rem] text-muted">
            Punkte: freigegebene Meldung ×3 · Bestätigung ×1
          </span>
        </div>

        <ol className="mt-3 flex flex-col divide-y divide-border">
          {board.map((e) => (
            <li
              key={e.rank}
              className="flex items-center gap-3 py-2 text-[0.9rem]"
            >
              <span className="w-6 flex-none text-center font-mono font-bold tabular-nums">
                {MEDALS[e.rank - 1] ?? e.rank}
              </span>
              <span className="flex-1 font-semibold text-ink">{e.handle}</span>
              <span className="text-[0.78rem] text-muted tabular-nums">
                {e.approved}&nbsp;Funde · {e.votes}&nbsp;Checks
              </span>
              <span className="font-mono font-bold text-good tabular-nums w-12 text-right">
                {e.score}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-[0.85rem] text-muted">
          Klettere hoch: melde günstigere Preise und bestätige Angebote vor Ort.{" "}
          <button
            type="button"
            onClick={() => document.getElementById("account-trigger")?.click()}
            className="font-semibold text-accent-strong underline underline-offset-2 hover:text-accent"
          >
            Dein Sparfuchs-Level im Konto&nbsp;→
          </button>
        </p>

        <a
          href={COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-fill text-on-fill text-[0.85rem] font-semibold hover:opacity-90"
        >
          ⚡ Tritt der Jagd bei · {COMMUNITY_LABEL}
        </a>
      </div>
    </section>
  );
}
