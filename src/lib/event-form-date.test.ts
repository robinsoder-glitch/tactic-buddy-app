import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasErrors, scheduleFromFormData, splitLocal, validateEventTimes } from "./event-datetime";

const read = (path: string) => readFileSync(path, "utf8");

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

describe("datum följer med när aktiviteten sparas", () => {
  it("datumrutan skickar vidare fältnamnet till inmatningen", () => {
    const field = read("src/components/DateField.tsx");
    expect(field).toContain("name?: string");
    expect(field).toContain("{...(name ? { name } : {})}");
  });

  it("aktivitetsformuläret namnger datumrutan", () => {
    const manager = read("src/components/EventManager.tsx");
    expect(manager).toContain('name="date"');
    expect(manager).toContain("scheduleFromFormData(submitted");
  });

  it("läser datum och tider för en ny träning", () => {
    const schedule = scheduleFromFormData(
      form({ date: "2026-09-10", start: "17:30", end: "19:00" }),
      { isMatch: false },
    );
    expect(schedule).toEqual({ date: "2026-09-10", start: "17:30", end: "19:00", meet: "" });
    expect(hasErrors(validateEventTimes(schedule))).toBe(false);
  });

  it("läser samlingstid för en ny match men inte för träning", () => {
    const values = { date: "2026-09-12", start: "11:00", end: "12:30", meet: "10:15" };
    expect(scheduleFromFormData(form(values), { isMatch: true }).meet).toBe("10:15");
    expect(scheduleFromFormData(form(values), { isMatch: false }).meet).toBe("");
  });

  it("behåller datumet när en befintlig aktivitet redigeras", () => {
    const saved = "2026-09-10T15:30:00.000Z";
    const start = splitLocal(saved);
    const schedule = scheduleFromFormData(form({ date: start.date, start: start.time }), {
      isMatch: false,
    });
    expect(schedule.date).toBe(start.date);
    expect(hasErrors(validateEventTimes(schedule))).toBe(false);
  });

  it("ger ett tydligt fel när datumet saknas", () => {
    const schedule = scheduleFromFormData(form({ start: "17:00" }), { isMatch: false });
    expect(schedule.date).toBe("");
    expect(validateEventTimes(schedule).date).toBe("Välj ett datum.");
  });

  it("snabbvalen finns kvar i datumrutan", () => {
    const field = read("src/components/DateField.tsx");
    expect(field).toContain("Idag");
    expect(field).toContain("Imorgon");
    expect(field).toContain("Om en vecka");
  });
});
