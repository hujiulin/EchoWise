<div align="center">

# EchoWise

**Just talk.**

An open-source, cross-platform desktop AI companion for English speaking & listening practice.
Have natural conversations with an AI that grows with you — no lessons, no drills, no tests.

[![CI](https://github.com/hujiulin/EchoWise/actions/workflows/ci.yml/badge.svg)](https://github.com/hujiulin/EchoWise/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](#testing)

English ｜ [简体中文](README.zh.md)

</div>

---

## Philosophy

> Stop studying English. Start using English.

Most English-learning apps teach you English. EchoWise helps you **use** it.

We don't drill vocabulary, hand out exercises, or assign grades. We let you build real communication ability by having ordinary daily conversations with an AI companion who becomes increasingly familiar over time.

- **Communication before perfection** — Imperfect English that connects beats perfect grammar that stays silent
- **Relationship before knowledge** — A polite stranger on Day 1, an easy old friend by Day 180
- **Gentle nudges, never interruptions** — No lectures mid-sentence; one-glance hints when something's worth a tweak
- **Local-first** — All data lives on your machine, nothing leaves it

---

## Features

| | |
|---|---|
| 🗣️ **A companion that grows** | One companion you name, style (avatar / voice / persona) and shape. Day-count + a 5-tier relationship arc (stranger → old friend) that the AI's tone naturally follows. |
| 🎙️ **Voice-first conversation** | Speak via mic or type — both work. Voice-message-style bubbles: tap the waveform to play; transcript is one click away. |
| 💡 **Non-intrusive coaching** | The AI never lectures mid-reply. A 1–100 score chip in 5 colors (Try again / Getting there / Clear / Natural / Native-like) sits quietly on your bubble. |
| 📈 **Growth that actually means something** | Confidence trend (5-sentence rolling average, updates as you talk) · 5-band distribution · auto-picked "best so far" + "worth revisiting". |
| 🎨 **Full appearance customization** | Theme (system / light / dark), 4 fonts, 4 sizes, 6 preset gradient backgrounds or upload your own. |
| 🔌 **Multi-provider** | OpenAI / Azure OpenAI with one click. Defaults: `gpt-5` + `gpt-4o-transcribe` + `gpt-4o-mini-tts` (voice instructions adapt to your companion's persona). |
| 💾 **Fully local** | SQLite + filesystem. Every conversation, recording, and AI voice clip stays on your machine forever. |

---

## Screenshots

> _Screenshots coming soon._

---

## Quick Start

### 1. Prerequisites

| Tool | Why | Install |
|---|---|---|
| **Node.js ≥ 18** | Frontend bundler | <https://nodejs.org> |
| **Rust (stable)** | Tauri backend | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Platform SDK** | Native toolchain | macOS: `xcode-select --install`<br>Windows: VS Build Tools<br>Linux: `webkit2gtk` |

Verify:
```bash
node -v && rustc -V && cargo -V
```

### 2. Run (dev)

```bash
git clone https://github.com/hujiulin/EchoWise.git
cd EchoWise
npm install
npm run dev
```

Vite starts, Rust compiles, the native desktop window pops open (~2–3 min the first time, incremental builds in seconds after).

> **macOS devs**: after the first launch, open a separate terminal and run `npm run sign:dev` to inject the microphone entitlement into the dev binary — otherwise macOS denies `getUserMedia`. See [scripts/tauri-dev.sh](scripts/tauri-dev.sh) for the full story.

### 3. Build a release

```bash
# One-time: generate platform icons
npx @tauri-apps/cli icon src-tauri/icons/icon.svg

npm run build
```

Installers land in `src-tauri/target/release/bundle/`:
- macOS → `.dmg` / `.app`
- Windows → `.msi` / `.exe`
- Linux → `.AppImage` / `.deb`

### 4. First-run configuration

Launch and open **Settings → AI provider**:

| Field | Default |
|---|---|
| Provider | OpenAI |
| Base URL | `https://api.openai.com/v1` |
| LLM model | `gpt-5` |
| ASR model | `gpt-4o-transcribe` |
| TTS model | `gpt-4o-mini-tts` |
| TTS voice | `nova` |

Paste your API key → **Test connection** → **Save**.

**Azure OpenAI** also works: flip the preset at the top, fill in endpoint + api-version + three deployment names.

---

## Where data lives

Everything stays on **your** machine — nothing is uploaded.

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/com.echowise.app/` |
| Windows | `%APPDATA%\com.echowise.app\` |
| Linux | `~/.local/share/com.echowise.app/` |

```
com.echowise.app/
├── echowise.db        # SQLite — companion, conversations, turns, stats, prefs
├── audio/<convId>/    # Your recordings (webm) + AI TTS playback (mp3)
├── avatars/           # Uploaded companion avatars
└── backgrounds/       # Uploaded background images
```

Uninstalling the app **doesn't** auto-delete this folder. Remove it manually for a clean wipe.

---

## Tech stack

- **Desktop shell**: [Tauri 2](https://tauri.app/) (Rust)
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + custom shadcn-style primitives
- **State**: Zustand
- **Database**: SQLite via [tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql)
- **Icons**: [lucide-react](https://lucide.dev/)
- **Tests**: Vitest + Testing Library

---

## Project layout

```
EchoWise/
├── src/                        # React frontend
│   ├── App.tsx
│   ├── store.ts                # Zustand state + idle auto-end
│   ├── db.ts                   # Typed SQLite query layer
│   ├── providers.ts            # OpenAI / Azure adapters + coaching fns
│   ├── storage.ts              # Audio / avatar / background file IO
│   ├── audio.ts                # MediaRecorder + AudioContext live waveform
│   ├── scoring.ts              # 5-band scoring system
│   ├── appearance.ts           # Appearance presets
│   ├── companions.ts           # Companion defaults + topic pools
│   └── components/
│       ├── Conversation.tsx    # Main chat screen (Empty / History / Recap)
│       ├── Growth.tsx          # Growth dashboard
│       ├── Companions.tsx      # Companion editor
│       ├── Settings.tsx        # Settings (Appearance / Provider / About tabs)
│       └── ui/                 # Button / Card / Badge / Input / Separator
├── src-tauri/                  # Rust desktop shell
│   ├── src/main.rs             # SQLite migrations + Tauri plugins
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── icons/
├── tests/                      # Vitest unit tests (256 tests, 94% coverage)
├── .github/workflows/
│   ├── ci.yml                  # PR / push: tests + build
│   └── release.yml             # tag v* → dmg / msi / appimage
└── scripts/
    └── tauri-dev.sh            # Auto-codesign in macOS dev
```

---

## Testing

```bash
npm test               # one-shot
npm run test:watch     # watch mode
npm run test:ui        # browser UI
npm run test:coverage  # write HTML report to coverage/
```

**Current coverage**: 256 tests / 30 files / **94.5% lines** / 82% branches / 87% funcs.

| Module | Line coverage |
|---|---|
| `src/lib/`, `src/components/ui/` | 100% |
| `appearance` / `companions` / `scoring` / `types` | 100% |
| `db` / `audio` / `storage` / `providers` | 97–100% |
| `store` | 93.5% |
| `Conversation` (recording / TTS / history / recap) | 91.6% |

---

## Release flow

Push a git tag and CI handles the rest:

```bash
git tag v0.1.0
git push origin v0.1.0
```

[.github/workflows/release.yml](.github/workflows/release.yml) fans out across three runners in parallel:
- macOS (Apple Silicon, `aarch64`)
- macOS (Intel, `x86_64`)
- Windows (`x86_64`)

Roughly 10–15 minutes later, a draft Release shows up on GitHub Releases — review and hit Publish.

---

## Roadmap

- [x] M1 — Single companion + voice chat + scoring
- [x] M2 — Conversation history resume + Day-based relationship arc
- [x] M3 — Appearance theming + custom backgrounds
- [x] M4 — GitHub Actions auto-build
- [ ] M5 — Long-term memory (companion volunteers callbacks to interests / projects)
- [ ] M6 — Offline mode (local Whisper.cpp + Ollama + Piper)
- [ ] M7 — Mobile

---

## Contributing

Issues and PRs are welcome.

Before opening a PR:
1. `npm test` passes
2. Cover new features with unit tests
3. `npm run vite:build` type-checks cleanly
4. Keep code and comments in English (UI copy may be localized)

---

## License

[MIT](LICENSE) © EchoWise contributors

---

<div align="center">
  <sub>Learn English by talking. No tests. No drills.</sub>
</div>
