// ── Local Squad Feed ─────────────────────────────────────────────────────────
// Lightweight, client-side activity feed keyed by user email. We use this
// because the server's /api/dashboard squadFeed still returns an empty array,
// and squads themselves live in localStorage today. As squad activity becomes
// server-side (group_activity table etc.) this file can be swapped to read
// from the API instead — the consumers only call getFeed()/pushFeedEvent().

export interface LocalFeedEvent {
  id: number;
  userName: string;
  message: string;
  kind: "squad_created" | "workout_logged" | "milestone" | "generic";
  energyDelta: number;
  reactions: Record<string, number>;
  createdAt: number; // epoch ms
}

const KEY_PREFIX = "flexin.feed:";
const MAX_ITEMS = 30;

function keyFor(email: string): string {
  return `${KEY_PREFIX}${(email || "anon").toLowerCase()}`;
}

export function getFeed(email: string): LocalFeedEvent[] {
  try {
    const raw = localStorage.getItem(keyFor(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalFeedEvent[];
  } catch {
    return [];
  }
}

export function pushFeedEvent(
  email: string,
  partial: Omit<LocalFeedEvent, "id" | "createdAt" | "reactions" | "energyDelta"> &
    Partial<Pick<LocalFeedEvent, "reactions" | "energyDelta">>,
) {
  try {
    const existing = getFeed(email);
    const event: LocalFeedEvent = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      createdAt: Date.now(),
      energyDelta: partial.energyDelta ?? 0,
      reactions: partial.reactions ?? {},
      userName: partial.userName,
      message: partial.message,
      kind: partial.kind,
    };
    const next = [event, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(keyFor(email), JSON.stringify(next));
  } catch {
    // localStorage may be full or disabled — non-fatal.
  }
}

// Convert epoch ms → "minutesAgo" relative to now (clamped at 0).
export function minutesAgo(createdAt: number): number {
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
}
