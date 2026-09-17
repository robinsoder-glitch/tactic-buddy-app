import { describe, expect, it } from "vitest";
import { pitchForFormat } from "./useTeamPreset";

describe("pitchForFormat", () => {
  it("ger femmannaplan för små spelformer", () => {
    expect(pitchForFormat("5v5")).toBe("five");
    expect(pitchForFormat("3v3")).toBe("five");
  });

  it("följer större spelformer", () => {
    expect(pitchForFormat("7v7")).toBe("seven");
    expect(pitchForFormat("9v9")).toBe("nine");
    expect(pitchForFormat("11v11")).toBe("full");
  });

  it("faller tillbaka på hel plan när spelform saknas", () => {
    expect(pitchForFormat(null)).toBe("full");
    expect(pitchForFormat("okänt")).toBe("full");
  });
});
