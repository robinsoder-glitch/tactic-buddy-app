import { describe, expect, it } from "vitest";
import { isPickMode, parsePickSearch } from "./training-pick";

describe("plockläge mellan planering och träningsbank", () => {
  it("läser aktivitet, lag och träningspass ur adressen", () => {
    expect(parsePickSearch({ eventId: "e1", teamId: "t1", sessionId: "s1" })).toEqual({
      eventId: "e1",
      teamId: "t1",
      sessionId: "s1",
    });
  });

  it("ignorerar tomma och felaktiga värden", () => {
    expect(parsePickSearch({ eventId: "", sessionId: 5 })).toEqual({
      eventId: undefined,
      teamId: undefined,
      sessionId: undefined,
    });
  });

  it("är plockläge både från aktivitet och från sparat pass", () => {
    expect(isPickMode({ eventId: "e1" })).toBe(true);
    expect(isPickMode({ sessionId: "s1" })).toBe(true);
    expect(isPickMode({})).toBe(false);
  });
});
