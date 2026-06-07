import type { Companion } from "./types";

export const DEFAULT_COMPANION: Companion = {
  name: "EchoWise",
  voice: "nova",
  persona: "A warm, curious friend who loves real conversations. Asks thoughtful follow-ups, shares small reactions, never lectures.",
  avatar: "preset:cat",
  createdAt: Date.now(),
};

export const VOICE_OPTIONS = [
  { id: "alloy", label: "Alloy — neutral" },
  { id: "nova", label: "Nova — warm" },
  { id: "shimmer", label: "Shimmer — bright" },
  { id: "echo", label: "Echo — soft" },
  { id: "fable", label: "Fable — storyteller" },
  { id: "onyx", label: "Onyx — low" },
];

export const PRESET_AVATARS = ["cat", "bear", "fox", "owl", "whale", "bunny"] as const;
export type PresetAvatarId = (typeof PRESET_AVATARS)[number];

export const TODAYS_TOPIC_POOL: { title: string; prompt: string }[] = [
  { title: "Your week so far", prompt: "Let's catch up — how has your week been? Anything interesting happen?" },
  { title: "Something you're learning", prompt: "What's something new you've been learning or curious about lately?" },
  { title: "A small win", prompt: "Tell me about a small win you had recently — even a tiny one counts." },
  { title: "Weekend plans", prompt: "What are you thinking about doing this weekend?" },
  { title: "A book or show", prompt: "What's the last book, movie, or show that stuck with you? Why?" },
  { title: "Travel dreams", prompt: "If you could hop on a plane tomorrow, where would you go and what would you do there?" },
];

export const SURPRISE_PROMPTS: { title: string; prompt: string }[] = [
  { title: "AI & engineers",
    prompt: "If AI could write all software, what do you think engineers would spend their time on?" },
  { title: "One language forever",
    prompt: "If you could only use one programming language for the rest of your life, which would you pick — and why?" },
  { title: "Future of work",
    prompt: "Do you think future companies could have more AI employees than human employees? What would change?" },
  { title: "Your perfect city",
    prompt: "Describe your perfect city. What does the morning commute look like? What food is on every corner?" },
  { title: "Time travel rules",
    prompt: "If you could visit any year — past or future — but only as an observer, which year would you pick?" },
  { title: "Teach me something",
    prompt: "Teach me one thing you know well. I'll ask follow-up questions like a curious student." },
];

export function pickDaily<T>(list: T[]): T {
  const day = Math.floor(Date.now() / 86_400_000);
  return list[day % list.length];
}
