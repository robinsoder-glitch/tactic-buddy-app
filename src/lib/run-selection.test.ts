import { describe, expect, it } from "vitest";
import { pickRunEventLink, type SessionEventLink } from "./event-planning";
import { isPrivateAddress } from "./match-import.functions";

const now = Date.parse("2026-09-14T12:00:00.000Z");

function link(id: string, startsAt: string): SessionEventLink {
  return {
    id,
    event_id: `ev-${id}`,
    session_id: "s1",
    starts_at: startsAt,
    type: "training",
    title: null,
    team_id: "t1",
  };
}

describe("val av aktivitet vid start av träning", () => {
  it("väljer närmast kommande aktivitet", () => {
    const picked = pickRunEventLink(
      [
        link("sen", "2026-09-20T17:00:00.000Z"),
        link("snart", "2026-09-14T17:00:00.000Z"),
        link("gammal", "2026-09-01T17:00:00.000Z"),
      ],
      now,
    );
    expect(picked?.id).toBe("snart");
  });

  it("väljer nyss passerad aktivitet när inget är kvar", () => {
    const picked = pickRunEventLink([link("igar", "2026-09-14T06:00:00.000Z")], now);
    expect(picked?.id).toBe("igar");
  });

  it("kopplar inte mot en aktivitet långt bak i tiden", () => {
    expect(pickRunEventLink([link("gammal", "2026-08-01T17:00:00.000Z")], now)).toBeNull();
  });

  it("hanterar saknade datum", () => {
    expect(pickRunEventLink([link("utan", "")], now)).toBeNull();
    expect(pickRunEventLink([], now)).toBeNull();
  });
});

describe("privata nätverksadresser", () => {
  it("stoppar interna adresser", () => {
    for (const address of [
      "10.0.0.5",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.4.1",
      "192.168.1.1",
      "::1",
      "fd00::1",
      "fe80::1",
    ]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it("släpper igenom publika adresser", () => {
    for (const address of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:2800:220::1"]) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });
});
