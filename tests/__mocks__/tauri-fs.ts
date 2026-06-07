import { vi } from "vitest";

/**
 * Mock of @tauri-apps/plugin-fs and @tauri-apps/api/path + core.
 * Backed by an in-memory map keyed by relative path.
 */

const fs = new Map<string, Uint8Array>();
const dirs = new Set<string>();

export function __resetFs() {
  fs.clear();
  dirs.clear();
}
export function __fsHas(path: string) { return fs.has(path); }
export function __fsRead(path: string) { return fs.get(path); }
export function __fsList() { return [...fs.keys()]; }

export const BaseDirectory = { AppData: 9 } as const;

export const mkdir = vi.fn(async (p: string) => { dirs.add(p); });
export const exists = vi.fn(async (p: string) => dirs.has(p));
export const writeFile = vi.fn(async (p: string, data: Uint8Array) => { fs.set(p, data); dirs.add(p.replace(/\/[^/]+$/, "")); });
export const readFile = vi.fn(async (p: string) => {
  const buf = fs.get(p);
  if (!buf) throw new Error(`mock fs: ENOENT ${p}`);
  return buf;
});

// path + core
export const appDataDir = vi.fn(async () => "/app-data");
export const join = vi.fn(async (...parts: string[]) => parts.join("/"));
export const convertFileSrc = vi.fn((abs: string) => `asset://localhost/${encodeURIComponent(abs)}`);
