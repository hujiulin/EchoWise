import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Wire mocks BEFORE importing db.ts
vi.mock("@tauri-apps/plugin-sql", async () => {
  const mod = await import("./__mocks__/tauri-sql");
  return { default: mod.default };
});

import {
  DEFAULT_APPEARANCE,
  attachSummary,
  finalizeConversation,
  insertConversation,
  insertTurn,
  loadAppearance,
  loadCompanion,
  loadConfig,
  loadConversations,
  loadMemory,
  loadStats,
  saveAppearance,
  saveCompanion,
  saveConfig,
  saveMemory,
  updateStatScores,
  updateTurn,
  upsertStatOnEnd,
} from "../src/db";
import { __peek, __resetDb, __seed } from "./__mocks__/tauri-sql";
import type { Conversation, Turn } from "../src/types";

beforeEach(() => { __resetDb(); });
afterEach(() => { vi.clearAllMocks(); });

/* ---------- companion ---------- */

describe("companion table", () => {
  it("loadCompanion inserts default row when empty", async () => {
    const c = await loadCompanion();
    expect(c.name).toBe("EchoWise");
    expect(c.avatar).toBe("preset:cat");
    expect(__peek("companion")).toHaveLength(1);
  });

  it("loadCompanion returns existing row", async () => {
    __seed("companion", [{
      id: 1, name: "Aria", emoji: "", avatar: "preset:fox",
      voice: "echo", persona: "playful", created_at: 12345,
    }]);
    const c = await loadCompanion();
    expect(c.name).toBe("Aria");
    expect(c.avatar).toBe("preset:fox");
    expect(c.createdAt).toBe(12345);
  });

  it("saveCompanion updates the single row", async () => {
    await loadCompanion();
    await saveCompanion({ name: "X", voice: "nova", persona: "p", avatar: "preset:owl", createdAt: 999 });
    const rows = __peek("companion");
    expect(rows[0].name).toBe("X");
    expect(rows[0].avatar).toBe("preset:owl");
  });
});

/* ---------- memory ---------- */

describe("memory table", () => {
  it("loadMemory inserts an empty default row", async () => {
    const m = await loadMemory();
    expect(m.interests).toEqual([]);
    expect(m.notes).toEqual([]);
  });

  it("saveMemory persists name + interests as JSON", async () => {
    await loadMemory();
    await saveMemory({ name: "Alex", interests: ["AI", "rust"], notes: ["likes coffee"] });
    const rows = __peek("memory");
    expect(rows[0].name).toBe("Alex");
    expect(JSON.parse(rows[0].interests as string)).toEqual(["AI", "rust"]);
  });

  it("loadMemory tolerates bad JSON", async () => {
    __seed("memory", [{ id: 1, name: null, interests: "not json", notes: "[]" }]);
    const m = await loadMemory();
    expect(m.interests).toEqual([]);
  });
});

/* ---------- settings (config + appearance) ---------- */

describe("settings table — provider config", () => {
  it("loadConfig returns defaults when missing", async () => {
    const c = await loadConfig();
    expect(c.provider).toBe("openai");
    expect(c.ttsVoice).toBe("nova");
  });

  it("saveConfig + loadConfig roundtrip", async () => {
    await saveConfig({
      provider: "azure", apiKey: "k", baseUrl: "",
      azureEndpoint: "https://x", azureApiVersion: "v",
      asrModel: "a", llmModel: "l", ttsModel: "t", ttsVoice: "nova",
    });
    const c = await loadConfig();
    expect(c.provider).toBe("azure");
    expect(c.azureEndpoint).toBe("https://x");
  });
});

describe("settings table — appearance", () => {
  it("loadAppearance returns defaults", async () => {
    const a = await loadAppearance();
    expect(a).toEqual(DEFAULT_APPEARANCE);
  });

  it("saveAppearance roundtrips", async () => {
    await saveAppearance({ theme: "dark", font: "mono", fontSize: "lg", bgImage: "preset:ocean", bgOpacity: 40 });
    const a = await loadAppearance();
    expect(a.theme).toBe("dark");
    expect(a.bgImage).toBe("preset:ocean");
  });
});

/* ---------- conversations + turns ---------- */

