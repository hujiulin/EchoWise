import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CompatASR,
  CompatLLM,
  CompatTTS,
  companionTurn,
  reviewSentence,
  summarizeSession,
  ttsInstructions,
  type LLMProvider,
} from "../src/providers";
import type { ChatMessage, ProviderConfig } from "../src/types";

const openaiCfg: ProviderConfig = {
  provider: "openai",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  azureEndpoint: "",
  azureApiVersion: "2025-04-01-preview",
  asrModel: "gpt-4o-transcribe",
  llmModel: "gpt-5",
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "nova",
};

const azureCfg: ProviderConfig = {
  ...openaiCfg,
  provider: "azure",
  apiKey: "azure-key",
  azureEndpoint: "https://my-resource.openai.azure.com",
};

function mockFetch(impl: typeof fetch) {
  const fn = vi.fn(impl);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CompatLLM", () => {
  it("OpenAI: posts to /chat/completions with Bearer auth + body.model", async () => {
    const fetchFn = mockFetch(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })
    );
    await new CompatLLM(openaiCfg).chatJSON([{ role: "user", content: "hi" }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init!.body as string).model).toBe("gpt-5");
  });

  it("Azure: posts to deployment URL with api-key header", async () => {
    const fetchFn = mockFetch(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })
    );
    await new CompatLLM(azureCfg).chatJSON([{ role: "user", content: "hi" }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("/openai/deployments/gpt-5/chat/completions");
    expect(url).toContain("api-version=2025-04-01-preview");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe("azure-key");
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("requests JSON object response_format", async () => {
    const fetchFn = mockFetch(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })
    );
    await new CompatLLM(openaiCfg).chatJSON([{ role: "user", content: "hi" }]);
    const body = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws on non-2xx with body text", async () => {
    mockFetch(async () => new Response("rate limited", { status: 429 }));
    await expect(
      new CompatLLM(openaiCfg).chatJSON([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/429/);
  });
});

describe("CompatASR", () => {
  it("appends model field for both providers", async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ text: "hi" })));
    await new CompatASR(openaiCfg).transcribe(new Blob(["x"], { type: "audio/webm" }));
    const form = fetchFn.mock.calls[0][1]!.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
  });

  it("passes optional language", async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ text: "" })));
    await new CompatASR(openaiCfg).transcribe(new Blob(["x"]), { language: "en" });
    const form = fetchFn.mock.calls[0][1]!.body as FormData;
    expect(form.get("language")).toBe("en");
  });

  it("uses Azure URL + api-key for azure provider", async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ text: "ok" })));
    await new CompatASR(azureCfg).transcribe(new Blob(["x"]));
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("/openai/deployments/gpt-4o-transcribe/audio/transcriptions");
    expect((init?.headers as Record<string, string>)["api-key"]).toBe("azure-key");
  });

  it("returns empty string if response lacks text", async () => {
    mockFetch(async () => new Response("{}"));
    const out = await new CompatASR(openaiCfg).transcribe(new Blob(["x"]));
    expect(out.text).toBe("");
  });

  it("throws on bad response", async () => {
    mockFetch(async () => new Response("nope", { status: 500 }));
    await expect(new CompatASR(openaiCfg).transcribe(new Blob(["x"]))).rejects.toThrow(/500/);
  });
});

describe("CompatTTS", () => {
  it("always sends model field (Azure-safe by ignoring it server-side)", async () => {
    const fetchFn = mockFetch(async () =>
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } })
    );
    await new CompatTTS(openaiCfg).synthesize("hi", "nova");
    const body = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("gpt-4o-mini-tts");
    expect(body.voice).toBe("nova");
    expect(body.input).toBe("hi");
  });

  it("includes voice instructions only for gpt-4o-mini-tts", async () => {
    const fetchFn = mockFetch(async () => new Response(new Uint8Array([1])));
    await new CompatTTS(openaiCfg).synthesize("hi", "nova", "be calm");
    const body = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
    expect(body.instructions).toBe("be calm");
  });

  it("strips instructions for legacy tts-1 model", async () => {
    const fetchFn = mockFetch(async () => new Response(new Uint8Array([1])));
    await new CompatTTS({ ...openaiCfg, ttsModel: "tts-1" }).synthesize("hi", "nova", "be calm");
    const body = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
    expect(body.instructions).toBeUndefined();
  });
});

