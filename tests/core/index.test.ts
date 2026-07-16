import { describe, expect, it } from "vitest";

import * as core from "../../src/core";
import * as types from "../../src/types";
import * as scoring from "../../src/scoring";
import * as companions from "../../src/companions";
import * as appearance from "../../src/appearance";
import {
  companionTurn,
  reviewSentence,
  summarizeSession,
  ttsInstructions,
} from "../../src/providers";

/**
 * The `core` barrel must expose the platform-independent logic *by reference*
 * (re-exports, not copies) so desktop and mini-program share one source of
 * truth. It must NOT pull in any host-specific transport (e.g. the fetch-based
 * Compat* classes stay in the platform layer).
 */
describe("core barrel", () => {
  it("re-exports domain types/helpers by reference", () => {
    expect(core.tierForDay).toBe(types.tierForDay);
    expect(core.dayCount).toBe(types.dayCount);
    expect(core.RELATIONSHIP_TIERS).toBe(types.RELATIONSHIP_TIERS);
  });

  it("re-exports pure business logic by reference", () => {
    // scoring
    for (const k of Object.keys(scoring) as (keyof typeof scoring)[]) {
      expect((core as Record<string, unknown>)[k]).toBe(scoring[k]);
    }
    // companions
    for (const k of Object.keys(companions) as (keyof typeof companions)[]) {
      expect((core as Record<string, unknown>)[k]).toBe(companions[k]);
    }
    // appearance
    for (const k of Object.keys(appearance) as (keyof typeof appearance)[]) {
      expect((core as Record<string, unknown>)[k]).toBe(appearance[k]);
    }
  });

  it("re-exports the transport-agnostic coaching pipeline", () => {
    expect(core.companionTurn).toBe(companionTurn);
    expect(core.reviewSentence).toBe(reviewSentence);
    expect(core.summarizeSession).toBe(summarizeSession);
    expect(core.ttsInstructions).toBe(ttsInstructions);
  });

  it("does not leak host-specific transport classes into core", () => {
    expect((core as Record<string, unknown>).CompatASR).toBeUndefined();
    expect((core as Record<string, unknown>).CompatLLM).toBeUndefined();
    expect((core as Record<string, unknown>).CompatTTS).toBeUndefined();
  });
});
