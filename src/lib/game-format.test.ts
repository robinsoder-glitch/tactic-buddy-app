import { describe, expect, it } from "vitest";
import { GAME_FORMATS, gameFormatLabel, parseGameFormat, pitchTypeForFormat } from "./game-format";

describe("game-format", () => {
  it("har fyra spelformer i svensk text", () => {
    expect(GAME_FORMATS.map((f) => f.label)).toEqual([
      "5 mot 5",
      "7 mot 7",
      "9 mot 9",
      "11 mot 11",
    ]);
  });

  it("mappar varje spelform till rätt planstorlek", () => {
    expect(pitchTypeForFormat("5v5")).toBe("five");
    expect(pitchTypeForFormat("7v7")).toBe("seven");
    expect(pitchTypeForFormat("9v9")).toBe("nine");
    expect(pitchTypeForFormat("11v11")).toBe("full");
  });

  it("ger etikett", () => {
    expect(gameFormatLabel("11v11")).toBe("11 mot 11");
  });

  it("tolkar bankens format", () => {
    expect(parseGameFormat("5v5")).toBe("5v5");
    expect(parseGameFormat("11-manna")).toBe("11v11");
    expect(parseGameFormat("7 mot 7")).toBe("7v7");
    expect(parseGameFormat(null)).toBeNull();
    expect(parseGameFormat("okänt")).toBeNull();
  });
});

describe("pitchTypeLabel", () => {
  it("beskriver planstorlek i modern text", async () => {
    const { pitchTypeLabel } = await import("./game-format");
    expect(pitchTypeLabel("small")).toBe("5 mot 5 / 7 mot 7");
    expect(pitchTypeLabel("full")).toBe("11 mot 11");
    expect(pitchTypeLabel("nine")).toBe("9 mot 9");
    expect(pitchTypeLabel("seven")).toBe("7 mot 7");
    expect(pitchTypeLabel("five")).toBe("5 mot 5");
  });
});
