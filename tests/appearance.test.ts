import { describe, expect, it } from "vitest";
import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  PRESET_BACKGROUNDS,
  THEME_OPTIONS,
  presetBackgroundCss,
} from "../src/appearance";

describe("THEME_OPTIONS", () => {
  it("has system/light/dark", () => {
    const ids = THEME_OPTIONS.map((t) => t.id);
    expect(ids).toEqual(["system", "light", "dark"]);
  });
});

describe("FONT_OPTIONS", () => {
  it("includes inter / system / serif / mono", () => {
    const ids = FONT_OPTIONS.map((f) => f.id);
    expect(ids).toEqual(["inter", "system", "serif", "mono"]);
  });
  it("every option has a label + sample", () => {
    for (const f of FONT_OPTIONS) {
      expect(f.label).toBeTruthy();
      expect(f.sample).toBeTruthy();
    }
  });
});

describe("FONT_SIZE_OPTIONS", () => {
  it("contains four ascending sizes", () => {
    const pxs = FONT_SIZE_OPTIONS.map((s) => s.px);
    expect(pxs).toEqual([14, 16, 18, 20]);
  });
  it("ids match sm/md/lg/xl", () => {
    expect(FONT_SIZE_OPTIONS.map((s) => s.id)).toEqual(["sm", "md", "lg", "xl"]);
  });
});

describe("PRESET_BACKGROUNDS", () => {
  it("contains 6 named presets", () => {
    expect(PRESET_BACKGROUNDS).toHaveLength(6);
    const ids = PRESET_BACKGROUNDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every preset has a CSS gradient", () => {
    for (const b of PRESET_BACKGROUNDS) {
      expect(b.css).toMatch(/gradient/);
    }
  });
});

describe("presetBackgroundCss()", () => {
  it("returns the preset's css", () => {
    const p = PRESET_BACKGROUNDS[0];
    expect(presetBackgroundCss(p)).toBe(p.css);
  });
});
