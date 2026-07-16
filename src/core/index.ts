/**
 * `core` — the platform-independent heart of EchoWise.
 *
 * Everything re-exported here is pure TypeScript with no dependency on Tauri,
 * the DOM, `fetch`, `MediaRecorder`, or any other host-specific API. It can be
 * consumed unchanged by the desktop app (Tauri) and by a future WeChat
 * mini-program built with Taro.
 *
 * Platform-specific behaviour (persistence, audio capture/playback, network
 * transport) is expressed through the interfaces in `./ports` and implemented
 * per-platform under `src/platform/*`.
 */

/* ---------- domain types ---------- */
export * from "../types";

/* ---------- pure business logic ---------- */
export * from "../scoring";
export * from "../companions";
export * from "../appearance";

/* ---------- AI coaching pipeline (transport-agnostic) ----------
 * These functions take an `LLMProvider` and only build prompts / parse JSON —
 * the actual HTTP transport is a platform concern (see ports + adapters).
 */
export {
  companionTurn,
  reviewSentence,
  summarizeSession,
  ttsInstructions,
} from "../providers";
export type { ASRProvider, LLMProvider, TTSProvider } from "../providers";

/* ---------- platform port contracts ---------- */
export * from "./ports";
