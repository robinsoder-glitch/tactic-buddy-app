import { describe, expect, it } from "vitest";
import {
  inviteProblemInfo,
  isNetworkProblem,
  isTeamCodeShape,
  problemFromPreviewState,
  tokenProblem,
} from "./invite-problem";

describe("tokenProblem", () => {
  it("godkänner en hel lagkodslänk", () => {
    expect(tokenProblem("kod-191969")).toBeNull();
  });

  it("flaggar tom adress", () => {
    expect(tokenProblem("")).toBe("empty");
    expect(tokenProblem(null)).toBe("empty");
  });

  it("flaggar avkortad eller för lång lagkod", () => {
    expect(tokenProblem("kod-1919")).toBe("malformed-code");
    expect(tokenProblem("kod-1919699")).toBe("malformed-code");
  });

  it("flaggar inklistrad webbadress", () => {
    expect(tokenProblem("https://fotbollsrummet.app/inbjudan/kod-191969")).toBe("pasted-url");
    expect(tokenProblem("kod-191969%2Fextra")).toBe("pasted-url");
  });

  it("låter personliga tokens passera", () => {
    expect(tokenProblem("a1b2c3d4e5")).toBeNull();
  });
});

describe("isTeamCodeShape", () => {
  it("kräver sex tecken", () => {
    expect(isTeamCodeShape("191969")).toBe(true);
    expect(isTeamCodeShape(" ABC123 ")).toBe(true);
    expect(isTeamCodeShape("12345")).toBe(false);
    expect(isTeamCodeShape("12 345")).toBe(false);
  });
});

describe("isNetworkProblem", () => {
  it("känner igen nätverksfel", () => {
    expect(isNetworkProblem(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkProblem(new Error("Load failed"))).toBe(true);
  });

  it("räknar inte serverfel som nätverksfel", () => {
    expect(isNetworkProblem(new Error("permission denied"))).toBe(false);
  });
});

describe("problemFromPreviewState", () => {
  it("ger inget problem för giltig inbjudan", () => {
    expect(problemFromPreviewState("active")).toBeNull();
  });

  it("speglar övriga statusar", () => {
    expect(problemFromPreviewState("expired")).toBe("expired");
    expect(problemFromPreviewState("revoked")).toBe("revoked");
  });
});

describe("inviteProblemInfo", () => {
  it("erbjuder återförsök vid nätverksfel men inte vid utgången länk", () => {
    expect(inviteProblemInfo("network").canRetry).toBe(true);
    expect(inviteProblemInfo("expired").canRetry).toBe(false);
  });

  it("erbjuder manuell lagkod när länken inte går att laga", () => {
    expect(inviteProblemInfo("malformed-code").canEnterCode).toBe(true);
    expect(inviteProblemInfo("network").canEnterCode).toBe(false);
  });

  it("har svensk text i alla fält", () => {
    const info = inviteProblemInfo("not-found");
    expect(info.title.length).toBeGreaterThan(5);
    expect(info.message.length).toBeGreaterThan(10);
    expect(info.hint.length).toBeGreaterThan(10);
  });
});
