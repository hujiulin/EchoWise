import { describe, expect, it } from "vitest";
import { bandFor, bandRangeLabel, SCORE_BANDS } from "../src/scoring";

describe("SCORE_BANDS table", () => {
  it("has exactly 5 bands", () => {
    expect(SCORE_BANDS).toHaveLength(5);
  });
  it("is ordered by ascending min", () => {
    const mins = SCORE_BANDS.map((b) => b.min);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
  it("each band declares required fields", () => {
    for (const b of SCORE_BANDS) {
      expect(b.id).toBeTruthy();
      expect(b.label).toBeTruthy();
      expect(b.meaning).toBeTruthy();
      expect(b.chipClass).toMatch(/bg-|text-/);
      expect(b.dotClass).toMatch(/bg-/);
    }
  });
});

describe("bandFor(score)", () => {
  it.each([
    [0, "tryAgain"],
    [42, "tryAgain"],
    [60, "tryAgain"],
    [61, "gettingThere"],
    [69, "gettingThere"],
    [70, "clear"],
    [79, "clear"],
    [80, "natural"],
    [89, "natural"],
    [90, "nativeLike"],
    [100, "nativeLike"],
    [150, "nativeLike"],
  ])("score %i → %s", (score, expectedId) => {
    expect(bandFor(score).id).toBe(expectedId);
  });

  it("never returns undefined for negative input", () => {
    expect(bandFor(-5).id).toBe("tryAgain");
  });
});

describe("bandRangeLabel()", () => {
  it("emits range string for middle bands", () => {
    const clear = SCORE_BANDS.find((b) => b.id === "clear")!;
    expect(bandRangeLabel(clear)).toBe("70–79");
  });
  it("uses '+' for the top band", () => {
    const top = SCORE_BANDS.find((b) => b.id === "nativeLike")!;
    expect(bandRangeLabel(top)).toBe("90+");
  });
  it("starts the first band at 0", () => {
    const bottom = SCORE_BANDS[0];
    expect(bandRangeLabel(bottom)).toMatch(/^0–\d+$/);
  });
});
