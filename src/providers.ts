import type { ChatMessage, ConversationSummary, Hint, ProviderConfig, SentenceReview } from "./types";

export interface ASRProvider {
  transcribe(audio: Blob, opts: { language?: string }): Promise<{ text: string }>;
}
export interface LLMProvider {
  chatJSON(messages: ChatMessage[]): Promise<string>;
}
export interface TTSProvider {
  synthesize(text: string, voice: string, instructions?: string): Promise<Blob>;
}

/* ---------- URL helpers ---------- */

function chatUrl(cfg: ProviderConfig): string {
  if (cfg.provider === "azure") {
    return `${cfg.azureEndpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(
      cfg.llmModel
    )}/chat/completions?api-version=${encodeURIComponent(cfg.azureApiVersion)}`;
  }
  return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function asrUrl(cfg: ProviderConfig): string {
  if (cfg.provider === "azure") {
    return `${cfg.azureEndpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(
      cfg.asrModel
    )}/audio/transcriptions?api-version=${encodeURIComponent(cfg.azureApiVersion)}`;
  }
  return `${cfg.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
}

function ttsUrl(cfg: ProviderConfig): string {
  if (cfg.provider === "azure") {
    return `${cfg.azureEndpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(
      cfg.ttsModel
    )}/audio/speech?api-version=${encodeURIComponent(cfg.azureApiVersion)}`;
  }
  return `${cfg.baseUrl.replace(/\/$/, "")}/audio/speech`;
}

function authHeaders(cfg: ProviderConfig): Record<string, string> {
  return cfg.provider === "azure"
    ? { "api-key": cfg.apiKey }
    : { Authorization: `Bearer ${cfg.apiKey}` };
}

/* ---------- ASR ---------- */

export class CompatASR implements ASRProvider {
  constructor(private cfg: ProviderConfig) {}
  async transcribe(audio: Blob, opts: { language?: string } = {}) {
    const form = new FormData();
    const ext = audio.type.includes("wav") ? "wav" : "webm";
    form.append("file", audio, `audio.${ext}`);
    form.append("model", this.cfg.asrModel || "gpt-4o-transcribe");
    if (opts.language) form.append("language", opts.language);
    const res = await fetch(asrUrl(this.cfg), {
      method: "POST",
      headers: authHeaders(this.cfg),
      body: form,
    });
    if (!res.ok) throw new Error(`ASR failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return { text: (j.text ?? "") as string };
  }
}

/* ---------- LLM ---------- */

export class CompatLLM implements LLMProvider {
  constructor(private cfg: ProviderConfig) {}
  async chatJSON(messages: ChatMessage[]) {
    const body: Record<string, unknown> = {
      model: this.cfg.llmModel || "gpt-5",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.8,
    };
    const res = await fetch(chatUrl(this.cfg), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(this.cfg) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content as string;
  }
}

/* ---------- TTS ---------- */

export class CompatTTS implements TTSProvider {
  constructor(private cfg: ProviderConfig) {}
  async synthesize(text: string, voice: string, instructions?: string) {
    const model = this.cfg.ttsModel || "gpt-4o-mini-tts";
    const body: Record<string, unknown> = {
      model,
      voice: voice || this.cfg.ttsVoice || "nova",
      input: text,
      format: "mp3",
    };
    if (instructions && model.includes("gpt-4o-mini-tts")) {
      body.instructions = instructions;
    }
    const res = await fetch(ttsUrl(this.cfg), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(this.cfg) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
    return await res.blob();
  }
}

/* ---------- Coaching pipeline ---------- */

const COMPANION_SYSTEM = (
  companionName: string,
  personaLine: string,
  toneHint: string,
  day: number,
  topic: string | undefined,
  memorySummary: string
) => `You are ${companionName}, an AI companion who chats with the user in English.

WHO YOU ARE
${personaLine}

RELATIONSHIP
You and the user are on Day ${day} together. ${toneHint}

CONTEXT
${memorySummary ? `What you remember about the user:\n${memorySummary}\n` : "You haven't built up any memory of the user yet.\n"}${
  topic ? `Today the user wants to talk about: ${topic}\n` : ""
}
OUTPUT FORMAT — return a SINGLE JSON object, no prose:
{
  "reply": "<your spoken-style response, 1-3 sentences, in character>",
  "hint": null | { "original": "<short fragment from the user that was awkward>", "suggestion": "<a more natural rewrite of that fragment, NOT the whole sentence>", "note": "<≤6 words, optional>" }
}

HINT RULES
- "hint" is optional. Set null about 70% of the time. Only surface a hint when the user made a small word-choice or grammar slip that is actually worth a one-glance nudge.
- A hint is a quiet whisper, not a correction speech. Never reference the hint in "reply".
- "original" must be a literal substring of what the user just said (≤6 words).
- Never lecture about grammar inside "reply". You are a companion, not a teacher.
- If the user is silent, unclear, or off-topic, gently reflect that with a curious follow-up and set hint to null.`;

export async function companionTurn(
  llm: LLMProvider,
  ctx: {
    companionName: string;
    personaLine: string;
    toneHint: string;
    day: number;
    topic?: string;
    memorySummary: string;
  },
  history: ChatMessage[],
  userText: string
): Promise<{ reply: string; hint: Hint | null }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: COMPANION_SYSTEM(
        ctx.companionName, ctx.personaLine, ctx.toneHint, ctx.day, ctx.topic, ctx.memorySummary
      ),
    },
    ...history,
    { role: "user", content: userText },
  ];
  const raw = await llm.chatJSON(messages);
  try {
    const parsed = JSON.parse(raw);
    return {
      reply: String(parsed.reply ?? "").trim(),
      hint: parsed.hint && typeof parsed.hint === "object" ? parsed.hint : null,
    };
  } catch {
    return { reply: raw, hint: null };
  }
}

