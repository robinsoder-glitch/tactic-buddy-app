import type { Frame } from "@/lib/tactics";

/**
 * Persistent undo/redo history for the tactic editor.
 * Snapshots are stored per tactic in localStorage so the user can keep undoing
 * after a page reload.
 */

export type HistoryEntry = { label: string; frames: Frame[]; at: number };

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

const MAX_ENTRIES = 30;
const VERSION = 1;

function key(tacticId: string) {
  return `taktik:history:v${VERSION}:${tacticId}`;
}

export function emptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function loadHistory(tacticId: string): HistoryState {
  if (typeof window === "undefined") return emptyHistory();
  try {
    const raw = window.localStorage.getItem(key(tacticId));
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw) as Partial<HistoryState>;
    const clean = (list: unknown): HistoryEntry[] =>
      Array.isArray(list)
        ? (list as HistoryEntry[])
            .filter((entry) => entry && Array.isArray(entry.frames) && entry.frames.length > 0)
            .slice(-MAX_ENTRIES)
        : [];
    return { past: clean(parsed.past), future: clean(parsed.future) };
  } catch {
    return emptyHistory();
  }
}

export function saveHistory(tacticId: string, state: HistoryState) {
  if (typeof window === "undefined") return;
  const trimmed: HistoryState = {
    past: state.past.slice(-MAX_ENTRIES),
    future: state.future.slice(0, MAX_ENTRIES),
  };
  try {
    window.localStorage.setItem(key(tacticId), JSON.stringify(trimmed));
  } catch {
    // Quota exceeded – keep only the most recent snapshots
    try {
      window.localStorage.setItem(
        key(tacticId),
        JSON.stringify({ past: trimmed.past.slice(-5), future: [] }),
      );
    } catch {
      /* history is best-effort */
    }
  }
}

export function clearHistory(tacticId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(tacticId));
  } catch {
    /* ignore */
  }
}

export function entry(label: string, frames: Frame[]): HistoryEntry {
  return { label, frames, at: Date.now() };
}
