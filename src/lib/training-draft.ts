/**
 * Utkast för en träningsplanering.
 * Övningar hamnar först i utkastet – den publicerade planen ändras först vid Spara.
 * Utkastet lagras i sessionStorage så det överlever en resa till Träningsbanken.
 */
export type DraftKind = "drill" | "goalkeeper" | "session";

export type DraftItem = {
  /** Eget id per rad, så samma övning kan finnas flera gånger. */
  key: string;
  kind: DraftKind;
  resourceId: string;
  title: string;
  minutes: number | null;
  note: string | null;
};

export type TrainingDraft = {
  eventId: string;
  notes: string;
  items: DraftItem[];
};

export function emptyDraft(eventId: string): TrainingDraft {
  return { eventId, notes: "", items: [] };
}

export function draftKey(): string {
  return `d-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function addDraftItem(draft: TrainingDraft, item: Omit<DraftItem, "key">): TrainingDraft {
  return { ...draft, items: [...draft.items, { ...item, key: draftKey() }] };
}

export function hasResource(draft: TrainingDraft, resourceId: string): boolean {
  return draft.items.some((item) => item.resourceId === resourceId);
}

export function removeDraftItem(draft: TrainingDraft, key: string): TrainingDraft {
  return { ...draft, items: draft.items.filter((item) => item.key !== key) };
}

export function updateDraftItem(
  draft: TrainingDraft,
  key: string,
  patch: Partial<DraftItem>,
): TrainingDraft {
  return {
    ...draft,
    items: draft.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
  };
}

/** Flyttar en rad ett steg upp (-1) eller ner (1). */
export function moveDraftItem(
  draft: TrainingDraft,
  index: number,
  direction: -1 | 1,
): TrainingDraft {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= draft.items.length) return draft;
  const items = [...draft.items];
  const [row] = items.splice(index, 1);
  items.splice(target, 0, row!);
  return { ...draft, items };
}

export function draftMinutes(draft: TrainingDraft): number {
  return draft.items.reduce((total, item) => total + (item.minutes ?? 0), 0);
}

/** Payload till databasfunktionen som sparar hela planen i en transaktion. */
export function draftPayload(draft: TrainingDraft) {
  return draft.items.map((item) => ({
    kind: item.kind,
    resource_id: item.resourceId,
    minutes: item.minutes,
    note: item.note,
  }));
}

const PREFIX = "traningsutkast:";

export function loadDraft(eventId: string): TrainingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + eventId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrainingDraft;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return { eventId, notes: parsed.notes ?? "", items: parsed.items };
  } catch {
    return null;
  }
}

export function storeDraft(draft: TrainingDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + draft.eventId, JSON.stringify(draft));
  } catch {
    /* utrymme saknas – utkastet finns kvar i minnet */
  }
}

export function clearDraft(eventId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PREFIX + eventId);
}
