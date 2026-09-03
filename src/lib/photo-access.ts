/**
 * Åtkomstmodell för spelarbilder och lagbilder i lagringen.
 *
 * Det här är en exakt spegling av RLS-reglerna på storage.objects så att vi
 * kan testa reglerna utan databas. Databasen är fortfarande den verkliga
 * spärren – den här modulen används för UI-beslut och för regressionstester.
 *
 * Regler (bucket player-photos, SELECT):
 *   1. Ägaren av filen (första mappnivån = auth.uid()) får läsa sin egen fil.
 *   2. Godkänd medlem i det lag som spelaren tillhör får läsa filen.
 *   3. Administratör får läsa filen.
 *   4. Alla andra – inklusive utloggade – får inte läsa filen.
 *
 * Båda bucketarna är privata. Det finns alltså ingen publik bild-URL: en
 * direktlänk till objektet kräver antingen giltig signerad URL eller en
 * inloggad användare som passerar reglerna ovan.
 */

export const PLAYER_PHOTOS_BUCKET = "player-photos";
export const TEAM_MEDIA_BUCKET = "team-media";

/** Ingen av bucketarna är publik – direkta objekt-URL:er fungerar inte. */
export const PUBLIC_BUCKETS: readonly string[] = [];

export type PhotoRequester = {
  /** null = utloggad (anon). */
  userId: string | null;
  isAdmin: boolean;
  /** Lag där användaren är godkänd medlem (spelare eller ledare). */
  approvedTeamIds: readonly string[];
};

export type PlayerPhotoObject = {
  /** Sökväg i bucketen, t.ex. "<uid>/<player>.jpg". */
  path: string;
  /** Laget som spelaren tillhör, null om spelaren saknar lag. */
  teamId: string | null;
  /** Finns raden i players med detta photo_path? */
  linkedToPlayer?: boolean;
};

/** Första mappnivån i sökvägen, motsvarar storage.foldername(name)[1]. */
export function ownerSegment(path: string): string | null {
  const clean = path.replace(/^\/+/, "");
  const parts = clean.split("/");
  return parts.length > 1 && parts[0] ? parts[0] : null;
}

export function isBucketPublic(bucket: string): boolean {
  return PUBLIC_BUCKETS.includes(bucket);
}

export type AccessDecision = {
  allowed: boolean;
  reason: "owner" | "team-member" | "admin" | "not-signed-in" | "not-team-member" | "orphan-object";
};

/** Motsvarar SELECT-policyerna på storage.objects för player-photos. */
export function canReadPlayerPhoto(
  requester: PhotoRequester,
  object: PlayerPhotoObject,
): AccessDecision {
  if (!requester.userId) return { allowed: false, reason: "not-signed-in" };

  if (ownerSegment(object.path) === requester.userId) {
    return { allowed: true, reason: "owner" };
  }

  if (requester.isAdmin) return { allowed: true, reason: "admin" };

  const linked = object.linkedToPlayer !== false;
  if (!linked || !object.teamId) {
    // Filen är inte kopplad till någon spelare med lag – ingen kan nå den
    // via lagregeln, bara ägaren och admin.
    return { allowed: false, reason: "orphan-object" };
  }

  if (requester.approvedTeamIds.includes(object.teamId)) {
    return { allowed: true, reason: "team-member" };
  }

  return { allowed: false, reason: "not-team-member" };
}

/** Motsvarar SELECT-policyn på storage.objects för team-media. */
export function canReadTeamMedia(
  requester: PhotoRequester,
  object: { path: string },
): AccessDecision {
  if (!requester.userId) return { allowed: false, reason: "not-signed-in" };
  const teamId = ownerSegment(object.path);
  if (teamId && requester.approvedTeamIds.includes(teamId)) {
    return { allowed: true, reason: "team-member" };
  }
  if (requester.isAdmin) return { allowed: true, reason: "admin" };
  return { allowed: false, reason: teamId ? "not-team-member" : "orphan-object" };
}

/**
 * En direkt bild-URL utan signatur går aldrig att öppna, eftersom bucketen är
 * privat. En signerad URL fungerar bara tills den går ut.
 */
export function canOpenDirectUrl(input: {
  bucket: string;
  signed: boolean;
  expiresAt?: number;
  now?: number;
}): boolean {
  if (isBucketPublic(input.bucket)) return true;
  if (!input.signed) return false;
  const now = input.now ?? Date.now();
  return typeof input.expiresAt === "number" ? input.expiresAt > now : false;
}
