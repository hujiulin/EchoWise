import { create } from "zustand";
import { DEFAULT_COMPANION } from "./companions";
import * as DB from "./db";
import * as Updater from "./updater";
import {
  type AppearanceConfig,
  type Companion,
  type Conversation,
  type DailyStat,
  type ProviderConfig,
  type Turn,
  type UserMemory,
} from "./types";
import type { AvailableUpdate, UpdateProgress } from "./updater";

export type View = "conversation" | "growth" | "companion" | "settings";
export type SettingsTab = "appearance" | "provider" | "about";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installed"
  | "error";

interface AppState {
  ready: boolean;
  initError?: string;

  view: View;
  /**
   * When set, the next mount of <Settings/> opens this tab and immediately
   * clears the request. Lets other screens deep-link into a specific tab
   * (e.g. the onboarding banner jumps straight to "provider").
   */
  pendingSettingsTab?: SettingsTab;
  config: ProviderConfig;
  appearance: AppearanceConfig;
  companion: Companion;
  memory: UserMemory;
  history: Conversation[];
  stats: DailyStat[];

  active?: Conversation;
  busy: boolean;
  recording: boolean;
  recordStartedAt?: number;
  error?: string;

  /* updater slice */
  updateStatus: UpdateStatus;
  latestUpdate?: AvailableUpdate;
  updateProgress?: UpdateProgress;
  updateError?: string;
  lastUpdateCheck?: number;

  init: () => Promise<void>;
  setView: (v: View) => void;
  openSettings: (tab?: SettingsTab) => void;
  consumePendingSettingsTab: () => SettingsTab | undefined;
  setConfig: (c: ProviderConfig) => void;
  setAppearance: (patch: Partial<AppearanceConfig>) => void;
  setCompanion: (patch: Partial<Companion>) => void;
  resetCompanion: () => void;
  setMemoryName: (name: string) => void;
  startConversation: (topic?: string) => void;
  loadConversation: (id: string) => boolean;
  endConversation: () => Promise<Conversation | undefined>;
  addTurn: (t: Turn) => void;
  updateTurn: (id: string, patch: Partial<Turn>) => void;
  setBusy: (b: boolean) => void;
  setRecording: (b: boolean, startedAt?: number) => void;
  setError: (e?: string) => void;
  attachSummary: (id: string, summary: Conversation["summary"]) => Promise<void>;

