/**
 * Desktop (Tauri) implementation of the platform ports.
 *
 * These are thin adapters that delegate to the existing desktop modules
 * (`src/db.ts`, `src/storage.ts`, `src/audio.ts`, `src/providers.ts`). They add
 * no new behaviour — they simply prove that the ports in `core/ports.ts`
 * accurately describe what the desktop app already does, and give the app (and
 * a future Taro app) a single, swappable `Platform` object to depend on.
 */
import * as db from "../../db";
import * as storage from "../../storage";
import { Recorder, playBlob } from "../../audio";
import { CompatASR, CompatLLM, CompatTTS } from "../../providers";
import type { ProviderConfig } from "../../types";
import type {
  AudioPlayer,
  AudioRecorder,
  DataStore,
  MediaStore,
  Platform,
  PlaybackHandle,
} from "../../core/ports";

/** SQLite-backed structured store. */
export const desktopDataStore: DataStore = {
  loadCompanion: db.loadCompanion,
  saveCompanion: db.saveCompanion,
  loadMemory: db.loadMemory,
  saveMemory: db.saveMemory,
  loadConfig: db.loadConfig,
  saveConfig: db.saveConfig,
  loadAppearance: db.loadAppearance,
  saveAppearance: db.saveAppearance,
  insertConversation: db.insertConversation,
  finalizeConversation: db.finalizeConversation,
  attachSummary: db.attachSummary,
  insertTurn: db.insertTurn,
  updateTurn: db.updateTurn,
  loadConversations: db.loadConversations,
  loadStats: db.loadStats,
  upsertStatOnEnd: db.upsertStatOnEnd,
  updateStatScores: db.updateStatScores,
};

/** Filesystem-backed media store. */
export const desktopMediaStore: MediaStore = {
  saveUserAudio: storage.saveUserAudio,
  saveAssistantAudio: storage.saveAssistantAudio,
  audioSrc: storage.audioSrc,
  readAudioBlob: storage.readAudioBlob,
  saveAvatarFile: storage.saveAvatarFile,
  avatarUploadSrc: storage.avatarUploadSrc,
  saveBackgroundImage: storage.saveBackgroundImage,
  backgroundSrc: storage.backgroundSrc,
};

/** `MediaRecorder` + `AudioContext` recorder (matches `AudioRecorder`). */
export function createDesktopRecorder(): AudioRecorder {
  return new Recorder();
}

/** `HTMLAudioElement` playback wrapped as a platform-neutral `PlaybackHandle`. */
export function createDesktopPlayer(): AudioPlayer {
  return {
    async play(blob: Blob): Promise<PlaybackHandle> {
      const el = await playBlob(blob);
      return {
        stop() {
          try {
            el.pause();
            el.currentTime = 0;
          } catch {
            /* ignore */
          }
        },
        onEnded(cb: () => void) {
          el.addEventListener("ended", cb);
        },
      };
    },
  };
}

/** AI transport (ASR / LLM / TTS) over `fetch`, bound to a provider config. */
export function createDesktopNetwork(cfg: ProviderConfig) {
  return {
    asr: new CompatASR(cfg),
    llm: new CompatLLM(cfg),
    tts: new CompatTTS(cfg),
  };
}

/** The complete desktop platform. */
export const desktopPlatform: Platform = {
  data: desktopDataStore,
  media: desktopMediaStore,
  createRecorder: createDesktopRecorder,
  createPlayer: createDesktopPlayer,
};
