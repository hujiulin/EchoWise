import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Thin wrapper around tauri-plugin-updater so the rest of the app talks to
 * a friendly API. All functions are no-ops on web/test environments where
 * the plugin isn't available — callers don't have to special-case.
 */

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
}

export interface UpdateProgress {
  /** Bytes downloaded so far in this session. */
  downloaded: number;
  /** Total content length, if the server reported one. */
  total?: number;
}

/**
 * Check the configured endpoint for a newer version.
 *
 * - Returns null when the app is up to date.
 * - By default ("silent"), swallows network/transport errors and returns null
 *   so an auto-check on startup doesn't surface noise. Pass `{ silent: false }`
 *   to surface errors to the caller — used by the in-app "Check for updates"
 *   button so failures become visible to the user.
 */
export async function checkForUpdate(opts?: { silent?: boolean }): Promise<AvailableUpdate | null> {
  const silent = opts?.silent ?? true;
  try {
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      notes: update.body,
      date: update.date,
    };
  } catch (e) {
    console.warn("update check failed", e);
    if (silent) return null;
    throw e;
  }
}

/**
 * Download + install the update. Streams progress through `onProgress`.
 * Resolves once the new binary is staged; call `restartApp()` next.
 */
export async function downloadAndInstall(
  onProgress?: (p: UpdateProgress) => void
): Promise<void> {
  const update = await check();
  if (!update) throw new Error("No update available.");
  let downloaded = 0;
  let total: number | undefined;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength;
      downloaded = 0;
      onProgress?.({ downloaded, total });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
    } else if (event.event === "Finished") {
      onProgress?.({ downloaded, total });
    }
  });
}

export async function restartApp(): Promise<void> {
  await relaunch();
}

/** Re-export the raw Update type for advanced callers. */
export type { Update };
