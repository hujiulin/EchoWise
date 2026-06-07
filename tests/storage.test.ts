import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", async () => await import("./__mocks__/tauri-fs"));
vi.mock("@tauri-apps/api/path", async () => {
  const m = await import("./__mocks__/tauri-fs");
  return { appDataDir: m.appDataDir, join: m.join };
});
vi.mock("@tauri-apps/api/core", async () => {
  const m = await import("./__mocks__/tauri-fs");
  return { convertFileSrc: m.convertFileSrc };
});

import {
  audioSrc,
  avatarUploadSrc,
  backgroundSrc,
  readAudioBlob,
  saveAssistantAudio,
  saveAvatarFile,
  saveBackgroundImage,
  saveUserAudio,
} from "../src/storage";
import { __fsHas, __fsList, __fsRead, __resetFs } from "./__mocks__/tauri-fs";

beforeEach(() => { __resetFs(); });
afterEach(() => { vi.clearAllMocks(); });

function makeFile(name: string, type: string, bytes = "hello"): File {
  return new File([bytes], name, { type });
}

describe("saveUserAudio / saveAssistantAudio", () => {
  it("writes webm under audio/<conv>/", async () => {
    const blob = new Blob(["bytes"], { type: "audio/webm;codecs=opus" });
    const rel = await saveUserAudio("conv1", "turn1", blob);
    expect(rel).toBe("audio/conv1/turn1.webm");
    expect(__fsHas(rel)).toBe(true);
  });
  it("picks mp3 ext for assistant TTS", async () => {
    const blob = new Blob(["bytes"], { type: "audio/mpeg" });
    const rel = await saveAssistantAudio("conv1", "ai1", blob);
    expect(rel.endsWith(".mp3")).toBe(true);
  });
  it("falls back to wav when type indicates wav", async () => {
    const blob = new Blob(["x"], { type: "audio/wav" });
    const rel = await saveUserAudio("c", "t", blob);
    expect(rel.endsWith(".wav")).toBe(true);
  });
});

describe("audioSrc / readAudioBlob", () => {
  it("audioSrc converts to asset URL via convertFileSrc", async () => {
    const url = await audioSrc("audio/conv1/turn1.webm");
    expect(url).toContain("asset://localhost/");
    expect(url).toContain("app-data");
  });
  it("readAudioBlob round-trips bytes with correct mime", async () => {
    await saveUserAudio("c", "t", new Blob(["abc"], { type: "audio/webm" }));
    const out = await readAudioBlob("audio/c/t.webm");
    expect(out.type).toBe("audio/webm");
    expect(await out.text()).toBe("abc");
  });
  it("readAudioBlob mp3 path returns audio/mpeg", async () => {
    await saveAssistantAudio("c", "t", new Blob(["abc"], { type: "audio/mpeg" }));
    const out = await readAudioBlob("audio/c/t.mp3");
    expect(out.type).toBe("audio/mpeg");
  });
});

describe("saveAvatarFile / avatarUploadSrc", () => {
  it("returns upload:<relPath> and picks ext from file name", async () => {
    const ref = await saveAvatarFile(makeFile("me.png", "image/png"));
    expect(ref).toMatch(/^upload:avatars\/[0-9a-f-]+\.png$/);
    expect(__fsList()[0]).toMatch(/^avatars\//);
  });
  it("defaults to png ext when filename has no extension", async () => {
    const ref = await saveAvatarFile(new File(["x"], "noext", { type: "image/png" }));
    expect(ref.endsWith(".png")).toBe(true);
  });
  it("avatarUploadSrc returns asset URL stripping the upload: prefix", async () => {
    const ref = await saveAvatarFile(makeFile("a.png", "image/png"));
    const url = await avatarUploadSrc(ref);
    expect(url).toContain("asset://localhost/");
    expect(url).not.toContain("upload:");
  });
});

describe("saveBackgroundImage / backgroundSrc", () => {
  it("writes under backgrounds/ and returns upload ref", async () => {
    const ref = await saveBackgroundImage(makeFile("bg.jpg", "image/jpeg"));
    expect(ref).toMatch(/^upload:backgrounds\//);
    expect(ref.endsWith(".jpg")).toBe(true);
  });
  it("backgroundSrc returns undefined for empty/preset values", async () => {
    expect(await backgroundSrc("")).toBeUndefined();
    expect(await backgroundSrc("preset:ocean")).toBeUndefined();
  });
  it("backgroundSrc returns URL for upload ref", async () => {
    const ref = await saveBackgroundImage(makeFile("bg.png", "image/png"));
    const url = await backgroundSrc(ref);
    expect(url).toContain("asset://localhost/");
  });
});
