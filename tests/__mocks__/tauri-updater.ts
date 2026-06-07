/**
 * Mock for the Tauri updater plugin. Tests pull in via `vi.mock` and
 * control behavior through `__setNextUpdate` / `__setNextCheckError`.
 */
import { vi } from "vitest";

interface MockUpdate {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

let nextUpdate: MockUpdate | null = null;
let nextError: Error | undefined;
let downloadShouldFail = false;
let chunkSizes: number[] = [];

export function __setNextUpdate(u: MockUpdate | null) { nextUpdate = u; }
export function __setNextCheckError(e: Error | undefined) { nextError = e; }
export function __setDownloadShouldFail(b: boolean) { downloadShouldFail = b; }
export function __setChunkSizes(sizes: number[]) { chunkSizes = sizes; }

export const check = vi.fn(async () => {
  if (nextError) {
    const e = nextError;
    nextError = undefined;
    throw e;
  }
  if (!nextUpdate) return null;
  const u = nextUpdate;
  return {
    ...u,
    downloadAndInstall: async (
      cb: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void
    ) => {
      if (downloadShouldFail) throw new Error("download failed");
      const total = chunkSizes.reduce((a, b) => a + b, 0);
      cb({ event: "Started", data: { contentLength: total } });
      for (const size of chunkSizes) {
        cb({ event: "Progress", data: { chunkLength: size } });
      }
      cb({ event: "Finished" });
    },
  };
});

export type Update = MockUpdate;
