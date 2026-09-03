import { describe, expect, it } from "vitest";
import {
  combineLocal,
  hasErrors,
  splitDateTimeLocal,
  splitLocal,
  toIso,
  validateEventTimes,
} from "./event-datetime";

describe("datum och tid för träningar och matcher", () => {
  it("accepterar ett giltigt datum och klockslag för träning", () => {
    const errors = validateEventTimes({ date: "2026-09-05", start: "17:00", end: "18:30" });
    expect(hasErrors(errors)).toBe(false);
    expect(toIso("2026-09-05", "17:00")).toBeTruthy();
  });

  it("accepterar ett giltigt datum och klockslag för match med samling", () => {
    const errors = validateEventTimes({
      date: "2026-09-12",
      start: "13:00",
      end: "15:00",
      meet: "12:15",
    });
    expect(hasErrors(errors)).toBe(false);
  });

  it("ger ett begripligt fel när datumet saknas", () => {
    const errors = validateEventTimes({ date: "", start: "17:00" });
    expect(errors.date).toBe("Välj ett datum.");
    expect(errors.date).not.toMatch(/Ange datum och starttid/);
  });

  it("ger ett begripligt fel när starttiden saknas", () => {
    const errors = validateEventTimes({ date: "2026-09-05", start: "" });
    expect(errors.start).toBe("Ange en starttid.");
  });

  it("visar inget fel alls när datum och starttid är ifyllda", () => {
    const errors = validateEventTimes({ date: "2026-09-05", start: "17:00" });
    expect(errors.date).toBeUndefined();
    expect(errors.start).toBeUndefined();
    expect(Object.values(errors)).toHaveLength(0);
  });

  it("låter sluttiden vara frivillig", () => {
    expect(hasErrors(validateEventTimes({ date: "2026-09-05", start: "17:00", end: "" }))).toBe(
      false,
    );
  });

  it("klagar vid rätt fält när sluttiden är före starttiden", () => {
    const errors = validateEventTimes({ date: "2026-09-05", start: "17:00", end: "16:00" });
    expect(errors.end).toBe("Sluttiden måste vara efter starttiden.");
    expect(errors.start).toBeUndefined();
  });

  it("konverterar till databasformat först vid sparning och behåller lokal tid", () => {
    const iso = toIso("2026-09-05", "17:00")!;
    expect(new Date(iso).getHours()).toBe(17);
    expect(splitLocal(iso)).toEqual({ date: "2026-09-05", time: "17:00" });
  });

  it("tappar inte värdet vid tidszonskonvertering runt årsskiftet", () => {
    const iso = toIso("2027-01-01", "00:30")!;
    expect(iso).not.toBe("");
    expect(splitLocal(iso)).toEqual({ date: "2027-01-01", time: "00:30" });
  });

  it("returnerar null för ofullständiga värden i stället för ogiltigt datum", () => {
    expect(combineLocal("2026-09-05", "")).toBeNull();
    expect(combineLocal("", "17:00")).toBeNull();
    expect(toIso("2026-13-40", "17:00")).toBeNull();
  });

  it("kan läsa in ett äldre datetime-local-värde", () => {
    expect(splitDateTimeLocal("2026-09-05T17:00")).toEqual({ date: "2026-09-05", time: "17:00" });
  });

  it("ger tomma fält när en sparad aktivitet saknar sluttid", () => {
    expect(splitLocal(null)).toEqual({ date: "", time: "" });
  });
});
