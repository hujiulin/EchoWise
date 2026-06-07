export interface Companion {
  name: string;
  voice: string;
  persona: string;
  avatar: string;
  createdAt: number;
}

export type Role = "system" | "user" | "assistant";
export interface ChatMessage { role: Role; content: string }

export interface Hint {
  original: string;
  suggestion: string;
  note?: string;
}

export interface SentenceReview {
  score: number;
  original: string;
  better: string;
  nativeLike: string;
}

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioPath?: string;
  createdAt: number;
  hint?: Hint;
  review?: SentenceReview;
  expanded?: boolean;
  transcriptShown?: boolean;
  durationMs?: number;
}

export interface ConversationSummary {
  listening: number;
  fluency: number;
  pronunciation: number;
  vocabulary: number;
  confidence: number;
  grammar: number;
  highlight: string;
}

export interface Conversation {
  id: string;
  topic?: string;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  turns: Turn[];
  summary?: ConversationSummary;
}

export type ProviderKind = "openai" | "azure";

export interface ProviderConfig {
  provider: ProviderKind;
  apiKey: string;
  baseUrl: string;        // OpenAI: full /v1 base. Azure: ignored
  azureEndpoint: string;  // Azure: https://<resource>.openai.azure.com. OpenAI: ignored
  azureApiVersion: string;
  asrModel: string;       // OpenAI: model id. Azure: deployment name
  llmModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export type ThemeMode = "system" | "light" | "dark";
export type FontChoice = "inter" | "system" | "serif" | "mono";
export type FontSize = "sm" | "md" | "lg" | "xl";

export interface AppearanceConfig {
  theme: ThemeMode;
  font: FontChoice;
  fontSize: FontSize;
  bgImage: string;     // empty | "preset:<id>" | "upload:<relPath>"
  bgOpacity: number;   // 0..100
}

export interface DailyStat {
  date: string;
  minutes: number;
  confidence: number;
  listening: number;
  conversations: number;
}

export interface UserMemory {
  name?: string;
  interests: string[];
  notes: string[];
}

export type Relationship = "stranger" | "acquaintance" | "friend" | "close-friend" | "old-friend";

export interface RelationshipTier {
  id: Relationship;
  label: string;
  description: string;
  minDay: number;
  toneHint: string;
}

export const RELATIONSHIP_TIERS: RelationshipTier[] = [
  { id: "stranger", label: "Just meeting", description: "Saying hi for the first time.",
    minDay: 0,
    toneHint: "You just met the user. Be warm, curious, a little gentle. Use simple sentences. Don't presume familiarity." },
  { id: "acquaintance", label: "Getting to know each other", description: "The first week.",
    minDay: 2,
    toneHint: "You're getting to know each other. Reference what they've shared if relevant. Friendly but still a bit polite." },
  { id: "friend", label: "Friends", description: "A few weeks in.",
    minDay: 8,
    toneHint: "You're real friends now. Casual, playful, can tease lightly. Recall past topics naturally." },
  { id: "close-friend", label: "Close friends", description: "A couple of months together.",
    minDay: 30,
    toneHint: "Close friends. Speak with comfortable shorthand, share opinions, push back gently when ideas are interesting." },
  { id: "old-friend", label: "Old friends", description: "It's been a long road.",
    minDay: 180,
    toneHint: "Old friends. Easy, knowing rhythm. You can be candid, drop pleasantries, joke freely." },
];

export function tierForDay(day: number): RelationshipTier {
  let cur = RELATIONSHIP_TIERS[0];
  for (const t of RELATIONSHIP_TIERS) if (day >= t.minDay) cur = t;
  return cur;
}

export function dayCount(createdAt: number, now = Date.now()) {
  return Math.max(1, Math.floor((now - createdAt) / 86_400_000) + 1);
}
