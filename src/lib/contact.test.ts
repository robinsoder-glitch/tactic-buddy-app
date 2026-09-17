import { describe, expect, it } from "vitest";
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_RATE_LIMIT,
  contactMessageSchema,
  nextContactRateBucket,
} from "@/lib/contact";

describe("contactMessageSchema", () => {
  const valid = {
    subject: "Fråga om kallelser",
    message: "Hej! Var hittar jag samlingstiden för lördagens match?",
  };

  it("accepterar ett giltigt meddelande", () => {
    expect(contactMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepterar ett klient-id för idempotens", () => {
    const parsed = contactMessageSchema.safeParse({
      ...valid,
      clientId: crypto.randomUUID(),
    });
    expect(parsed.success).toBe(true);
  });

  it("stoppar tomt eller för kort ämne", () => {
    expect(contactMessageSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valid, subject: "he" }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
  });

  it("stoppar för kort meddelande", () => {
    expect(contactMessageSchema.safeParse({ ...valid, message: "kort" }).success).toBe(false);
  });

  it("stoppar för långt meddelande", () => {
    const tooLong = "a".repeat(CONTACT_MESSAGE_MAX + 1);
    expect(contactMessageSchema.safeParse({ ...valid, message: tooLong }).success).toBe(false);
  });

  it("ger svenska felmeddelanden", () => {
    const result = contactMessageSchema.safeParse({ subject: "", message: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const issue of result.error.issues) {
        expect(issue.message).toMatch(/[åäöÅÄÖ]|tecken/);
      }
    }
  });
});

describe("nextContactRateBucket", () => {
  const now = 1_000_000;

  it("startar en ny period för första meddelandet", () => {
    expect(nextContactRateBucket(undefined, now)).toEqual({
      count: 1,
      resetAt: now + 3_600_000,
    });
  });

  it("räknar upp inom samma period", () => {
    const bucket = { count: 2, resetAt: now + 1000 };
    expect(nextContactRateBucket(bucket, now)).toEqual({ count: 3, resetAt: now + 1000 });
  });

  it("stoppar när gränsen är nådd", () => {
    const bucket = { count: CONTACT_RATE_LIMIT, resetAt: now + 1000 };
    expect(nextContactRateBucket(bucket, now)).toBeNull();
  });

  it("nollställer efter att perioden löpt ut", () => {
    const bucket = { count: CONTACT_RATE_LIMIT, resetAt: now - 1 };
    expect(nextContactRateBucket(bucket, now)).toEqual({
      count: 1,
      resetAt: now + 3_600_000,
    });
  });
});
