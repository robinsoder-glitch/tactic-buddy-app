import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  dedupeKey,
  defaultPreference,
  isQuietTime,
  localMinutes,
  mergePreferences,
  minutesOfDay,
  planDelivery,
} from "./notifications";

describe("tider", () => {
  it("tolkar HH:mm", () => {
    expect(minutesOfDay("21:00")).toBe(1260);
    expect(minutesOfDay(" 7:05 ")).toBe(425);
    expect(minutesOfDay("trasig")).toBe(0);
  });

  it("räknar lokal tid i Europe/Stockholm", () => {
    // 2026-07-01 10:00 UTC = 12:00 svensk sommartid
    expect(localMinutes(new Date("2026-07-01T10:00:00Z"), "Europe/Stockholm")).toBe(12 * 60);
    // 2026-01-01 10:00 UTC = 11:00 svensk vintertid
    expect(localMinutes(new Date("2026-01-01T10:00:00Z"), "Europe/Stockholm")).toBe(11 * 60);
  });

  it("hanterar tyst tid över midnatt", () => {
    const settings = { ...DEFAULT_SETTINGS };
    expect(isQuietTime(new Date("2026-01-01T22:00:00Z"), settings)).toBe(true); // 23:00 lokalt
    expect(isQuietTime(new Date("2026-01-01T05:00:00Z"), settings)).toBe(true); // 06:00 lokalt
    expect(isQuietTime(new Date("2026-01-01T12:00:00Z"), settings)).toBe(false); // 13:00 lokalt
  });

  it("stänger av tyst tid när användaren valt bort den", () => {
    expect(isQuietTime(new Date("2026-01-01T22:00:00Z"), { ...DEFAULT_SETTINGS, quiet_enabled: false })).toBe(
      false,
    );
  });
});

describe("leverans", () => {
  const day = new Date("2026-01-01T12:00:00Z");
  const night = new Date("2026-01-01T22:30:00Z");

  it("skickar viktiga notiser direkt på dagen", () => {
    const plan = planDelivery("event_cancelled", defaultPreference("event_cancelled"), DEFAULT_SETTINGS, day);
    expect(plan.timing).toBe("now");
    expect(plan.inApp).toBe(true);
  });

  it("håller tillbaka under tyst tid", () => {
    const plan = planDelivery("event_changed", defaultPreference("event_changed"), DEFAULT_SETTINGS, night);
    expect(plan.timing).toBe("quiet");
  });

  it("släpper igenom viktigt när användaren tillåter det", () => {
    const plan = planDelivery("announcement", defaultPreference("announcement"), {
      ...DEFAULT_SETTINGS,
      important_bypass_quiet: true,
    }, night);
    expect(plan.timing).toBe("now");
  });

  it("samlar ihop övrigt i daglig sammanfattning", () => {
    const plan = planDelivery("invite_reminder", defaultPreference("invite_reminder"), DEFAULT_SETTINGS, day);
    expect(plan.timing).toBe("digest");
  });

  it("skickar aldrig push när push är avstängt globalt", () => {
    const preference = { ...defaultPreference("announcement"), push: true };
    expect(planDelivery("announcement", preference, DEFAULT_SETTINGS, day).push).toBe(false);
    expect(
      planDelivery("announcement", preference, { ...DEFAULT_SETTINGS, push_enabled: true }, day).push,
    ).toBe(true);
  });
});

describe("inställningar och dubbletter", () => {
  it("fyller på saknade slag med standardvärden", () => {
    const merged = mergePreferences([{ kind: "announcement", in_app: false }]);
    expect(merged.find((item) => item.kind === "announcement")?.in_app).toBe(false);
    expect(merged.find((item) => item.kind === "invite_reminder")?.in_app).toBe(true);
    expect(merged).toHaveLength(8);
  });

  it("skapar stabila dedupe-nycklar", () => {
    expect(dedupeKey(["event_changed", " ABC ", null, "V2"])).toBe("event_changed:abc:v2");
    expect(dedupeKey(["event_changed", "abc", "v2"])).toBe(dedupeKey(["Event_Changed", "ABC", "v2"]));
  });
});
