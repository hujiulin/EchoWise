import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANION,
  PRESET_AVATARS,
  SURPRISE_PROMPTS,
  TODAYS_TOPIC_POOL,
  VOICE_OPTIONS,
  pickDaily,
} from "../src/companions";

describe("DEFAULT_COMPANION", () => {
  it("has the expected core defaults", () => {
    expect(DEFAULT_COMPANION.name).toBe("EchoWise");
    expect(DEFAULT_COMPANION.avatar).toBe("preset:cat");
    expect(DEFAULT_COMPANION.voice).toBe("nova");
    expect(DEFAULT_COMPANION.persona).toMatch(/warm|friend|companion/i);
    expect(typeof DEFAULT_COMPANION.createdAt).toBe("number");
  });
});

describe("voice + preset catalogs", () => {
  it("VOICE_OPTIONS contains nova/alloy", () => {
    const ids = VOICE_OPTIONS.map((v) => v.id);
    expect(ids).toContain("nova");
    expect(ids).toContain("alloy");
  });
  it("PRESET_AVATARS has 6 cartoons starting with cat", () => {
    expect(PRESET_AVATARS).toHaveLength(6);
    expect(PRESET_AVATARS[0]).toBe("cat");
  });
});

describe("topic + surprise prompt pools", () => {
  it("topic pool is non-empty and each entry has title + prompt", () => {
    expect(TODAYS_TOPIC_POOL.length).toBeGreaterThan(0);
    for (const t of TODAYS_TOPIC_POOL) {
      expect(t.title).toBeTruthy();
      expect(t.prompt).toBeTruthy();
    }
  });
  it("surprise prompt pool follows same shape", () => {
    for (const t of SURPRISE_PROMPTS) {
      expect(t.title).toBeTruthy();
      expect(t.prompt).toBeTruthy();
    }
  });
});

describe("pickDaily()", () => {
  it("returns an element of the list", () => {
    const list = [1, 2, 3, 4];
    expect(list).toContain(pickDaily(list));
  });
  it("is deterministic within the same day", () => {
    const list = [1, 2, 3, 4, 5];
    const a = pickDaily(list);
    const b = pickDaily(list);
    expect(a).toBe(b);
  });
  it("handles single-element list", () => {
    expect(pickDaily(["only"])).toBe("only");
  });
});