  /* updater actions */
  checkForUpdate: (opts?: { silent?: boolean }) => Promise<void>;
  installUpdate: () => Promise<void>;
  restartForUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

const PLACEHOLDER_CFG: ProviderConfig = {
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

let initPromise: Promise<void> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

const IDLE_END_MS = 30 * 60 * 1000; // 30 min

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  view: "conversation",
  config: PLACEHOLDER_CFG,
  appearance: DB.DEFAULT_APPEARANCE,
  companion: DEFAULT_COMPANION,
  memory: { interests: [], notes: [] },
  history: [],
  stats: [],
  busy: false,
  recording: false,
  updateStatus: "idle",

  async init() {
    if (get().ready) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        await migrateFromLocalStorageOnce();
        const [companion, memory, config, appearance, history, stats] = await Promise.all([
          DB.loadCompanion(),
          DB.loadMemory(),
          DB.loadConfig(),
          DB.loadAppearance(),
          DB.loadConversations(50),
          DB.loadStats(90),
        ]);
        set({ companion, memory, config, appearance, history, stats, ready: true });
        // Quietly look for an update in the background — no UI noise unless
        // one is actually available.
        setTimeout(() => { void get().checkForUpdate({ silent: true }); }, 3_000);
      } catch (e: any) {
        console.error("init failed", e);
        set({ initError: e?.message ?? String(e), ready: true });
      }
    })();
    return initPromise;
  },

  setView: (view) => set({ view }),
  openSettings: (tab) => set({ view: "settings", pendingSettingsTab: tab }),
  consumePendingSettingsTab: () => {
    const t = get().pendingSettingsTab;
    if (t) set({ pendingSettingsTab: undefined });
    return t;
  },
  setConfig: (config) => {
    set({ config });
    void DB.saveConfig(config);
  },
  setAppearance: (patch) => {
    const appearance = { ...get().appearance, ...patch };
    set({ appearance });
    void DB.saveAppearance(appearance);
  },
  setCompanion: (patch) => {
    const companion = { ...get().companion, ...patch };
    set({ companion });
    void DB.saveCompanion(companion);
  },
  resetCompanion: () => {
    const companion = { ...DEFAULT_COMPANION, createdAt: Date.now() };
    set({ companion });
    void DB.saveCompanion(companion);
  },
  setMemoryName: (name) => {
    const memory = { ...get().memory, name };
    set({ memory });
    void DB.saveMemory(memory);
  },

  startConversation: (topic) => {
    const c = get().companion;
    const memName = get().memory.name;
    const intro = topic
      ? `Hey, I've been wanting to talk about ${topic.toLowerCase()}. What's your take?`
      : memName
        ? `Hey ${memName} — good to see you. What's on your mind today?`
        : `Hi. I'm ${c.name}. I'd love to get to know you. What would you like to talk about today?`;
    const conv: Conversation = {
      id: crypto.randomUUID(),
      topic,
      startedAt: Date.now(),
      durationMs: 0,
      turns: [{
        id: crypto.randomUUID(), role: "assistant", text: intro, createdAt: Date.now(),
      }],
    };
    set({ view: "conversation", active: conv });
    void DB.insertConversation(conv);
    void DB.insertTurn(conv.id, conv.turns[0]);
    scheduleIdleEnd();
  },

  loadConversation: (id) => {
    const found = get().history.find((c) => c.id === id);
    if (!found) return false;
    // Resume: keep id, history, turns; clear ended_at so further turns append; bump duration tracker
    const resumed: Conversation = {
      ...found,
      endedAt: undefined,
      startedAt: found.startedAt, // keep original anchor; durationMs accounted from this
    };
    set({ view: "conversation", active: resumed });
    return true;
  },

  async endConversation() {
    cancelIdleEnd();
    const a = get().active;
    if (!a) return undefined;
    const endedAt = Date.now();
    const finished: Conversation = { ...a, endedAt, durationMs: endedAt - a.startedAt };
    const existing = get().history.find((c) => c.id === finished.id);
    const history = existing
      ? get().history.map((c) => (c.id === finished.id ? finished : c))
      : [finished, ...get().history].slice(0, 100);
    set({ active: undefined, history });

    await DB.finalizeConversation(finished);
    if (!existing) {
      const today = new Date().toISOString().slice(0, 10);
      const minutes = Math.max(1, Math.round(finished.durationMs / 60_000));
      await DB.upsertStatOnEnd(today, minutes);
      const stats = await DB.loadStats(90);
      set({ stats });
    }
    return finished;
  },

  addTurn: (t) => {
    const a = get().active;
    if (!a) return;
    set({ active: { ...a, turns: [...a.turns, t] } });
    void DB.insertTurn(a.id, t);
    scheduleIdleEnd();
  },
  updateTurn: (id, patch) => {
    const a = get().active;
    if (!a) return;
    set({ active: { ...a, turns: a.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) } });
    if (Object.keys(patch).length > 0) void DB.updateTurn(id, patch);
  },

  setBusy: (busy) => set({ busy }),
  setRecording: (recording, startedAt) =>
    set({ recording, recordStartedAt: recording ? startedAt ?? Date.now() : undefined }),
  setError: (error) => set({ error }),

  async attachSummary(id, summary) {
    if (!summary) return;
    const history = get().history.map((c) => (c.id === id ? { ...c, summary } : c));
    set({ history });
    await DB.attachSummary(id, summary);
    const today = new Date().toISOString().slice(0, 10);
    await DB.updateStatScores(today, summary.confidence, summary.listening);
    const stats = await DB.loadStats(90);
    set({ stats });
  },

  /* ---------- updater ---------- */

  async checkForUpdate(opts) {
    // Silent: only flips status if there's actually an update; quiet otherwise.
    const silent = opts?.silent ?? false;
    if (!silent) set({ updateStatus: "checking", updateError: undefined });
    try {
      const available = await Updater.checkForUpdate({ silent });
      set({ lastUpdateCheck: Date.now() });
      if (available) {
        set({ latestUpdate: available, updateStatus: "available" });
      } else if (!silent) {
        set({ updateStatus: "upToDate" });
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn("checkForUpdate failed", e);
      if (!silent) set({ updateStatus: "error", updateError: msg });
    }
  },

  async installUpdate() {
    if (!get().latestUpdate) return;
    set({ updateStatus: "downloading", updateProgress: { downloaded: 0 }, updateError: undefined });
    try {
      await Updater.downloadAndInstall((progress) => {
        set({ updateProgress: progress });
      });
      set({ updateStatus: "installed" });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn("installUpdate failed", e);
      set({ updateStatus: "error", updateError: msg });
    }
  },

  async restartForUpdate() {
    try {
      await Updater.restartApp();
    } catch (e: any) {
      set({ updateError: e?.message ?? String(e) });
    }
  },

  dismissUpdate: () => {
    set({ updateStatus: "idle", latestUpdate: undefined, updateProgress: undefined });
  },
}));

