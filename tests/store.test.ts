import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const mod = await import("./__mocks__/tauri-sql");
  return { default: mod.default };
});

import { useApp, memorySummary } from "../src/store";
import { __resetDb } from "./__mocks__/tauri-sql";
import type { Conversation, Turn, UserMemory } from "../src/types";

async function init() {
  // Reset store + DB between tests. Note: don't toggle `ready: false`,
  // because the module-level initPromise would still be resolved from the
  // previous run and a re-init wouldn't actually re-fetch.
  __resetDb();
  useApp.setState({
    view: "conversation",
    active: undefined,
    history: [],
    stats: [],
    busy: false,
    recording: false,
    recordStartedAt: undefined,
    error: undefined,
    memory: { interests: [], notes: [] },
  } as Partial<ReturnType<typeof useApp.getState>>);
  await useApp.getState().init();
}

beforeEach(async () => {
  vi.useFakeTimers();
  await init();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("init", () => {
  it("loads defaults and marks ready", () => {
    const s = useApp.getState();
    expect(s.ready).toBe(true);
    expect(s.companion.name).toBe("EchoWise");
    expect(s.history).toEqual([]);
  });

  it("init() is idempotent (StrictMode safe)", async () => {
    // Calling again should resolve fast and leave ready=true
    await useApp.getState().init();
    await useApp.getState().init();
    expect(useApp.getState().ready).toBe(true);
    expect(useApp.getState().companion.name).toBe("EchoWise");
  });
});

describe("setters", () => {
  it("setView updates view", () => {
    useApp.getState().setView("growth");
    expect(useApp.getState().view).toBe("growth");
  });

  it("setCompanion merges patch", () => {
    useApp.getState().setCompanion({ name: "Luna" });
    expect(useApp.getState().companion.name).toBe("Luna");
    expect(useApp.getState().companion.avatar).toBe("preset:cat");
  });

  it("resetCompanion bumps createdAt to now and restores defaults", () => {
    const before = useApp.getState().companion;
    vi.setSystemTime(new Date(2030, 1, 1));
    useApp.getState().resetCompanion();
    const after = useApp.getState().companion;
    expect(after.name).toBe("EchoWise");
    expect(after.createdAt).not.toBe(before.createdAt);
  });

  it("setMemoryName persists name", () => {
    useApp.getState().setMemoryName("Alex");
    expect(useApp.getState().memory.name).toBe("Alex");
  });

  it("setAppearance merges patch", () => {
    useApp.getState().setAppearance({ theme: "dark" });
    expect(useApp.getState().appearance.theme).toBe("dark");
  });

  it("setConfig replaces full provider config", () => {
    useApp.getState().setConfig({
      ...useApp.getState().config,
      provider: "azure",
      apiKey: "k",
    });
    expect(useApp.getState().config.provider).toBe("azure");
  });

  it("setBusy / setRecording / setError", () => {
    useApp.getState().setBusy(true);
    expect(useApp.getState().busy).toBe(true);
    useApp.getState().setRecording(true, 12345);
    expect(useApp.getState().recordStartedAt).toBe(12345);
    useApp.getState().setRecording(false);
    expect(useApp.getState().recordStartedAt).toBeUndefined();
    useApp.getState().setError("oh no");
    expect(useApp.getState().error).toBe("oh no");
  });
});

describe("conversation lifecycle", () => {
  it("startConversation seeds opening assistant turn", () => {
    useApp.getState().startConversation();
    const a = useApp.getState().active!;
    expect(a.turns).toHaveLength(1);
    expect(a.turns[0].role).toBe("assistant");
    expect(a.turns[0].text).toMatch(/EchoWise|talk/i);
  });

  it("startConversation with topic uses topic phrasing", () => {
    useApp.getState().startConversation("AI");
    expect(useApp.getState().active!.turns[0].text.toLowerCase()).toContain("ai");
  });

  it("addTurn appends to active turns", () => {
    useApp.getState().startConversation();
    const t: Turn = { id: "t1", role: "user", text: "hi", createdAt: 1 };
    useApp.getState().addTurn(t);
    expect(useApp.getState().active!.turns).toHaveLength(2);
  });

  it("updateTurn patches active turn", () => {
    useApp.getState().startConversation();
    const t: Turn = { id: "t1", role: "user", text: "hi", createdAt: 1 };
    useApp.getState().addTurn(t);
    useApp.getState().updateTurn("t1", { transcriptShown: true });
    const updated = useApp.getState().active!.turns.find((x) => x.id === "t1");
    expect(updated?.transcriptShown).toBe(true);
  });

  it("endConversation moves active to history + writes stats", async () => {
    useApp.getState().startConversation();
    useApp.getState().addTurn({ id: "u1", role: "user", text: "hello", createdAt: Date.now() });
    vi.advanceTimersByTime(120_000); // 2 min later
    const finished = await useApp.getState().endConversation();
    expect(finished).toBeDefined();
    expect(useApp.getState().active).toBeUndefined();
    expect(useApp.getState().history).toHaveLength(1);
    expect(useApp.getState().stats.length).toBeGreaterThan(0);
  });

  it("loadConversation resumes from history", async () => {
    useApp.getState().startConversation("topic");
    useApp.getState().addTurn({ id: "u1", role: "user", text: "first", createdAt: Date.now() });
    const finished = await useApp.getState().endConversation();
    const ok = useApp.getState().loadConversation(finished!.id);
    expect(ok).toBe(true);
    expect(useApp.getState().active?.id).toBe(finished!.id);
    expect(useApp.getState().active?.endedAt).toBeUndefined();
  });

  it("loadConversation(unknown id) returns false", () => {
    expect(useApp.getState().loadConversation("does-not-exist")).toBe(false);
  });

  it("attachSummary writes summary to matching history entry", async () => {
    useApp.getState().startConversation();
    useApp.getState().addTurn({ id: "u1", role: "user", text: "x", createdAt: Date.now() });
    const finished = await useApp.getState().endConversation();
    await useApp.getState().attachSummary(finished!.id, {
      listening: 80, fluency: 80, pronunciation: 80,
      vocabulary: 80, confidence: 80, grammar: 80, highlight: "Nice.",
    });
    const updated = useApp.getState().history.find((c) => c.id === finished!.id);
    expect(updated?.summary?.confidence).toBe(80);
  });
});

describe("idle auto-end", () => {
  it("finalizes an idle conversation after 30 minutes", async () => {
    useApp.getState().startConversation();
    useApp.getState().addTurn({
      id: "u1", role: "user", text: "hi", createdAt: Date.now(),
    });
    expect(useApp.getState().active).toBeDefined();
    vi.advanceTimersByTime(30 * 60 * 1000 + 100);
    // microtask flush
    await Promise.resolve();
    await Promise.resolve();
    expect(useApp.getState().active).toBeUndefined();
  });

  it("discards empty conversation silently (no history entry)", async () => {
    useApp.getState().startConversation();
    vi.advanceTimersByTime(30 * 60 * 1000 + 100);
    await Promise.resolve();
    expect(useApp.getState().active).toBeUndefined();
    expect(useApp.getState().history).toHaveLength(0);
  });
});

describe("memorySummary()", () => {
  it("empty memory returns empty string", () => {
    expect(memorySummary({ interests: [], notes: [] })).toBe("");
  });

  it("includes name + interests + notes", () => {
    const m: UserMemory = {
      name: "Alex",
      interests: ["AI", "rust"],
      notes: ["likes coffee", "is a Pythonista"],
    };
    const out = memorySummary(m);
    expect(out).toContain("Alex");
    expect(out).toContain("AI, rust");
    expect(out).toContain("likes coffee");
  });

  it("caps notes to last 10", () => {
    const notes = Array.from({ length: 15 }, (_, i) => `note${i}`);
    const out = memorySummary({ interests: [], notes });
    expect(out).not.toContain("note0");
    expect(out).toContain("note14");
  });
});

// hush ts unused-var
void ({} as Conversation);
