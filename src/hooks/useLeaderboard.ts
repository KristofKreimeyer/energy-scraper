import { useApiData } from "./useApiData";

// Öffentliches „Top-Hunter"-Leaderboard (maskierte Handles vom Worker).
// Optionales Beiwerk: bleibt leer, wenn der Dienst nicht erreichbar ist oder
// noch niemand Beiträge geleistet hat – die UI blendet sich dann komplett aus.

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  approved: number;
  votes: number;
  score: number;
}

const selectBoard = (j: unknown) => (j as { board?: LeaderboardEntry[] }).board;

export function useLeaderboard(): LeaderboardEntry[] {
  return useApiData<LeaderboardEntry[]>("/api/leaderboard", [], selectBoard);
}
