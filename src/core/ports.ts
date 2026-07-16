/**
 * Platform port interfaces.
 *
 * These describe every capability the app needs from the host platform. The
 * desktop app (Tauri) and a future WeChat mini-program (Taro) each supply a
 * concrete implementation, while the platform-independent `core` logic depends
 * only on these interfaces. See `docs/wechat-miniprogram.md` for the full
 * migration architecture.
 *
 * Adding this file changes no runtime behaviour: it is a pure type contract
 * that the existing desktop modules already satisfy (see `src/platform/desktop`).
 */
import type {
  AppearanceConfig,
  Companion,
  Conversation,
  ConversationSummary,
  DailyStat,
  ProviderConfig,
  Turn,
  UserMemory,
} from "../types";

export type { ASRProvider, LLMProvider, TTSProvider } from "../providers";

/**
 * Structured persistence: companion, memory, settings, conversations, stats.
 *
 * Desktop: SQLite via `@tauri-apps/plugin-sql` (`src/db.ts`).
 * WeChat:  cloud database or `wx.setStorage` (to be implemented in the Taro app).
 */
export interface DataStore {
  loadCompanion(): Promise<Companion>;
  saveCompanion(c: Companion): Promise<void>;

  loadMemory(): Promise<UserMemory>;
  saveMemory(m: UserMemory): Promise<void>;

  loadConfig(): Promise<ProviderConfig>;
  saveConfig(c: ProviderConfig): Promise<void>;

  loadAppearance(): Promise<AppearanceConfig>;
  saveAppearance(a: AppearanceConfig): Promise<void>;

  insertConversation(c: Conversation): Promise<void>;
  finalizeConversation(c: Conversation): Promise<void>;
  attachSummary(id: string, summary: ConversationSummary): Promise<void>;

  insertTurn(conversationId: string, t: Turn): Promise<void>;
  updateTurn(id: string, patch: Partial<Turn>): Promise<void>;
  loadConversations(limit?: number): Promise<Conversation[]>;

  loadStats(days?: number): Promise<DailyStat[]>;
  upsertStatOnEnd(dateISO: string, addedMinutes: number): Promise<void>;
  updateStatScores(dateISO: string, confidence: number, listening: number): Promise<void>;
}

/**
 * Binary media persistence: recorded/synthesised audio, avatars, backgrounds.
 *
 * Desktop: filesystem via `@tauri-apps/plugin-fs` (`src/storage.ts`).
 * WeChat:  `wx.saveFile` / cloud storage (to be implemented in the Taro app).
 */
export interface MediaStore {
  saveUserAudio(conversationId: string, turnId: string, blob: Blob): Promise<string>;
  saveAssistantAudio(conversationId: string, turnId: string, blob: Blob): Promise<string>;
  audioSrc(relPath: string): Promise<string>;
  readAudioBlob(relPath: string): Promise<Blob>;

  saveAvatarFile(file: File): Promise<string>;
  avatarUploadSrc(uploadRef: string): Promise<string>;

  saveBackgroundImage(file: File): Promise<string>;
  backgroundSrc(ref: string): Promise<string | undefined>;
}

/** A handle to in-progress audio playback that can be stopped early. */
export interface PlaybackHandle {
  stop(): void;
  onEnded(cb: () => void): void;
}

/**
 * Microphone capture with a live 0..1 input level for the waveform UI.
 *
 * Desktop: `MediaRecorder` + `AudioContext` (`src/audio.ts` `Recorder`).
 * WeChat:  `wx.getRecorderManager` + `onFrameRecorded` (Taro app).
 */
export interface AudioRecorder {
  start(): Promise<void>;
  /** Subscribe to live volume updates (0..1) while recording. */
  onLevel(cb: (level: number) => void): void;
  /** Stop recording and resolve with the captured audio. */
  stop(): Promise<Blob>;
  /** Stop recording and discard the audio. */
  cancel(): void;
  isRecording(): boolean;
}

/**
 * Audio playback.
 *
 * Desktop: `HTMLAudioElement` (`src/audio.ts` `playBlob`).
 * WeChat:  `wx.createInnerAudioContext` (Taro app).
 */
export interface AudioPlayer {
  play(blob: Blob): Promise<PlaybackHandle>;
}

/** Everything the app needs from its host platform. */
export interface Platform {
  data: DataStore;
  media: MediaStore;
  createRecorder(): AudioRecorder;
  createPlayer(): AudioPlayer;
}
