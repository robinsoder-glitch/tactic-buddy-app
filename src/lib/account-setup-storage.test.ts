import { beforeEach, describe, expect, it } from "vitest";
import { clearSetup, readSetup, readSetupForUser, storeSetup } from "./account-setup";

/**
 * Registreringsunderlaget i localStorage är bundet till registreringens
 * e-postadress, så att en avbruten registrering aldrig kan tillämpas på ett
 * annat konto som loggar in på samma enhet.
 */

const store = new Map<string, string>();

(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

beforeEach(() => store.clear());

describe("registreringsunderlagets e-postbindning", () => {
  const setup = { role: "player" as const, name: "Elias", code: "A1B2C3" };

  it("tillämpas när e-postadressen stämmer", () => {
    storeSetup(setup, "Elias@Example.com");
    expect(readSetupForUser("elias@example.com")).toEqual(setup);
  });

  it("tillämpas aldrig på ett annat konto", () => {
    storeSetup(setup, "elias@example.com");
    expect(readSetupForUser("maria@example.com")).toBeNull();
  });

  it("tillämpas inte utan e-postadress att kontrollera mot", () => {
    storeSetup(setup, "elias@example.com");
    expect(readSetupForUser(null)).toBeNull();
  });

  it("obundet underlag (Google) får fylla formulär men aldrig tillämpas automatiskt", () => {
    storeSetup(setup);
    expect(readSetup()).toEqual(setup);
    expect(readSetupForUser("elias@example.com")).toBeNull();
  });

  it("gammalt format utan e-postbindning används inte", () => {
    store.set("tt.account-setup", JSON.stringify(setup));
    expect(readSetup()).toBeNull();
    expect(readSetupForUser("elias@example.com")).toBeNull();
  });

  it("rensas helt", () => {
    storeSetup(setup, "elias@example.com");
    clearSetup();
    expect(readSetup()).toBeNull();
  });
});
