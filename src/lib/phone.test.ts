import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, phoneError } from "./phone";

describe("normalizePhone", () => {
  it("gör om svenska nummer till E.164", () => {
    expect(normalizePhone("070-123 45 67")).toBe("+46701234567");
    expect(normalizePhone("0701234567")).toBe("+46701234567");
    expect(normalizePhone("08 123 456")).toBe("+4608123456".replace("+460", "+46"));
  });

  it("behåller internationella nummer", () => {
    expect(normalizePhone("+46 70 123 45 67")).toBe("+46701234567");
    expect(normalizePhone("0046701234567")).toBe("+46701234567");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
  });

  it("nekar ogiltiga nummer", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("070123")).toBeNull();
    expect(normalizePhone("+0701234567")).toBeNull();
  });
});

describe("phoneError", () => {
  it("tillåter tomt fält", () => {
    expect(phoneError("")).toBeNull();
    expect(phoneError("   ")).toBeNull();
  });

  it("flaggar bokstäver och felaktiga nummer", () => {
    expect(phoneError("ring mig")).toContain("siffror");
    expect(phoneError("123")).toContain("giltigt");
    expect(phoneError("070-123 45 67")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("visar svenska mobilnummer läsbart", () => {
    expect(formatPhone("+46701234567")).toBe("070-123 45 67");
  });

  it("returnerar tomt för saknat nummer", () => {
    expect(formatPhone(null)).toBe("");
  });
});
