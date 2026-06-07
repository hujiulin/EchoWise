import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// crypto.randomUUID is used everywhere — jsdom doesn't ship it on older Node.
if (!globalThis.crypto?.randomUUID) {
  let seq = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    ...((globalThis as any).crypto ?? {}),
    randomUUID: () => {
      seq += 1;
      return `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`;
    },
  };
}

// matchMedia is consumed by AppearanceHost
if (!window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom's Blob/File don't implement arrayBuffer / text in older versions.
// Add polyfills so storage helpers can read uploaded files.
if (!Blob.prototype.arrayBuffer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Blob.prototype as any).arrayBuffer = async function () {
    const reader = new FileReader();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this as Blob);
    });
  };
}
if (!Blob.prototype.text) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Blob.prototype as any).text = async function () {
    const buf = await (this as Blob).arrayBuffer();
    return new TextDecoder().decode(buf);
  };
}

// jsdom lacks scrollTo on Element/Window
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(Element.prototype as any).scrollTo) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollTo = function () { /* noop */ };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(window as any).scrollTo) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).scrollTo = function () { /* noop */ };
}

// jsdom doesn't implement HTMLMediaElement play/pause/load — give safe no-ops
// so AssistantVoiceBubble cleanup paths don't throw.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MEDIA_PROTO = (globalThis as any).HTMLMediaElement?.prototype;
if (MEDIA_PROTO) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MEDIA_PROTO as any).play  = async function () { /* noop */ };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MEDIA_PROTO as any).pause = function () { /* noop */ };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MEDIA_PROTO as any).load  = function () { /* noop */ };
}

// localStorage is used directly by store/migration helpers.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Silence noisy console.warn we expect during fallback paths
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = vi.fn();
});
afterEach(() => {
  console.warn = originalWarn;
});
