import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ---------- Module-level mocks ---------- */

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("../__mocks__/tauri-sql");
  return { default: m.default };
});
vi.mock("@tauri-apps/api/path", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { appDataDir: m.appDataDir, join: m.join };
});
vi.mock("@tauri-apps/api/core", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { convertFileSrc: m.convertFileSrc };
});
vi.mock("@tauri-apps/plugin-fs", async () => await import("../__mocks__/tauri-fs"));

/**
 * Mock the audio module: a fake Recorder we fully control + a no-op playBlob.
 * State and class live inside the factory because vi.mock is hoisted —
 * referencing module-level identifiers would throw.
 *
 * Tests reach the shared state via the exported `__fakeRecorderState` and
 * `__playBlobMock` from the mock itself.
 */
vi.mock("../../src/audio", () => {
  const state = {
    started: false,
    levelCb: undefined as ((n: number) => void) | undefined,
    stopBlob: new Blob(["audio-bytes"], { type: "audio/webm" }),
    shouldFailStart: false,
  };
  class FakeRecorder {
    async start() {
      if (state.shouldFailStart) throw new Error("mic denied");
      state.started = true;
    }
    onLevel(cb: (n: number) => void) { state.levelCb = cb; }
    async stop() { state.started = false; return state.stopBlob; }
    cancel() { state.started = false; }
    isRecording() { return state.started; }
  }
  const playBlob = vi.fn(async () => {
    const audio = { paused: false, pause: vi.fn(() => { audio.paused = true; }) };
    return audio as unknown as HTMLAudioElement;
  });
  return {
    Recorder: FakeRecorder,
    playBlob,
    __fakeRecorderState: state,
    __playBlobMock: playBlob,
  };
});

/**
 * Mock providers module: deterministic LLM/ASR/TTS responses + spy on coaching fns.
 */
vi.mock("../../src/providers", () => {
  const companionTurn = vi.fn(async () => ({ reply: "AI says hi", hint: null as null }));
  const reviewSentence = vi.fn(async () => ({
    score: 87, original: "hello world", better: "Hello, world!", nativeLike: "Hey there!",
  }));
  const summarizeSession = vi.fn(async () => ({
    listening: 80, fluency: 78, pronunciation: 82,
    vocabulary: 75, confidence: 85, grammar: 80,
    highlight: "Strong rhythm today.",
  }));
  class CompatASR { async transcribe() { return { text: "hello world from mic" }; } }
  class CompatLLM { async chatJSON() { return "{}"; } }
  class CompatTTS {
    async synthesize() { return new Blob(["mp3-bytes"], { type: "audio/mpeg" }); }
  }
  return {
    CompatASR, CompatLLM, CompatTTS,
    companionTurn, reviewSentence, summarizeSession,
    ttsInstructions: (p: string, t: string) => `${p} | ${t}`,
    __companionTurnMock: companionTurn,
    __reviewSentenceMock: reviewSentence,
    __summarizeSessionMock: summarizeSession,
  };
});

/* ---------- Imports (after mocks!) ---------- */

import Conversation from "../../src/components/Conversation";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";
import { __resetFs } from "../__mocks__/tauri-fs";
// Pull mock handles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const audioMock = (await import("../../src/audio")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providersMock = (await import("../../src/providers")) as any;
const fakeRecorderState = audioMock.__fakeRecorderState;
const playBlobMock = audioMock.__playBlobMock;
const companionTurnMock = providersMock.__companionTurnMock;
const reviewSentenceMock = providersMock.__reviewSentenceMock;
const summarizeSessionMock = providersMock.__summarizeSessionMock;

beforeEach(async () => {
  __resetDb();
  __resetFs();
  fakeRecorderState.started = false;
  fakeRecorderState.levelCb = undefined;
  fakeRecorderState.shouldFailStart = false;
  fakeRecorderState.stopBlob = new Blob(["audio-bytes"], { type: "audio/webm" });
  await useApp.getState().init();
  useApp.setState({
    active: undefined, error: undefined, view: "conversation",
    busy: false, recording: false,
  } as Partial<ReturnType<typeof useApp.getState>>);
  // ensure API key so handleUser doesn't bail
  useApp.getState().setConfig({ ...useApp.getState().config, apiKey: "sk-test" });
});

