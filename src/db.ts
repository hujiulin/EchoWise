import Database from "@tauri-apps/plugin-sql";
import { DEFAULT_COMPANION } from "./companions";
import type { AppearanceConfig, Companion, Conversation, ConversationSummary, DailyStat, ProviderConfig, Turn, UserMemory } from "./types";

let _db: Database | undefined;

export async function db(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:echowise.db");
  return _db;
}

const DEFAULT_CFG: ProviderConfig = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  azureEndpoint: "",
  azureApiVersion: "2025-04-01-preview",
  asrModel: "gpt-4o-transcribe",
  llmModel: "gpt-5",
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "nova",
};

/* ---------- companion ---------- */

export async function loadCompanion(): Promise<Companion> {
  const d = await db();
  const rows = await d.select<{ name: string; avatar: string; voice: string; persona: string; created_at: number }[]>(
    "SELECT name, avatar, voice, persona, created_at FROM companion WHERE id = 1"
  );
  if (rows.length === 0) {
    const c = { ...DEFAULT_COMPANION, createdAt: Date.now() };
    await d.execute(
      "INSERT OR IGNORE INTO companion(id, name, emoji, avatar, voice, persona, created_at) VALUES (1, ?, '', ?, ?, ?, ?)",
      [c.name, c.avatar, c.voice, c.persona, c.createdAt]
    );
    const re = await d.select<{ name: string; avatar: string; voice: string; persona: string; created_at: number }[]>(
      "SELECT name, avatar, voice, persona, created_at FROM companion WHERE id = 1"
    );
    const r = re[0] ?? { name: c.name, avatar: c.avatar, voice: c.voice, persona: c.persona, created_at: c.createdAt };
    return { name: r.name, avatar: r.avatar, voice: r.voice, persona: r.persona, createdAt: r.created_at };
  }
  const r = rows[0];
  return { name: r.name, avatar: r.avatar, voice: r.voice, persona: r.persona, createdAt: r.created_at };
}

export async function saveCompanion(c: Companion) {
  const d = await db();
  await d.execute(
    "UPDATE companion SET name = ?, avatar = ?, voice = ?, persona = ?, created_at = ? WHERE id = 1",
    [c.name, c.avatar, c.voice, c.persona, c.createdAt]
  );
}

/* ---------- memory ---------- */

export async function loadMemory(): Promise<UserMemory> {
  const d = await db();
  const rows = await d.select<{ name: string | null; interests: string; notes: string }[]>(
    "SELECT name, interests, notes FROM memory WHERE id = 1"
  );
  if (rows.length === 0) {
    await d.execute("INSERT OR IGNORE INTO memory(id, name, interests, notes) VALUES (1, NULL, '[]', '[]')");
    return { interests: [], notes: [] };
  }
  const r = rows[0];
  return {
    name: r.name ?? undefined,
    interests: safeJSON(r.interests, []),
    notes: safeJSON(r.notes, []),
  };
}

export async function saveMemory(m: UserMemory) {
  const d = await db();
  await d.execute(
    "UPDATE memory SET name = ?, interests = ?, notes = ? WHERE id = 1",
    [m.name ?? null, JSON.stringify(m.interests), JSON.stringify(m.notes)]
  );
}

/* ---------- settings (config kv) ---------- */

const CFG_KEY = "provider_config";
const APPEARANCE_KEY = "appearance_config";

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  theme: "system",
  font: "inter",
  fontSize: "md",
  bgImage: "",
  bgOpacity: 20,
};

export async function loadConfig(): Promise<ProviderConfig> {
  const d = await db();
  const rows = await d.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?", [CFG_KEY]
  );
  if (rows.length === 0) return DEFAULT_CFG;
  return { ...DEFAULT_CFG, ...safeJSON(rows[0].value, {}) };
}

export async function saveConfig(c: ProviderConfig) {
  const d = await db();
  await d.execute(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [CFG_KEY, JSON.stringify(c)]
  );
}

export async function loadAppearance(): Promise<AppearanceConfig> {
  const d = await db();
  const rows = await d.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?", [APPEARANCE_KEY]
  );
  if (rows.length === 0) return DEFAULT_APPEARANCE;
  return { ...DEFAULT_APPEARANCE, ...safeJSON(rows[0].value, {}) };
}

export async function saveAppearance(a: AppearanceConfig) {
  const d = await db();
  await d.execute(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [APPEARANCE_KEY, JSON.stringify(a)]
  );
}

/* ---------- conversations + turns ---------- */

export async function insertConversation(c: Conversation) {
  const d = await db();
  await d.execute(
    "INSERT INTO conversations(id, topic, started_at, ended_at, duration_ms, summary_json) VALUES (?, ?, ?, ?, ?, ?)",
    [c.id, c.topic ?? null, c.startedAt, c.endedAt ?? null, c.durationMs, c.summary ? JSON.stringify(c.summary) : null]
  );
}

export async function finalizeConversation(c: Conversation) {
  const d = await db();
  await d.execute(
    "UPDATE conversations SET ended_at = ?, duration_ms = ?, summary_json = ? WHERE id = ?",
    [c.endedAt ?? null, c.durationMs, c.summary ? JSON.stringify(c.summary) : null, c.id]
  );
}

