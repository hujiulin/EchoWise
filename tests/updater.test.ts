import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-updater", async () => await import("./__mocks__/tauri-updater"));
vi.mock("@tauri-apps/plugin-process", async () => await import("./__mocks__/tauri-process"));

import {
  checkForUpdate,
  downloadAndInstall,
  restartApp,
} from "../src/updater";
import {
  __setChunkSizes,
  __setDownloadShouldFail,
  __setNextCheckError,
  __setNextUpdate,
} from "./__mocks__/tauri-updater";
import { relaunch } from "./__mocks__/tauri-process";

beforeEach(() => {
  __setNextUpdate(null);
  __setNextCheckError(undefined);
  __setDownloadShouldFail(false);
  __setChunkSizes([512, 512, 512]);
});

afterEach(() => { vi.clearAllMocks(); });

describe("checkForUpdate()", () => {
  it("returns null when no update available", async () => {
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns shape with version + notes when update available", async () => {
    __setNextUpdate({
      version: "0.2.0", currentVersion: "0.1.0",
      body: "Bug fixes", date: "2026-06-07",
    });
    const out = await checkForUpdate();
    expect(out).toMatchObject({
      version: "0.2.0",
      currentVersion: "0.1.0",
      notes: "Bug fixes",
      date: "2026-06-07",
    });
  });

  it("returns null + warns when plugin throws (silent default)", async () => {
    __setNextCheckError(new Error("network down"));
    expect(await checkForUpdate()).toBeNull();
  });

  it("re-throws when called with silent=false", async () => {
    __setNextCheckError(new Error("network down"));
    await expect(checkForUpdate({ silent: false })).rejects.toThrow(/network down/);
  });
});

describe("downloadAndInstall()", () => {
  it("throws when no update is available", async () => {
    await expect(downloadAndInstall()).rejects.toThrow(/No update/);
  });

  it("streams progress events and finishes", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    __setChunkSizes([100, 200, 300]);
    const events: { downloaded: number; total?: number }[] = [];
    await downloadAndInstall((p) => events.push(p));
    expect(events.length).toBeGreaterThanOrEqual(4); // started + 3 progress + finished
    expect(events[0].total).toBe(600);
    expect(events[events.length - 1].downloaded).toBe(600);
  });

  it("propagates download errors", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    __setDownloadShouldFail(true);
    await expect(downloadAndInstall()).rejects.toThrow(/download failed/);
  });
});

describe("restartApp()", () => {
  it("calls relaunch()", async () => {
    await restartApp();
    expect(relaunch).toHaveBeenCalledOnce();
  });
});
