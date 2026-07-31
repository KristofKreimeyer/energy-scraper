import { useEffect, useState } from "react";

// Öffentliches „Top-Hunter"-Leaderboard (maskierte Handles vom Worker).
// Optionales Beiwerk: bleibt leer, wenn der Dienst nicht erreichbar ist oder
// noch niemand Beiträge geleistet hat – die UI blendet sich dann komplett aus.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  approved: number;
  votes: number;
  score: number;
}

export function useLeaderboard(): LeaderboardEntry[] {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { board?: LeaderboardEntry[] } | null) => {
        if (alive && data?.board) setBoard(data.board);
      })
      .catch(() => {
        /* still schlucken – optionales Feature */
      });
    return () => {
      alive = false;
    };
  }, []);
  return board;
}