describe("companionTurn()", () => {
  function llmReturning(raw: string): LLMProvider {
    return { chatJSON: vi.fn(async () => raw) };
  }

  const ctx = {
    companionName: "Aria", personaLine: "warm friend", toneHint: "be casual",
    day: 5, topic: "weekend", memorySummary: "Name: Alex",
  };

  it("parses valid JSON and returns reply + hint", async () => {
    const llm = llmReturning(JSON.stringify({
      reply: "How was your weekend?",
      hint: { original: "go to office", suggestion: "went to the office" },
    }));
    const out = await companionTurn(llm, ctx, [], "yesterday i go to office");
    expect(out.reply).toBe("How was your weekend?");
    expect(out.hint?.suggestion).toBe("went to the office");
  });

  it("returns hint=null when LLM omits it", async () => {
    const llm = llmReturning(JSON.stringify({ reply: "Nice." }));
    const out = await companionTurn(llm, ctx, [], "hi");
    expect(out.hint).toBeNull();
  });

  it("returns raw string + null hint when JSON parse fails", async () => {
    const llm = llmReturning("not json");
    const out = await companionTurn(llm, ctx, [], "hi");
    expect(out.reply).toBe("not json");
    expect(out.hint).toBeNull();
  });

  it("injects history + user text into messages", async () => {
    const spy = vi.fn(async (_msgs: ChatMessage[]) => JSON.stringify({ reply: "ok" }));
    await companionTurn({ chatJSON: spy }, ctx, [{ role: "user", content: "first" }], "second");
    const msgs = spy.mock.calls[0]![0];
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Aria");
    expect(msgs[0].content).toContain("Day 5");
    expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: "second" });
  });
});

describe("reviewSentence()", () => {
  it("clamps + supplies fallback fields", async () => {
    const llm: LLMProvider = {
      chatJSON: async () => JSON.stringify({ score: 73, original: "X", better: "Y", nativeLike: "Z" }),
    };
    const r = await reviewSentence(llm, "X");
    expect(r).toEqual({ score: 73, original: "X", better: "Y", nativeLike: "Z" });
  });

  it("defaults score to 70 if missing", async () => {
    const llm: LLMProvider = { chatJSON: async () => JSON.stringify({}) };
    const r = await reviewSentence(llm, "hello");
    expect(r.score).toBe(70);
    expect(r.original).toBe("hello");
  });
});

describe("summarizeSession()", () => {
  it("clamps numeric fields to 0..100", async () => {
    const llm: LLMProvider = {
      chatJSON: async () => JSON.stringify({
        listening: 150, fluency: -10, pronunciation: 50,
        vocabulary: 60, confidence: 70, grammar: 80,
        highlight: "Nice flow.",
      }),
    };
    const s = await summarizeSession(llm, [{ role: "user", text: "hi" }]);
    expect(s.listening).toBe(100);
    expect(s.fluency).toBe(0);
    expect(s.highlight).toBe("Nice flow.");
  });

  it("supplies highlight default", async () => {
    const llm: LLMProvider = { chatJSON: async () => JSON.stringify({}) };
    const s = await summarizeSession(llm, []);
    expect(s.highlight).toMatch(/.+/);
  });

  it("handles empty transcript", async () => {
    const spy = vi.fn(async (_msgs: ChatMessage[]) => JSON.stringify({}));
    await summarizeSession({ chatJSON: spy }, []);
    const userMsg = spy.mock.calls[0]![0][1].content;
    expect(userMsg).toBe("(empty conversation)");
  });
});

describe("ttsInstructions()", () => {
  it("includes persona and tone", () => {
    const out = ttsInstructions("a warm friend", "be casual");
    expect(out).toContain("a warm friend");
    expect(out).toContain("be casual");
  });
});
