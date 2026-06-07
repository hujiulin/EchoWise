import { describe, expect, it } from "vitest";
import {
  RELATIONSHIP_TIERS,
  dayCount,
  tierForDay,
} from "../src/types";

describe("RELATIONSHIP_TIERS", () => {
  it("has 5 tiers in ascending minDay order", () => {
    expect(RELATIONSHIP_TIERS).toHaveLength(5);
    const mins = RELATIONSHIP_TIERS.map((t) => t.minDay);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
  it("starts at day 0 (stranger)", () => {
    expect(RELATIONSHIP_TIERS[0].minDay).toBe(0);
    expect(RELATIONSHIP_TIERS[0].id).toBe("stranger");
  });
  it("each tier exposes label / description / toneHint", () => {
    for (const t of RELATIONSHIP_TIERS) {
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.toneHint).toBeTruthy();
    }
  });
});

describe("tierForDay(day)", () => {
  it.each([
    [1, "stranger"],
    [2, "acquaintance"],
    [7, "acquaintance"],
    [8, "friend"],
    [29, "friend"],
    [30, "close-friend"],
    [179, "close-friend"],
    [180, "old-friend"],
    [9999, "old-friend"],
  ])("day %i → %s", (day, expectedId) => {
    expect(tierForDay(day).id).toBe(expectedId);
  });
});

describe("dayCount(createdAt, now)", () => {
  const DAY = 86_400_000;
  const base = 1_700_000_000_000;

  it("returns 1 for same instant (no time passed)", () => {
    expect(dayCount(base, base)).toBe(1);
  });
  it("returns 1 a few hours later (same day)", () => {
    expect(dayCount(base, base + 5 * 60 * 60 * 1000)).toBe(1);
  });
  it("returns 2 after one full day", () => {
    expect(dayCount(base, base + DAY)).toBe(2);
  });
  it("returns 13 after 12 days", () => {
    expect(dayCount(base, base + 12 * DAY)).toBe(13);
  });
  it("never returns below 1 even if future-dated", () => {
    expect(dayCount(base + DAY, base)).toBe(1);
  });
});