describe("conversations + turns", () => {
  const conv: Conversation = {
    id: "c1", topic: "weekend",
    startedAt: 1000, endedAt: undefined,
    durationMs: 0, turns: [],
  };

  it("insertConversation persists topic + started_at", async () => {
    await insertConversation(conv);
    const rows = __peek("conversations");
    expect(rows[0].id).toBe("c1");
    expect(rows[0].topic).toBe("weekend");
  });

  it("finalizeConversation writes ended_at + duration_ms", async () => {
    await insertConversation(conv);
    await finalizeConversation({ ...conv, endedAt: 2500, durationMs: 1500 });
    const rows = __peek("conversations");
    expect(rows[0].ended_at).toBe(2500);
    expect(rows[0].duration_ms).toBe(1500);
  });

  it("insertTurn persists role + text + audio_path + nullable json", async () => {
    await insertConversation(conv);
    const t: Turn = {
      id: "t1", role: "user", text: "hi",
      audioPath: "audio/c1/t1.webm", createdAt: 1100,
    };
    await insertTurn("c1", t);
    const rows = __peek("turns");
    expect(rows[0].text).toBe("hi");
    expect(rows[0].audio_path).toBe("audio/c1/t1.webm");
    expect(rows[0].hint_json).toBeNull();
  });

  it("updateTurn handles partial patches", async () => {
    await insertConversation(conv);
    await insertTurn("c1", { id: "t1", role: "user", text: "hi", createdAt: 1100 });
    await updateTurn("t1", { text: "hello" });
    expect(__peek("turns")[0].text).toBe("hello");
    await updateTurn("t1", { expanded: true, transcriptShown: true });
    expect(__peek("turns")[0].expanded).toBe(1);
    expect(__peek("turns")[0].transcript_shown).toBe(1);
  });

  it("loadConversations rebuilds turns + summary", async () => {
    __seed("conversations", [{
      id: "c1", topic: "weekend", started_at: 1000, ended_at: 2000,
      duration_ms: 1000,
      summary_json: JSON.stringify({
        listening: 70, fluency: 70, pronunciation: 70,
        vocabulary: 70, confidence: 70, grammar: 70,
        highlight: "ok",
      }),
    }]);
    __seed("turns", [{
      id: "t1", conversation_id: "c1", role: "user", text: "hi",
      audio_path: null, hint_json: null, review_json: JSON.stringify({
        score: 80, original: "hi", better: "Hi!", nativeLike: "Hey!",
      }),
      duration_ms: 1500, created_at: 1100, expanded: 1, transcript_shown: 0,
    }]);
    const list = await loadConversations(50);
    expect(list).toHaveLength(1);
    expect(list[0].turns).toHaveLength(1);
    expect(list[0].turns[0].review?.score).toBe(80);
    expect(list[0].turns[0].expanded).toBe(true);
    expect(list[0].summary?.confidence).toBe(70);
  });

  it("attachSummary writes summary JSON", async () => {
    __seed("conversations", [{
      id: "c1", topic: null, started_at: 1, ended_at: 2,
      duration_ms: 1, summary_json: null,
    }]);
    await attachSummary("c1", {
      listening: 50, fluency: 50, pronunciation: 50,
      vocabulary: 50, confidence: 50, grammar: 50, highlight: "X",
    });
    const rows = __peek("conversations");
    expect(JSON.parse(rows[0].summary_json as string).highlight).toBe("X");
  });
});

/* ---------- stats ---------- */

describe("stats", () => {
  it("upsertStatOnEnd inserts new day", async () => {
    await upsertStatOnEnd("2026-06-07", 5);
    expect(__peek("stats")[0].minutes).toBe(5);
  });

  it("upsertStatOnEnd accumulates on same day", async () => {
    await upsertStatOnEnd("2026-06-07", 5);
    await upsertStatOnEnd("2026-06-07", 3);
    const row = __peek("stats")[0];
    expect(row.minutes).toBe(8);
    expect(row.conversations).toBe(2);
  });

  it("updateStatScores writes confidence/listening", async () => {
    await updateStatScores("2026-06-07", 80, 70);
    const row = __peek("stats")[0];
    expect(row.confidence).toBe(80);
    expect(row.listening).toBe(70);
  });

  it("loadStats orders by date desc", async () => {
    __seed("stats", [
      { date: "2026-06-05", minutes: 1, confidence: 0, listening: 0, conversations: 1 },
      { date: "2026-06-07", minutes: 1, confidence: 0, listening: 0, conversations: 1 },
      { date: "2026-06-06", minutes: 1, confidence: 0, listening: 0, conversations: 1 },
    ]);
    const list = await loadStats(90);
    expect(list.map((s) => s.date)).toEqual(["2026-06-07", "2026-06-06", "2026-06-05"]);
  });
});