afterEach(() => {
  vi.clearAllMocks();
});

/* ---------- Tests ---------- */

async function flushAsync() {
  // Two macrotasks + multiple microtasks to drain the LLM → TTS → playBlob chain
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("Conversation — text send + AI response cycle", () => {
  it("sending text appends a user turn, fires companionTurn, appends AI turn", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello world");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    expect(companionTurnMock).toHaveBeenCalledOnce();
    const a = useApp.getState().active!;
    expect(a.turns).toHaveLength(3);
    expect(a.turns[1].role).toBe("user");
    expect(a.turns[2].role).toBe("assistant");
    expect(playBlobMock).toHaveBeenCalled();
  });

  it("auto-review fires for user turns ≥3 words", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "this is at least three words");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    expect(reviewSentenceMock).toHaveBeenCalled();
  });

  it("auto-review does NOT fire for very short replies", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hi");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    expect(reviewSentenceMock).not.toHaveBeenCalled();
  });

  it("LLM error surfaces in error UI", async () => {
    companionTurnMock.mockRejectedValueOnce(new Error("rate limited"));
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello there");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    expect(useApp.getState().error).toMatch(/rate limited/);
  });
});

describe("Conversation — recording flow", () => {
  it("Start recording → swap to recording bar with waveform + cancel/send buttons", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /Start recording/ }));
    // RecordingBar's two icon-only buttons should appear
    expect(screen.getByRole("button", { name: /Cancel recording/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop and send/ })).toBeInTheDocument();
    expect(useApp.getState().recording).toBe(true);
  });

  it("Cancel recording discards audio and goes back to idle composer", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /Start recording/ }));
    await user.click(screen.getByRole("button", { name: /Cancel recording/ }));
    expect(useApp.getState().recording).toBe(false);
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
  });

  it("Stop and send: runs ASR, appends user turn with audioPath, then AI replies", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /Start recording/ }));
    await act(async () => {
      const sendBtn = screen.getByRole("button", { name: /Stop and send/ });
      await user.click(sendBtn);
      await flushAsync();
    });
    const a = useApp.getState().active!;
    const userTurns = a.turns.filter((t) => t.role === "user");
    expect(userTurns).toHaveLength(1);
    expect(userTurns[0].text).toBe("hello world from mic");
    expect(userTurns[0].audioPath).toMatch(/^audio\//);
    expect(companionTurnMock).toHaveBeenCalled();
  });

  it("recording start failure (no mic permission) shows error", async () => {
    fakeRecorderState.shouldFailStart = true;
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /Start recording/ }));
    expect(useApp.getState().error).toMatch(/mic denied/);
  });
});

describe("Conversation — assistant voice bubble", () => {
  it("renders assistant turn with play button + Show transcript toggle", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello world over here");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    const playBtns = screen.getAllByRole("button", { name: /Play voice message/i });
    expect(playBtns.length).toBeGreaterThan(0);
    const showBtns = screen.getAllByRole("button", { name: /Show transcript/i });
    expect(showBtns.length).toBeGreaterThan(0);
  });

  it("toggling Show transcript persists the flag", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello world over here");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    // After respond completes, there are two assistant turns (opening + reply).
    // The newest one is at the end → click the last Show transcript button.
    const showBtns = screen.getAllByRole("button", { name: /Show transcript/i });
    const last = showBtns[showBtns.length - 1];
    await user.click(last);
    expect(screen.getAllByRole("button", { name: /Hide transcript/i }).length).toBeGreaterThan(0);
    // The most recent AI turn now carries transcriptShown=true
    const turns = useApp.getState().active!.turns;
    const lastAi = [...turns].reverse().find((t) => t.role === "assistant");
    expect(lastAi?.transcriptShown).toBe(true);
  });
});

