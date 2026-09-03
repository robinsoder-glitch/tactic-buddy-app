import { describe, expect, it } from "vitest";
import { changeNotice, changeReceipt, diffEvent } from "./event-changes";

describe("diffEvent", () => {
  it("hittar bara faktiska ändringar", () => {
    const changes = diffEvent(
      { starts_at: "2026-09-10T15:30:00Z", location: "Sportfältet" },
      { starts_at: "2026-09-10T16:00:00Z", location: "Sportfältet" },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.field).toBe("starts_at");
  });

  it("ignorerar fält som inte skickas med", () => {
    expect(diffEvent({ starts_at: "2026-09-10T15:30:00Z" }, {})).toEqual([]);
  });

  it("beskriver inställd status i klartext", () => {
    const changes = diffEvent({ cancelled_at: null }, { cancelled_at: "2026-09-04T10:00:00Z" });
    expect(changes[0]?.from).toBe("Aktiv");
    expect(changes[0]?.to).toBe("Inställd");
    expect(changeNotice(changes)).toBe("Aktiviteten är inställd.");
  });

  it("visar Saknas när ett värde är tomt", () => {
    const changes = diffEvent({ location: null }, { location: "Hallen" });
    expect(changes[0]?.from).toBe("Saknas");
    expect(changes[0]?.to).toBe("Hallen");
  });
});

describe("changeReceipt", () => {
  it("är sanningsenlig när inget ändrades", () => {
    expect(changeReceipt([])).toBe("Inget ändrades.");
  });

  it("räknar upp ändringarna", () => {
    const text = changeReceipt([
      { field: "location", label: "Plats", from: "A", to: "B" },
      { field: "meet_at", label: "Samlingstid", from: "17.00", to: "17.15" },
    ]);
    expect(text).toContain("Plats har ändrats från A till B.");
    expect(text).toContain("Samlingstid har ändrats från 17.00 till 17.15.");
  });
});
