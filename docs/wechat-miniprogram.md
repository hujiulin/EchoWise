# WeChat Mini-Program Migration Guide

This document describes how EchoWise is being restructured so that the same
business logic can power both the existing **desktop app (Tauri + React)** and a
future **WeChat mini-program (Taro + React)**.

It is the reference cited from `src/core/ports.ts` and `src/core/index.ts`.

---

## 1. Goal

Ship EchoWise as a WeChat mini-program **without rewriting the domain logic**.
The strategy is *not* to fork the codebase, but to split it into three layers so
the top layer (business logic) stays identical across platforms and only the
bottom layer (host bindings) is re-implemented per platform.

```
┌──────────────────────────────────────────────┐
│ UI  (React components)                        │  shared where possible
├──────────────────────────────────────────────┤
│ core/  — pure, platform-independent logic     │  100% shared
│   types · scoring · companions · appearance   │
│   AI coaching pipeline (prompt build / parse) │
│   port interfaces (ports.ts)                  │
├──────────────────────────────────────────────┤
│ platform/<host>/  — concrete port adapters    │  one impl per platform
│   desktop (Tauri)   ·   wechat (Taro)         │
└──────────────────────────────────────────────┘
```

The contract between the middle and bottom layer is `src/core/ports.ts`.

---

## 2. What already exists

| Layer | Location | Status |
| ----- | -------- | ------ |
| Pure domain types | `src/types.ts` (re-exported by `src/core/index.ts`) | ✅ shared |
| Scoring | `src/scoring.ts` | ✅ shared |
| Companion presets | `src/companions.ts` | ✅ shared |
| Appearance logic | `src/appearance.ts` | ✅ shared |
| AI coaching pipeline | `companionTurn` / `reviewSentence` / `summarizeSession` / `ttsInstructions` in `src/providers.ts` | ✅ shared (transport-agnostic) |
| Port interfaces | `src/core/ports.ts` | ✅ defined |
| Desktop adapters | `src/platform/desktop/index.ts` | ✅ implemented |
| **WeChat adapters** | `src/platform/wechat/*` | ❌ **not started** |
| UI wired to ports (DI) | `src/store.ts`, `src/components/*` | ⚠️ still import desktop modules directly |

The AI coaching functions are already platform-neutral: they accept an
`LLMProvider` and only build prompts / parse JSON. The **HTTP transport**
(`CompatASR` / `CompatLLM` / `CompatTTS`) is the platform concern.

---

## 3. The port contract (`src/core/ports.ts`)

Everything the app needs from its host is described by four interfaces plus a
`Platform` aggregate:

| Port | Responsibility | Desktop impl | WeChat impl (TODO) |
| ---- | -------------- | ------------ | ------------------ |
| `DataStore` | structured persistence (companion, memory, config, conversations, stats) | SQLite via `@tauri-apps/plugin-sql` (`src/db.ts`) | cloud database, or `wx.setStorage` for small data |
| `MediaStore` | binary media (recorded/synthesised audio, avatars, backgrounds) | filesystem via `@tauri-apps/plugin-fs` (`src/storage.ts`) | `wx.saveFile` / `wx.getFileSystemManager` / cloud storage |
| `AudioRecorder` | mic capture with live 0..1 level | `MediaRecorder` + `AudioContext` (`src/audio.ts`) | `wx.getRecorderManager` + `onFrameRecorded` |
| `AudioPlayer` | play a captured/synthesised blob | `HTMLAudioElement` (`src/audio.ts`) | `wx.createInnerAudioContext` |
| network (ASR/LLM/TTS) | AI transport over HTTP | `fetch` (`src/providers.ts`) | `wx.request` / `wx.uploadFile` |

Adding a platform means supplying one object that satisfies `Platform`, exactly
as `desktopPlatform` does today.

---

## 4. Remaining work (roadmap)

### Phase A — finish the abstraction (desktop only, no behaviour change)
1. **Inject the platform into the UI.** `src/store.ts` and
   `src/components/Conversation.tsx` still import `./db`, `../audio`,
   `../storage`, `../providers` directly. Route them through a single injected
   `Platform` instance so no component references a host API.
2. **Abstract the network transport.** `CompatASR/LLM/TTS` use `fetch`; expose
   them through a `createNetwork(cfg)` port so WeChat can swap in `wx.request`.
3. **Abstract the updater.** `src/updater.ts` is Tauri-only and has no
   mini-program equivalent; make it a no-op-able port.

### Phase B — WeChat platform
4. **Tooling.** Introduce Taro (React flavour) and a mini-program build target.
5. **Adapters.** Implement `src/platform/wechat/` for all ports in the table above.
6. **UI shell.** Replace DOM-only pieces (`HTMLAudioElement`, `<audio>`,
   `AudioContext` waveform, file `<input>` pickers) with Taro components and
   `wx.*` equivalents. Convert Tailwind/CSS to mini-program-compatible styling.
7. **Config & compliance.** API keys / provider endpoints must move server-side
   (WeChat forbids arbitrary client requests to unregistered domains); register
   `request`/`uploadFile` domains; handle the review process.

### Phase C — polish
8. Shared UI extraction where practical, mini-program packaging, store submission.

---

## 5. Summary — how far are we from the WeChat goal?

**Roughly 20–25% of the way there.** The foundation is in place, but no
mini-program code exists yet.

**Done**
- Platform-independent `core/` layer (types, scoring, companions, appearance,
  transport-agnostic AI pipeline).
- Formal `Platform` port contract that captures every host dependency.
- A complete desktop implementation of that contract, proving the ports are
  accurate.

**Not done (the bulk of the effort)**
- The UI still calls desktop modules directly, so the ports aren't actually the
  seam yet (Phase A).
- Zero WeChat/Taro code: no build tooling, no adapters, no `wx.*` bindings
  (Phase B — the largest chunk).
- Platform realities not yet addressed: server-side proxy for AI keys, domain
  whitelisting, mini-program packaging and review (Phase C).

**Critical path / biggest risks**
- Audio: live recording with per-frame volume and blob playback maps to a very
  different `wx.getRecorderManager` / `InnerAudioContext` model.
- Networking: WeChat's domain whitelist and ban on ad-hoc client requests will
  force AI calls behind a backend proxy.
- Rendering: DOM/Tailwind assumptions must be reworked for WXML/WXSS via Taro.

In short: the **architecture** for going cross-platform is established; the
**WeChat-specific implementation** has not started.
