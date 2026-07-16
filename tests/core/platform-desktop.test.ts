import { afterEach, describe, expect, it, vi } from "vitest";

// db.ts / storage.ts touch Tauri plugins at import time — wire the same
// in-memory mocks the existing suites use so the adapters can be imported.
vi.mock("@tauri-apps/plugin-sql", async () => {
  const mod = await import("../__mocks__/tauri-sql");
  return { default: mod.default };
});
vi.mock("@tauri-apps/plugin-fs", async () => await import("../__mocks__/tauri-fs"));
vi.mock("@tauri-apps/api/path", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { appDataDir: m.appDataDir, join: m.join };
});
vi.mock("@tauri-apps/api/core", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { convertFileSrc: m.convertFileSrc };
});

import * as db from "../../src/db";
import * as storage from "../../src/storage";
import { Recorder } from "../../src/audio";
import { CompatASR, CompatLLM, CompatTTS } from "../../src/providers";
import type { ProviderConfig } from "../../src/types";
import {
  createDesktopNetwork,
  createDesktopPlayer,
  createDesktopRecorder,
  desktopDataStore,
  desktopMediaStore,
  desktopPlatform,
} from "../../src/platform/desktop";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("desktop DataStore adapter", () => {
  it("delegates every method to the SQLite db module", () => {
    expect(desktopDataStore.loadCompanion).toBe(db.loadCompanion);
    expect(desktopDataStore.saveCompanion).toBe(db.saveCompanion);
    expect(desktopDataStore.loadMemory).toBe(db.loadMemory);
    expect(desktopDataStore.saveMemory).toBe(db.saveMemory);
    expect(desktopDataStore.loadConfig).toBe(db.loadConfig);
    expect(desktopDataStore.saveConfig).toBe(db.saveConfig);
    expect(desktopDataStore.loadAppearance).toBe(db.loadAppearance);
    expect(desktopDataStore.saveAppearance).toBe(db.saveAppearance);
    expect(desktopDataStore.insertConversation).toBe(db.insertConversation);
    expect(desktopDataStore.finalizeConversation).toBe(db.finalizeConversation);
    expect(desktopDataStore.attachSummary).toBe(db.attachSummary);
    expect(desktopDataStore.insertTurn).toBe(db.insertTurn);
    expect(desktopDataStore.updateTurn).toBe(db.updateTurn);
    expect(desktopDataStore.loadConversations).toBe(db.loadConversations);
    expect(desktopDataStore.loadStats).toBe(db.loadStats);
    expect(desktopDataStore.upsertStatOnEnd).toBe(db.upsertStatOnEnd);
    expect(desktopDataStore.updateStatScores).toBe(db.updateStatScores);
  });
});

describe("desktop MediaStore adapter", () => {
  it("delegates every method to the filesystem storage module", () => {
    expect(desktopMediaStore.saveUserAudio).toBe(storage.saveUserAudio);
    expect(desktopMediaStore.saveAssistantAudio).toBe(storage.saveAssistantAudio);
    expect(desktopMediaStore.audioSrc).toBe(storage.audioSrc);
    expect(desktopMediaStore.readAudioBlob).toBe(storage.readAudioBlob);
    expect(desktopMediaStore.saveAvatarFile).toBe(storage.saveAvatarFile);
    expect(desktopMediaStore.avatarUploadSrc).toBe(storage.avatarUploadSrc);
    expect(desktopMediaStore.saveBackgroundImage).toBe(storage.saveBackgroundImage);
    expect(desktopMediaStore.backgroundSrc).toBe(storage.backgroundSrc);
  });
});

describe("desktop recorder adapter", () => {
  it("creates a Recorder that satisfies the AudioRecorder port", () => {
    const rec = createDesktopRecorder();
    expect(rec).toBeInstanceOf(Recorder);
    expect(typeof rec.start).toBe("function");
    expect(typeof rec.onLevel).toBe("function");
    expect(typeof rec.stop).toBe("function");
    expect(typeof rec.cancel).toBe("function");
    expect(rec.isRecording()).toBe(false);
  });
});

describe("desktop player adapter", () => {
  it("wraps HTMLAudioElement playback in a PlaybackHandle", async () => {
    const pauseSpy = vi.fn();
    const addSpy = vi.fn();
    const playSpy = vi.fn(async () => undefined);
    class FakeAudio {
      src: string;
      currentTime = 5;
      addEventListener = addSpy;
      pause = pauseSpy;
      play = playSpy;
      constructor(src: string) { this.src = src; }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Audio = FakeAudio as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");

    const player = createDesktopPlayer();
    const handle = await player.play(new Blob(["data"]));
    expect(playSpy).toHaveBeenCalledOnce();

    const onEnded = vi.fn();
    handle.onEnded(onEnded);
    expect(addSpy).toHaveBeenCalledWith("ended", onEnded);

    handle.stop();
    expect(pauseSpy).toHaveBeenCalledOnce();
  });
});

describe("desktop network adapter", () => {
  const cfg: ProviderConfig = {
    provider: "openai",
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com/v1",
    azureEndpoint: "",
    azureApiVersion: "2025-04-01-preview",
    asrModel: "gpt-4o-transcribe",
    llmModel: "gpt-5",
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "nova",
  };

  it("builds the fetch-based Compat providers from a config", () => {
    const net = createDesktopNetwork(cfg);
    expect(net.asr).toBeInstanceOf(CompatASR);
    expect(net.llm).toBeInstanceOf(CompatLLM);
    expect(net.tts).toBeInstanceOf(CompatTTS);
  });
});

describe("desktopPlatform", () => {
  it("bundles data, media and audio factories", () => {
    expect(desktopPlatform.data).toBe(desktopDataStore);
    expect(desktopPlatform.media).toBe(desktopMediaStore);
    expect(desktopPlatform.createRecorder).toBe(createDesktopRecorder);
    expect(desktopPlatform.createPlayer).toBe(createDesktopPlayer);
  });
});
