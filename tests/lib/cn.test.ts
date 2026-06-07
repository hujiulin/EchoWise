import { describe, expect, it } from "vitest";
import { cn, formatDuration, pad2 } from "../../src/lib/cn";

describe("cn()", () => {
  it("merges class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("ignores falsey", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
  it("conditional via clsx", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });
  it("dedupes tailwind via tailwind-merge", () => {
    expect(cn("p-2 p-4")).toBe("p-4");
    expect(cn("text-foreground", "text-muted-foreground")).toBe("text-muted-foreground");
  });
});

describe("formatDuration()", () => {
  it("seconds only when under one minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(500)).toBe("0s");
    expect(formatDuration(7_500)).toBe("7s");
    expect(formatDuration(59_900)).toBe("59s");
  });
  it("minutes + zero-padded seconds when over one minute", () => {
    expect(formatDuration(60_000)).toBe("1m 00s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(125_000)).toBe("2m 05s");
  });
});

describe("pad2()", () => {
  it("pads single digit", () => {
    expect(pad2(3)).toBe("03");
  });
  it("leaves two-digit untouched", () => {
    expect(pad2(42)).toBe("42");
  });
});