const REVIEW_SYSTEM = `You are a kind English coach. Given one sentence the user said, return three layers as JSON:
{
  "score": <0-100 int — how natural and clear the sentence is>,
  "original": "<the user's sentence, verbatim>",
  "better": "<the same idea, with grammar and word choice fixed, same length feel>",
  "nativeLike": "<a richer, fluent version a confident native might say in this context>"
}
Be encouraging. Never add prose outside the JSON.`;

export async function reviewSentence(llm: LLMProvider, sentence: string): Promise<SentenceReview> {
  const raw = await llm.chatJSON([
    { role: "system", content: REVIEW_SYSTEM },
    { role: "user", content: sentence },
  ]);
  const parsed = JSON.parse(raw);
  return {
    score: Number(parsed.score ?? 70),
    original: String(parsed.original ?? sentence),
    better: String(parsed.better ?? sentence),
    nativeLike: String(parsed.nativeLike ?? sentence),
  };
}

const SESSION_SYSTEM = `You are an encouraging English coach. Given the full conversation transcript, return JSON:
{
  "listening": <0-100>,
  "fluency": <0-100>,
  "pronunciation": <0-100>,
  "vocabulary": <0-100>,
  "confidence": <0-100>,
  "grammar": <0-100>,
  "highlight": "<one warm sentence celebrating one specific thing the user did well today>"
}
Always lead with what they did well. Never list mistakes here.`;

export async function summarizeSession(
  llm: LLMProvider,
  transcript: { role: "user" | "assistant"; text: string }[]
): Promise<ConversationSummary> {
  const joined = transcript
    .map((t) => `${t.role === "user" ? "User" : "Companion"}: ${t.text}`)
    .join("\n");
  const raw = await llm.chatJSON([
    { role: "system", content: SESSION_SYSTEM },
    { role: "user", content: joined || "(empty conversation)" },
  ]);
  const p = JSON.parse(raw);
  const clamp = (v: any) => Math.max(0, Math.min(100, Number(v) || 0));
  return {
    listening: clamp(p.listening),
    fluency: clamp(p.fluency),
    pronunciation: clamp(p.pronunciation),
    vocabulary: clamp(p.vocabulary),
    confidence: clamp(p.confidence),
    grammar: clamp(p.grammar),
    highlight: String(p.highlight ?? "Great session — see you next time."),
  };
}

/** Build TTS voice instructions from a companion's persona + relationship tier. */
export function ttsInstructions(personaLine: string, toneHint: string): string {
  return `Voice direction: ${personaLine} ${toneHint} Speak conversationally — like a friend on a call, not like reading a script. Natural pacing, light warmth, no announcer voice.`;
}