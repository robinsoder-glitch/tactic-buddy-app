/** Lokal markering av genomförda block i ett träningspass (sparas i webbläsaren). */
const KEY = "taktiktavlan.session-progress.v1";

export type SessionProgress = Record<string, number[]>;

function read(): SessionProgress {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as SessionProgress;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(value: SessionProgress) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function loadProgress(): SessionProgress {
  return read();
}

export function toggleBlock(progress: SessionProgress, sessionId: string, order: number): SessionProgress {
  const current = progress[sessionId] ?? [];
  const next = current.includes(order) ? current.filter((item) => item !== order) : [...current, order].sort((a, b) => a - b);
  const updated = { ...progress, [sessionId]: next };
  if (next.length === 0) delete updated[sessionId];
  write(updated);
  return updated;
}

export function resetSession(progress: SessionProgress, sessionId: string): SessionProgress {
  const updated = { ...progress };
  delete updated[sessionId];
  write(updated);
  return updated;
}

export function doneCount(progress: SessionProgress, sessionId: string): number {
  return (progress[sessionId] ?? []).length;
}
