<div align="center">

# EchoWise

**Just talk.**

一款开源、跨平台的桌面端 AI 英语口语 / 听力陪练应用。
和会成长的 AI 伴侣自然对话——不上课、不刷题、不考试。

[![CI](https://github.com/hujiulin/EchoWise/actions/workflows/ci.yml/badge.svg)](https://github.com/hujiulin/EchoWise/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](#测试)

[English](README.md) ｜ 简体中文

</div>

---

## 设计哲学

> Stop studying English. Start using English.

大多数英语 App 教你学英语。EchoWise 帮你**使用**英语。

我们不教单词、不出习题、不打分排名。我们让你通过日常对话——和一个会变得越来越熟悉的 AI 伴侣——把英语真正用起来。

- **沟通先于正确** — 能交流的不完美英语，比沉默的完美语法更重要
- **关系先于知识** — Day 1 客气陌生人，Day 30 老朋友的随意
- **轻量提示，不打断** — 错了不会被纠正打断，需要时一眼瞄一下
- **本地优先** — 全部数据存你机器，不上传任何地方

---

## 主要功能

| | |
|---|---|
| 🗣️ **一个会成长的伴侣** | 单一伴侣，由你命名、选头像/声线、定义性格。Day 计数 + 5 段关系演变（陌生 → 老朋友），AI 语气随之自然变化。 |
| 🎙️ **语音对话** | 麦克风 / 文字输入随意切换。语音消息式气泡，点波纹即播；可选展开转录文本。 |
| 💡 **不打断式提示** | AI 回复中绝不夹带语法说教；用户气泡角落自动出现 1–100 分 chip + 5 档颜色（Try again / Getting there / Clear / Natural / Native-like）。 |
| 📈 **真正的成长曲线** | 信心趋势（最近 5 句滚动均值，说话就更新）、5 档分布、自动挑出"最棒一句"和"值得再说一次的一句"。 |
| 🎨 **完整外观定制** | 主题（自动 / 浅色 / 深色）、4 种字体、4 档字号、6 套预设背景渐变或上传自己的图片。 |
| 🔌 **多 Provider 支持** | OpenAI / Azure OpenAI 一键切换。默认 `gpt-5` + `gpt-4o-transcribe` + `gpt-4o-mini-tts`（声线根据伴侣人设动态调整）。 |
| 🔄 **自动更新** | 应用内带签名的更新器：启动时静默检查，有新版一键安装。 |
| 💾 **完全本地** | SQLite + 文件系统。所有对话、录音、AI 语音回放永久留在你机器上。 |

---

## 截图

> _截图待补充_

---

## 立即开始

### 1. 准备环境

| 工具 | 用途 | 安装 |
|---|---|---|
| **Node.js ≥ 18** | 前端打包 | <https://nodejs.org> |
| **Rust (stable)** | Tauri 后端 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **平台 SDK** | 原生编译链 | macOS: `xcode-select --install`<br>Windows: VS Build Tools<br>Linux: `webkit2gtk` |

验证：
```bash
node -v && rustc -V && cargo -V
```

### 2. 运行 (开发)

```bash
git clone https://github.com/hujiulin/EchoWise.git
cd EchoWise
npm install
npm run dev
```

会自动启动 Vite + 编译 Rust + 弹出原生桌面窗口（首次约 2–3 分钟，之后增量编译几秒）。

> **macOS 开发者注意**：首次启动后，**新开一个终端** 跑 `npm run sign:dev` 给二进制注入麦克风权限的 entitlement，否则 `getUserMedia` 会被 macOS 拒绝。完整原因看 [scripts/tauri-dev.sh](scripts/tauri-dev.sh)。

### 3. 打包发布

```bash
# 一次性：生成多平台图标
npx @tauri-apps/cli icon src-tauri/icons/icon.svg

npm run build
```

产物在 `src-tauri/target/release/bundle/`：
- macOS → `.dmg` / `.app`
- Windows → `.msi` / `.exe`
- Linux → `.AppImage` / `.deb`

### 4. 首次配置 API

启动后进入 **Settings → AI provider**：

| 字段 | 默认值 |
|---|---|
| Provider | OpenAI |
| Base URL | `https://api.openai.com/v1` |
| LLM model | `gpt-5` |
| ASR model | `gpt-4o-transcribe` |
| TTS model | `gpt-4o-mini-tts` |
| TTS voice | `nova` |

填入你的 API Key → **Test connection** → **Save**。

也支持 **Azure OpenAI**（顶部切换 preset）：填 endpoint + api version + 三个 deployment name 即可。

---

## 数据存储

EchoWise 所有数据在**你的机器上**，不上传任何地方。

| 平台 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/com.echowise.app/` |
| Windows | `%APPDATA%\com.echowise.app\` |
| Linux | `~/.local/share/com.echowise.app/` |

```
com.echowise.app/
├── echowise.db        # SQLite — 伴侣、对话、turns、统计、偏好
├── audio/<convId>/    # 你的录音 (webm) + AI TTS 回放 (mp3)
├── avatars/           # 你上传的伴侣头像
└── backgrounds/       # 你上传的背景图
```

卸载应用时这个目录不会被自动删——手动 `rm -rf` 即可彻底清理。

---

## 技术栈

- **桌面壳**：[Tauri 2](https://tauri.app/) (Rust)
- **前端**：React 18 + TypeScript + Vite
- **UI**：Tailwind CSS + 自研 shadcn 风格组件
- **状态**：Zustand
- **数据库**：SQLite ([tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql))
- **图标**：[lucide-react](https://lucide.dev/)
- **测试**：Vitest + Testing Library

---

## 项目结构

```
EchoWise/
├── src/                        # React 前端
│   ├── App.tsx
│   ├── store.ts                # Zustand 全局 store + 自动 idle-end
│   ├── db.ts                   # SQLite 类型化查询层
│   ├── providers.ts            # OpenAI / Azure 适配 + coaching 函数
│   ├── storage.ts              # 音频 / 头像 / 背景文件 IO
│   ├── audio.ts                # MediaRecorder + AudioContext 实时波形
│   ├── scoring.ts              # 5 档评分系统
│   ├── appearance.ts           # 外观预设
│   ├── companions.ts           # 伴侣默认 + 话题池
│   └── components/
│       ├── Conversation.tsx    # 主对话屏（含 EmptyState/History/Recap）
│       ├── Growth.tsx          # 成长视图
│       ├── Companions.tsx      # 伴侣编辑
│       ├── Settings.tsx        # 设置（外观 / Provider / About 三标签）
│       └── ui/                 # Button / Card / Badge / Input / Separator
├── src-tauri/                  # Rust 桌面壳
│   ├── src/main.rs             # SQLite migrations + Tauri 插件
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── icons/
├── tests/                      # Vitest 单元测试 (256 个 / 94% 覆盖)
├── .github/workflows/
│   ├── ci.yml                  # PR / push 跑测试 + build
│   └── release.yml             # tag v* → 自动出 dmg / msi / appimage
└── scripts/
    └── tauri-dev.sh            # macOS dev 模式自动 codesign
```

---

## 测试

```bash
npm test               # 跑一次
npm run test:watch     # watch 模式
npm run test:ui        # 浏览器 UI
npm run test:coverage  # 出 HTML 覆盖报告到 coverage/
```

**当前覆盖率**：256 个测试 / 30 个文件 / **lines 94.5%** / branches 82% / funcs 87%。

| 模块 | Line Coverage |
|---|---|
| `src/lib/`、`src/components/ui/` | 100% |
| `appearance` / `companions` / `scoring` / `types` | 100% |
| `db` / `audio` / `storage` / `providers` | 97–100% |
| `store` | 93.5% |
| `Conversation`（含录音 / TTS / 历史 / Recap） | 91.6% |

---

## 发布流程

打 git tag 即可自动触发 release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

[.github/workflows/release.yml](.github/workflows/release.yml) 会在 3 个 runner 上并行打包：
- macOS (Apple Silicon, `aarch64`)
- macOS (Intel, `x86_64`)
- Windows (`x86_64`)

约 10–15 分钟后，Release 草稿会出现在 GitHub Releases 页面，审核后点 Publish。

---

## 自动更新设置（维护者）

EchoWise 内置基于 `tauri-plugin-updater` 的自动更新。桌面端启动时和 Settings → About 面板都会去拉一个 JSON manifest；当签名过的新版可用时，用户一键即可安装。

更新检查的代码已经全部就绪，**但签名默认未配置** —— 不配置不影响应用使用，只是自动更新不会启用。开启步骤：

### 1. 生成签名密钥对（一次性）

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/echowise-updater.key
```

会生成两个文件：
- `~/.tauri/echowise-updater.key` —— **私钥**。妥善保管（密码管理器 / 密钥库），**绝不提交**。
- `~/.tauri/echowise-updater.key.pub` —— 公钥。打开复制内容。

### 2. 把公钥写进 `tauri.conf.json`

```json
"plugins": {
  "updater": {
    "active": true,
    "pubkey": "<把 echowise-updater.key.pub 的内容贴在这>",
    "endpoints": [
      "https://github.com/hujiulin/EchoWise/releases/latest/download/latest.json"
    ]
  }
}
```

提交这个改动。

### 3. 加 GitHub 仓库 secrets

到 GitHub → 仓库 → **Settings → Secrets and variables → Actions**，添加：

| Secret | 值 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/echowise-updater.key` 文件的内容 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 第 1 步设置的密码（没设就留空） |

### 4. 发版

像往常一样 push `v*` tag，release workflow 会：
- 在三个平台打包安装器
- 用你的私钥签名每个更新包
- 在 Releases 一起上传 `latest.json` manifest

现有用户下次启动 EchoWise 后，应用会在后台静默检查，并在 **Settings → About → Updates** 显示更新。

### Endpoint 格式

`latest.json` 遵循 [Tauri v2 schema](https://v2.tauri.app/plugin/updater/)：

```json
{
  "version": "0.2.0",
  "notes": "What's new",
  "pub_date": "2026-06-07T10:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<base64>",
      "url": "https://github.com/.../EchoWise_0.2.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64":  { ... },
    "windows-x86_64": { ... }
  }
}
```

`TAURI_SIGNING_PRIVATE_KEY` 配置后，release workflow 会自动生成这个文件。

---

## 路线图

- [x] M1 - 单伴侣 + 语音对话 + 评分
- [x] M2 - 历史会话恢复 + Day 关系演变
- [x] M3 - 外观主题 + 背景图自定义
- [x] M4 - GitHub Actions 自动构建
- [ ] M5 - 长期记忆（伴侣主动回顾你提过的兴趣 / 项目）
- [ ] M6 - 离线模式（本地 Whisper.cpp + Ollama + Piper）
- [ ] M7 - 移动端

---

## 贡献

欢迎 Issues 和 PR。

提 PR 前请：
1. `npm test` 全部通过
2. 新功能补对应的 unit test
3. `npm run vite:build` 通过 TypeScript 检查
4. 代码与注释保持英文（UI 文案可本地化）

---

## License

[MIT](LICENSE) © EchoWise contributors

---

<div align="center">
  <sub>用对话学英语。不用考试，不用刷题。</sub>
</div>
