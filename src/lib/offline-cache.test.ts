import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_VERSION,
  cacheKey,
  clearOfflineData,
  clearOtherUsers,
  readCache,
  savedAtLabel,
  writeCache,
} from "./offline-cache";

beforeEach(() => {
  window.localStorage.clear();
});

describe("offline-cache", () => {
  it("sparar och läser per användare", () => {
    writeCache("user-1", "upcoming", [{ id: "a" }]);
    expect(readCache<{ id: string }[]>("user-1", "upcoming")?.data).toEqual([{ id: "a" }]);
  });

  it("läcker inte data mellan konton", () => {
    writeCache("user-1", "upcoming", [{ id: "a" }]);
    expect(readCache("user-2", "upcoming")).toBeNull();
  });

  it("ignorerar cache från en äldre appversion", () => {
    const key = cacheKey("user-1", "invitations");
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: CACHE_VERSION - 1, userId: "user-1", scope: "invitations", data: [1] }),
    );
    expect(readCache("user-1", "invitations")).toBeNull();
  });

  it("rensar allt vid utloggning", () => {
    writeCache("user-1", "upcoming", [1]);
    writeCache("user-1", "my-day", [2]);
    clearOfflineData();
    expect(readCache("user-1", "upcoming")).toBeNull();
    expect(readCache("user-1", "my-day")).toBeNull();
  });

  it("rensar andra konton vid kontobyte", () => {
    writeCache("user-1", "upcoming", [1]);
    writeCache("user-2", "upcoming", [2]);
    clearOtherUsers("user-2");
    expect(readCache("user-1", "upcoming")).toBeNull();
    expect(readCache<number[]>("user-2", "upcoming")?.data).toEqual([2]);
  });

  it("visar när uppgifterna hämtades", () => {
    expect(savedAtLabel("2026-01-02T09:30:00Z")).toContain("2026");
    expect(savedAtLabel(null)).toBe("");
  });
});