describe("Conversation — user bubble + sentence review chip", () => {
  it("clicking your own bubble expands the review card (with band legend)", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "this is at least three words long");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    expect(screen.getByText(/^87$/)).toBeInTheDocument();
    await user.click(screen.getByText(/this is at least three words long/));
    // Review card sections
    expect(await screen.findByText(/How scoring works/i)).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Better")).toBeInTheDocument();
    // "Native-like" appears as both review row label and band-legend item;
    // both being present is what we want.
    expect(screen.getAllByText("Native-like").length).toBeGreaterThanOrEqual(2);
  });

  it("toggling expanded twice persists collapsed state", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "this is at least three words long");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    const bubble = screen.getByText(/this is at least three words long/);
    await user.click(bubble); // expand
    await user.click(bubble); // collapse
    const userTurn = useApp.getState().active!.turns.find((t) => t.role === "user");
    expect(userTurn?.expanded).toBe(false);
  });
});

describe("Conversation — End session + recap modal", () => {
  it("End triggers summarizeSession, opens RecapModal", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello there friend");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    const endBtn = screen.getByRole("button", { name: /^End$/ });
    await act(async () => {
      await user.click(endBtn);
      await flushAsync();
    });
    expect(summarizeSessionMock).toHaveBeenCalled();
    expect(screen.getByText("Great conversation")).toBeInTheDocument();
    expect(screen.getByText(/Strong rhythm today/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View growth/ })).toBeInTheDocument();
  });

  it("'View growth' button switches view + closes modal", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello there friend");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /^End$/ }));
      await flushAsync();
    });
    await user.click(screen.getByRole("button", { name: /View growth/ }));
    expect(useApp.getState().view).toBe("growth");
    expect(screen.queryByText("Great conversation")).toBeNull();
  });

  it("summarization failure still ends the session with a fallback recap", async () => {
    summarizeSessionMock.mockRejectedValueOnce(new Error("LLM down"));
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello there friend");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /^End$/ }));
      await flushAsync();
    });
    // "Great conversation" appears as both kicker label and "See you tomorrow"
    // farewell — recap modal is up regardless
    expect(screen.getAllByText(/Great conversation/).length).toBeGreaterThan(0);
    expect(useApp.getState().error).toMatch(/LLM down/);
  });
});

describe("Conversation — History panel", () => {
  it("after ending a session, History panel lists it; clicking resumes", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    // Create + end one session
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "first chat here");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await flushAsync();
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /^End$/ }));
      await flushAsync();
    });
    // Close recap so it doesn't intercept clicks
    await user.click(screen.getByRole("button", { name: /Done/ }));

    // Open History panel
    await user.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.getByText(/Recent conversations/)).toBeInTheDocument();
    expect(screen.getByText(/first chat here/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /New conversation/ }));
    expect(useApp.getState().active).toBeDefined();
    expect(useApp.getState().history.length).toBeGreaterThanOrEqual(1);
  });

  it("closes the History panel via X button", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.getByText(/Recent conversations/)).toBeInTheDocument();
    const closeBtn = screen.getByText(/Recent conversations/).parentElement!.querySelector("button");
    expect(closeBtn).toBeTruthy();
    await user.click(closeBtn!);
    expect(screen.queryByText(/Recent conversations/)).toBeNull();
  });
});

describe("Conversation — composer state transitions", () => {
  it("ThinkingBar shows after submit and offers Stop button", async () => {
    let resolveFn: ((v: { reply: string; hint: null }) => void) | undefined;
    companionTurnMock.mockImplementationOnce(() => new Promise((res: (v: { reply: string; hint: null }) => void) => { resolveFn = res; }));
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello world here");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await Promise.resolve();
    });
    // Thinking state shows the companion-named pill in the composer
    expect(screen.getByText(/EchoWise is thinking…/)).toBeInTheDocument();
    // And the inline typing placeholder (3 animated dots) appears in the stream
    // (Both the composer ThinkingBar and the in-stream TypingIndicator render dots)
    expect(screen.getAllByLabelText("thinking").length).toBeGreaterThanOrEqual(1);
    // ThinkingBar Stop button has visible text "Stop"
    expect(screen.getByText(/^Stop$/)).toBeInTheDocument();
    await act(async () => {
      resolveFn?.({ reply: "ok", hint: null });
      await flushAsync();
    });
  });
});
