import { describe, it, expect } from "vitest";
import {
  canOpenDirectUrl,
  canReadPlayerPhoto,
  canReadTeamMedia,
  isBucketPublic,
  ownerSegment,
  PLAYER_PHOTOS_BUCKET,
  TEAM_MEDIA_BUCKET,
} from "./photo-access";

const TEAM_A = "11111111-1111-1111-1111-111111111111";
const TEAM_B = "22222222-2222-2222-2222-222222222222";
const COACH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PLAYER_A = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const COACH_B = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ADMIN = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const photo = { path: `${COACH_A}/spelare-1.jpg`, teamId: TEAM_A };

const coachA = { userId: COACH_A, isAdmin: false, approvedTeamIds: [TEAM_A] };
const playerA = { userId: PLAYER_A, isAdmin: false, approvedTeamIds: [TEAM_A] };
const coachB = { userId: COACH_B, isAdmin: false, approvedTeamIds: [TEAM_B] };
const admin = { userId: ADMIN, isAdmin: true, approvedTeamIds: [] as string[] };
const anon = { userId: null, isAdmin: false, approvedTeamIds: [] as string[] };
const pendingA = { userId: "eeee", isAdmin: false, approvedTeamIds: [] as string[] };

describe("bucketar är privata", () => {
  it("varken player-photos eller team-media är publika", () => {
    expect(isBucketPublic(PLAYER_PHOTOS_BUCKET)).toBe(false);
    expect(isBucketPublic(TEAM_MEDIA_BUCKET)).toBe(false);
  });
});

describe("ownerSegment", () => {
  it("plockar första mappnivån", () => {
    expect(ownerSegment(`${COACH_A}/bild.jpg`)).toBe(COACH_A);
    expect(ownerSegment(`/${COACH_A}/bild.jpg`)).toBe(COACH_A);
  });
  it("returnerar null för filer i roten", () => {
    expect(ownerSegment("bild.jpg")).toBeNull();
  });
});

describe("canReadPlayerPhoto", () => {
  it("den som laddade upp bilden får läsa den", () => {
    expect(canReadPlayerPhoto(coachA, photo)).toEqual({ allowed: true, reason: "owner" });
  });

  it("godkänd medlem i rätt lag får läsa bilden", () => {
    expect(canReadPlayerPhoto(playerA, photo)).toEqual({ allowed: true, reason: "team-member" });
  });

  it("administratör får läsa bilden", () => {
    expect(canReadPlayerPhoto(admin, photo)).toEqual({ allowed: true, reason: "admin" });
  });

  it("inloggad användare i ett ANNAT lag nekas", () => {
    const res = canReadPlayerPhoto(coachB, photo);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("not-team-member");
  });

  it("inloggad användare utan lag nekas", () => {
    expect(canReadPlayerPhoto(pendingA, photo).allowed).toBe(false);
  });

  it("väntande (ej godkänd) medlem nekas – status pending ger inget approvedTeamId", () => {
    const pendingInTeamA = { userId: "ffff", isAdmin: false, approvedTeamIds: [] as string[] };
    expect(canReadPlayerPhoto(pendingInTeamA, photo).allowed).toBe(false);
  });

  it("utloggad användare nekas", () => {
    expect(canReadPlayerPhoto(anon, photo)).toEqual({ allowed: false, reason: "not-signed-in" });
  });

  it("bild utan kopplad spelare når bara ägaren och admin", () => {
    const orphan = { path: `${COACH_A}/gammal.jpg`, teamId: null, linkedToPlayer: false };
    expect(canReadPlayerPhoto(coachA, orphan).allowed).toBe(true); // ägare
    expect(canReadPlayerPhoto(admin, orphan).allowed).toBe(true);
    expect(canReadPlayerPhoto(playerA, orphan)).toEqual({ allowed: false, reason: "orphan-object" });
    expect(canReadPlayerPhoto(coachB, orphan).allowed).toBe(false);
  });

  it("byte av lag tar bort åtkomsten", () => {
    const moved = { ...photo, teamId: TEAM_B };
    expect(canReadPlayerPhoto(playerA, moved).allowed).toBe(false);
    expect(canReadPlayerPhoto(coachB, moved).allowed).toBe(true);
  });

  it("gissad sökväg i annans mapp ger ingen åtkomst", () => {
    const guessed = { path: `${COACH_B}/spelare-1.jpg`, teamId: TEAM_B };
    expect(canReadPlayerPhoto(playerA, guessed).allowed).toBe(false);
  });
});

describe("canReadTeamMedia", () => {
  it("godkänd lagmedlem får läsa lagbild", () => {
    expect(canReadTeamMedia(playerA, { path: `${TEAM_A}/lagbild.jpg` }).allowed).toBe(true);
  });
  it("annat lag nekas", () => {
    expect(canReadTeamMedia(coachB, { path: `${TEAM_A}/lagbild.jpg` }).allowed).toBe(false);
  });
  it("utloggad nekas", () => {
    expect(canReadTeamMedia(anon, { path: `${TEAM_A}/lagbild.jpg` }).allowed).toBe(false);
  });
  it("admin får läsa", () => {
    expect(canReadTeamMedia(admin, { path: `${TEAM_A}/lagbild.jpg` }).allowed).toBe(true);
  });
});

describe("direkta bild-URL:er", () => {
  const now = 1_700_000_000_000;

  it("osignerad direktlänk till privat bucket fungerar aldrig", () => {
    expect(canOpenDirectUrl({ bucket: PLAYER_PHOTOS_BUCKET, signed: false, now })).toBe(false);
    expect(canOpenDirectUrl({ bucket: TEAM_MEDIA_BUCKET, signed: false, now })).toBe(false);
  });

  it("signerad länk fungerar tills den går ut", () => {
    expect(
      canOpenDirectUrl({ bucket: PLAYER_PHOTOS_BUCKET, signed: true, expiresAt: now + 60_000, now }),
    ).toBe(true);
  });

  it("utgången signerad länk fungerar inte", () => {
    expect(
      canOpenDirectUrl({ bucket: PLAYER_PHOTOS_BUCKET, signed: true, expiresAt: now - 1, now }),
    ).toBe(false);
  });

  it("signerad länk utan utgångstid räknas som ogiltig", () => {
    expect(canOpenDirectUrl({ bucket: PLAYER_PHOTOS_BUCKET, signed: true, now })).toBe(false);
  });
});