export function memorySummary(memory: UserMemory): string {
  const lines: string[] = [];
  if (memory.name) lines.push(`Name: ${memory.name}`);
  if (memory.interests.length) lines.push(`Interests: ${memory.interests.join(", ")}`);
  for (const n of memory.notes.slice(-10)) lines.push(`- ${n}`);
  return lines.join("\n");
}

function cancelIdleEnd() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
}

function scheduleIdleEnd() {
  cancelIdleEnd();
  idleTimer = setTimeout(() => {
    // Quiet auto-end: only triggers if no new turn arrived within IDLE_END_MS.
    // We do NOT run a summary here (it would cost an LLM call). The session
    // is just finalized so its minutes feed today's stats.
    const a = useApp.getState().active;
    if (!a) return;
    const userTurns = a.turns.filter((t) => t.role === "user");
    if (userTurns.length === 0) {
      // Empty session — discard, do not pollute history.
      useApp.setState({ active: undefined });
      return;
    }
    void useApp.getState().endConversation();
  }, IDLE_END_MS);
}

/** One-shot localStorage → SQLite migration. Idempotent. */
async function migrateFromLocalStorageOnce() {
  const FLAG = "echowise.migrated.v2";
  if (localStorage.getItem(FLAG)) return;

  try {
    const cfgRaw = localStorage.getItem("echowise.config.v1");
    if (cfgRaw) await DB.saveConfig(JSON.parse(cfgRaw));

    const memRaw = localStorage.getItem("echowise.memory.v1");
    if (memRaw) await DB.saveMemory({ interests: [], notes: [], ...JSON.parse(memRaw) });

    const compRaw = localStorage.getItem("echowise.companion.v2");
    if (compRaw) await DB.saveCompanion({ ...DEFAULT_COMPANION, ...JSON.parse(compRaw) });

    const histRaw = localStorage.getItem("echowise.conversations.v1");
    if (histRaw) {
      const list: Conversation[] = JSON.parse(histRaw);
      for (const c of list) {
        await DB.insertConversation(c);
        for (const t of c.turns ?? []) await DB.insertTurn(c.id, { ...t, audioPath: undefined });
      }
    }
  } catch (e) {
    console.warn("localStorage migration skipped:", e);
  }
  localStorage.setItem(FLAG, "1");
}
