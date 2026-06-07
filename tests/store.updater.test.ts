import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("./__mocks__/tauri-sql");
  return { default: m.default };
});
vi.mock("@tauri-apps/plugin-updater", async () => await import("./__mocks__/tauri-updater"));
vi.mock("@tauri-apps/plugin-process", async () => await import("./__mocks__/tauri-process"));

import { useApp } from "../src/store";
import { __resetDb } from "./__mocks__/tauri-sql";
import {
  __setChunkSizes,
  __setDownloadShouldFail,
  __setNextCheckError,
  __setNextUpdate,
} from "./__mocks__/tauri-updater";
import { relaunch } from "./__mocks__/tauri-process";

beforeEach(async () => {
  __resetDb();
  __setNextUpdate(null);
  __setNextCheckError(undefined);
  __setDownloadShouldFail(false);
  __setChunkSizes([1024]);
  useApp.setState({
    updateStatus: "idle",
    latestUpdate: undefined,
    updateProgress: undefined,
    updateError: undefined,
    lastUpdateCheck: undefined,
  } as Partial<ReturnType<typeof useApp.getState>>);
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("store — updater slice", () => {
  it("checkForUpdate() with no update sets upToDate (when not silent)", async () => {
    await useApp.getState().checkForUpdate();
    expect(useApp.getState().updateStatus).toBe("upToDate");
    expect(useApp.getState().lastUpdateCheck).toBeDefined();
  });

  it("checkForUpdate({ silent: true }) stays idle when no update", async () => {
    await useApp.getState().checkForUpdate({ silent: true });
    expect(useApp.getState().updateStatus).toBe("idle");
    // lastUpdateCheck is still bumped so the UI can show "Last checked X ago"
    expect(useApp.getState().lastUpdateCheck).toBeDefined();
  });

  it("checkForUpdate() with an update transitions to 'available'", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0", body: "notes" });
    await useApp.getState().checkForUpdate();
    expect(useApp.getState().updateStatus).toBe("available");
    expect(useApp.getState().latestUpdate?.version).toBe("0.2.0");
  });

  it("checkForUpdate() error path sets 'error' + message", async () => {
    __setNextCheckError(new Error("offline"));
    await useApp.getState().checkForUpdate();
    expect(useApp.getState().updateStatus).toBe("error");
    expect(useApp.getState().updateError).toMatch(/offline/);
  });

  it("installUpdate(): downloading → installed; tracks progress", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    __setChunkSizes([500, 500]);
    await useApp.getState().checkForUpdate();
    await useApp.getState().installUpdate();
    expect(useApp.getState().updateStatus).toBe("installed");
    expect(useApp.getState().updateProgress?.downloaded).toBe(1000);
    expect(useApp.getState().updateProgress?.total).toBe(1000);
  });

  it("installUpdate() failure sets 'error' status", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    __setDownloadShouldFail(true);
    await useApp.getState().checkForUpdate();
    await useApp.getState().installUpdate();
    expect(useApp.getState().updateStatus).toBe("error");
    expect(useApp.getState().updateError).toMatch(/download failed/);
  });

  it("installUpdate() is a no-op when no update available", async () => {
    await useApp.getState().installUpdate();
    // status unchanged from idle
    expect(useApp.getState().updateStatus).toBe("idle");
  });

  it("restartForUpdate() calls plugin-process.relaunch", async () => {
    await useApp.getState().restartForUpdate();
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it("dismissUpdate() resets to idle and clears latestUpdate", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    await useApp.getState().checkForUpdate();
    useApp.getState().dismissUpdate();
    expect(useApp.getState().updateStatus).toBe("idle");
    expect(useApp.getState().latestUpdate).toBeUndefined();
  });
});
