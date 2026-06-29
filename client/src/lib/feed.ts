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
  // Open string so callers can pass arbitrary kinds (e.g. "workout", "pr",
  // "progress", "live") without TS gymnastics.
  kind: string;
  energyDelta: number;
  reactions: Record<string, number>;
  createdAt: number; // epoch ms
  squad?: string | null; // null/undefined = global (legacy)
}

const KEY_PREFIX = "flexin.feed:";
const MAX_ITEMS = 30;

// Squad isolation: every feed entry is bucketed under {email + squad}. When
// switching squads we never bleed members or activity across — each squad has
// its own feed bucket. Legacy entries without a squad live in the empty
// bucket and only render when no squad is active.
function keyFor(email: string, squad?: string | null): string {
  const base = `${KEY_PREFIX}${(email || "anon").toLowerCase()}`;
  if (!squad) return base;
  return `${base}:${squad.toLowerCase()}`;
}

export function getFeed(email: string, squad?: string | null): LocalFeedEvent[] {
  try {
    const raw = localStorage.getItem(keyFor(email, squad));
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
    Partial<Pick<LocalFeedEvent, "reactions" | "energyDelta" | "squad">>,
) {
  try {
    const squad = partial.squad || null;
    const existing = getFeed(email, squad);
    const event: LocalFeedEvent = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      createdAt: Date.now(),
      energyDelta: partial.energyDelta ?? 0,
      reactions: partial.reactions ?? {},
      userName: partial.userName,
      message: partial.message,
      kind: partial.kind,
      squad: squad,
    };
    const next = [event, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(keyFor(email, squad), JSON.stringify(next));
  } catch {
    // localStorage may be full or disabled — non-fatal.
  }
}

// Convert epoch ms → "minutesAgo" relative to now (clamped at 0).
export function minutesAgo(createdAt: number): number {
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
}
