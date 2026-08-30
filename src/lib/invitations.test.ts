import { describe, expect, it } from "vitest";
import {
  INVITE_STATUS_LABELS,
  INVITE_STATUSES,
  NO_ACCOUNT_TEXT,
  NO_REMINDER_TEXT,
  canRespondSelf,
  countInvitations,
  expectedAttendance,
  inviteStatusLabel,
} from "./invitations";

describe("kallelser – status och texter", () => {
  it("visar svenska texter för alla fyra statusar", () => {
    expect(INVITE_STATUSES).toEqual(["attending", "declined", "maybe", "pending"]);
    expect(INVITE_STATUS_LABELS).toEqual({
      pending: "Ej svarat",
      attending: "Kommer",
      declined: "Kommer inte",
      maybe: "Kanske",
    });
  });

  it("visar aldrig tekniska statusvärden i gränssnittstexten", () => {
    const shown = Object.values(INVITE_STATUS_LABELS).join(" ").toLowerCase();
    for (const technical of INVITE_STATUSES) expect(shown).not.toContain(technical);
  });

  it("faller tillbaka på Ej svarat vid okänt eller saknat värde", () => {
    expect(inviteStatusLabel(null)).toBe("Ej svarat");
    expect(inviteStatusLabel(undefined)).toBe("Ej svarat");
    expect(inviteStatusLabel("nagot_annat")).toBe("Ej svarat");
  });
});

describe("kallelser – sammanräkning", () => {
  const list = [
    { status: "attending" },
    { status: "attending" },
    { status: "declined" },
    { status: "maybe" },
    { status: "pending" },
  ];

  it("räknar grupperna korrekt", () => {
    expect(countInvitations(list)).toEqual({
      attending: 2,
      declined: 1,
      maybe: 1,
      pending: 1,
      total: 5,
    });
  });

  it("uppdaterar sammanräkningen när ett svar ändras", () => {
    const updated = list.map((item, index) => (index === 4 ? { status: "attending" } : item));
    const counts = countInvitations(updated);
    expect(counts.pending).toBe(0);
    expect(counts.attending).toBe(3);
    expect(expectedAttendance(counts)).toBe(3);
  });

  it("räknar tom kallelse till noll", () => {
    expect(countInvitations([])).toEqual({ attending: 0, declined: 0, maybe: 0, pending: 0, total: 0 });
  });
});

describe("kallelser – behörighet att svara själv", () => {
  it("tillåter svar när spelaren är kopplad till användarens konto", () => {
    expect(canRespondSelf({ memberUserId: "user-1" }, "user-1")).toBe(true);
  });

  it("hindrar en användare från att svara för en annan spelare", () => {
    expect(canRespondSelf({ memberUserId: "user-2" }, "user-1")).toBe(false);
  });

  it("hindrar svar när spelaren saknar kopplat konto", () => {
    expect(canRespondSelf({ memberUserId: null }, "user-1")).toBe(false);
    expect(NO_ACCOUNT_TEXT).toContain("saknar kopplat konto");
    expect(NO_REMINDER_TEXT).toContain("saknar kopplat konto");
  });

  it("hindrar utloggad användare", () => {
    expect(canRespondSelf({ memberUserId: "user-1" }, null)).toBe(false);
  });
});

describe("kallelser – inga externa utskick i etapp 1", () => {
  it("kallelsemodulen anropar inga externa tjänster för mejl, SMS eller push", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(new URL("./invitations.ts", import.meta.url), "utf8");
    for (const forbidden of ["resend", "twilio", "sendgrid", "firebase", "sendMail", "pushNotification", "fetch("]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
