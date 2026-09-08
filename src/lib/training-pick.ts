import {
  addDraftItem,
  emptyDraft,
  hasResource,
  loadDraft,
  storeDraft,
  type DraftKind,
} from "@/lib/training-draft";

/** Sökparametrar som håller ihop resan mellan planeringen och Träningsbanken. */
export type PickSearch = {
  eventId?: string | undefined;
  teamId?: string | undefined;
  /** Sparat träningspass som övningen ska läggas i. */
  sessionId?: string | undefined;
};

export function parsePickSearch(search: Record<string, unknown>): PickSearch {
  const eventId = search["eventId"];
  const teamId = search["teamId"];
  const sessionId = search["sessionId"];
  return {
    eventId: typeof eventId === "string" && eventId ? eventId : undefined,
    teamId: typeof teamId === "string" && teamId ? teamId : undefined,
    sessionId: typeof sessionId === "string" && sessionId ? sessionId : undefined,
  };
}

/** Sann när banken öppnats från en pågående träningsplanering. */
export function isPickMode(search: PickSearch): boolean {
  return Boolean(search.eventId || search.sessionId);
}

/** Lägger övningen i träningens utkast. Returnerar false om den redan finns. */
export function addPickToDraft(
  eventId: string,
  item: { kind: DraftKind; resourceId: string; title: string; minutes: number | null },
  options: { allowDuplicate?: boolean } = {},
): boolean {
  const draft = loadDraft(eventId) ?? emptyDraft(eventId);
  if (!options.allowDuplicate && hasResource(draft, item.resourceId)) return false;
  storeDraft(addDraftItem(draft, { ...item, note: null }));
  return true;
}