export async function attachSummary(id: string, summary: ConversationSummary) {
  const d = await db();
  await d.execute(
    "UPDATE conversations SET summary_json = ? WHERE id = ?",
    [JSON.stringify(summary), id]
  );
}

export async function insertTurn(conversationId: string, t: Turn) {
  const d = await db();
  await d.execute(
    `INSERT INTO turns(id, conversation_id, role, text, audio_path, hint_json, review_json, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id, conversationId, t.role, t.text,
      t.audioPath ?? null,
      t.hint ? JSON.stringify(t.hint) : null,
      t.review ? JSON.stringify(t.review) : null,
      t.durationMs ?? null,
      t.createdAt,
    ]
  );
}

export async function updateTurn(id: string, patch: Partial<Turn>) {
  const d = await db();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.text !== undefined) { sets.push("text = ?"); params.push(patch.text); }
  if (patch.audioPath !== undefined) { sets.push("audio_path = ?"); params.push(patch.audioPath ?? null); }
  if (patch.hint !== undefined) { sets.push("hint_json = ?"); params.push(patch.hint ? JSON.stringify(patch.hint) : null); }
  if (patch.review !== undefined) { sets.push("review_json = ?"); params.push(patch.review ? JSON.stringify(patch.review) : null); }
  if (patch.durationMs !== undefined) { sets.push("duration_ms = ?"); params.push(patch.durationMs ?? null); }
  if (patch.expanded !== undefined) { sets.push("expanded = ?"); params.push(patch.expanded ? 1 : 0); }
  if (patch.transcriptShown !== undefined) { sets.push("transcript_shown = ?"); params.push(patch.transcriptShown ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id);
  await d.execute(`UPDATE turns SET ${sets.join(", ")} WHERE id = ?`, params);
}

interface TurnRow {
  id: string; conversation_id: string;
  role: "user" | "assistant"; text: string;
  audio_path: string | null;
  hint_json: string | null; review_json: string | null;
  duration_ms: number | null; created_at: number;
  expanded: number | null; transcript_shown: number | null;
}

export async function loadConversations(limit = 50): Promise<Conversation[]> {
  const d = await db();
  const convRows = await d.select<{
    id: string; topic: string | null; started_at: number;
    ended_at: number | null; duration_ms: number; summary_json: string | null;
  }[]>(
    "SELECT id, topic, started_at, ended_at, duration_ms, summary_json FROM conversations ORDER BY started_at DESC LIMIT ?",
    [limit]
  );
  if (convRows.length === 0) return [];

  const ids = convRows.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const turnRows = await d.select<TurnRow[]>(
    `SELECT id, conversation_id, role, text, audio_path, hint_json, review_json, duration_ms, created_at, expanded, transcript_shown
     FROM turns WHERE conversation_id IN (${placeholders}) ORDER BY created_at ASC`,
    ids
  );

  const turnsByConv = new Map<string, Turn[]>();
  for (const r of turnRows) {
    const t: Turn = {
      id: r.id, role: r.role, text: r.text,
      audioPath: r.audio_path ?? undefined,
      hint: safeJSON(r.hint_json, undefined),
      review: safeJSON(r.review_json, undefined),
      durationMs: r.duration_ms ?? undefined,
      createdAt: r.created_at,
      expanded: r.expanded === 1,
      transcriptShown: r.transcript_shown === 1,
    };
    const arr = turnsByConv.get(r.conversation_id) ?? [];
    arr.push(t);
    turnsByConv.set(r.conversation_id, arr);
  }

  return convRows.map((c) => ({
    id: c.id,
    topic: c.topic ?? undefined,
    startedAt: c.started_at,
    endedAt: c.ended_at ?? undefined,
    durationMs: c.duration_ms,
    summary: safeJSON(c.summary_json, undefined),
    turns: turnsByConv.get(c.id) ?? [],
  }));
}

/* ---------- stats ---------- */

export async function loadStats(days = 90): Promise<DailyStat[]> {
  const d = await db();
  const rows = await d.select<DailyStat[]>(
    "SELECT date, minutes, confidence, listening, conversations FROM stats ORDER BY date DESC LIMIT ?",
    [days]
  );
  return rows;
}

export async function upsertStatOnEnd(dateISO: string, addedMinutes: number) {
  const d = await db();
  await d.execute(
    `INSERT INTO stats(date, minutes, confidence, listening, conversations) VALUES (?, ?, 0, 0, 1)
     ON CONFLICT(date) DO UPDATE SET minutes = minutes + excluded.minutes, conversations = conversations + 1`,
    [dateISO, addedMinutes]
  );
}

export async function updateStatScores(dateISO: string, confidence: number, listening: number) {
  const d = await db();
  await d.execute(
    `INSERT INTO stats(date, minutes, confidence, listening, conversations) VALUES (?, 0, ?, ?, 0)
     ON CONFLICT(date) DO UPDATE SET
       confidence = CASE WHEN stats.confidence = 0 THEN excluded.confidence ELSE (stats.confidence + excluded.confidence) / 2 END,
       listening  = CASE WHEN stats.listening  = 0 THEN excluded.listening  ELSE (stats.listening  + excluded.listening)  / 2 END`,
    [dateISO, Math.round(confidence), Math.round(listening)]
  );
}

/* ---------- helpers ---------- */

function safeJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
