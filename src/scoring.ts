/**
 * Sentence-score bands.
 *
 * Bands describe *what the score means* — not just a color. Tone stays
 * encouraging: a low score is "Try again", not "Bad". One source of truth
 * for chip, tooltip, review card, and any future growth visualisation.
 */

export interface ScoreBand {
  id: "tryAgain" | "gettingThere" | "clear" | "natural" | "nativeLike";
  min: number;          // inclusive lower bound
  label: string;        // short verb-phrase ("Natural")
  meaning: string;      // one-sentence explanation
  chipClass: string;    // tailwind classes for the chip
  dotClass: string;     // tailwind classes for a 8×8 swatch in legends
}

export const SCORE_BANDS: ScoreBand[] = [
  {
    id: "tryAgain",
    min: 0,
    label: "Try again",
    meaning: "Hard to follow — let's rephrase.",
    chipClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    dotClass: "bg-rose-400 dark:bg-rose-500",
  },
  {
    id: "gettingThere",
    min: 61,
    label: "Getting there",
    meaning: "Understandable with a bit of effort.",
    chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dotClass: "bg-amber-400 dark:bg-amber-500",
  },
  {
    id: "clear",
    min: 70,
    label: "Clear",
    meaning: "The meaning lands clearly.",
    chipClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    dotClass: "bg-yellow-400 dark:bg-yellow-500",
  },
  {
    id: "natural",
    min: 80,
    label: "Natural",
    meaning: "Sounds like everyday speech.",
    chipClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    dotClass: "bg-sky-400 dark:bg-sky-500",
  },
  {
    id: "nativeLike",
    min: 90,
    label: "Native-like",
    meaning: "Indistinguishable from a fluent speaker.",
    chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dotClass: "bg-emerald-400 dark:bg-emerald-500",
  },
];

export function bandFor(score: number): ScoreBand {
  let cur = SCORE_BANDS[0];
  for (const b of SCORE_BANDS) if (score >= b.min) cur = b;
  return cur;
}

export function bandRangeLabel(b: ScoreBand): string {
  const idx = SCORE_BANDS.indexOf(b);
  const next = SCORE_BANDS[idx + 1];
  return next ? `${b.min}–${next.min - 1}` : `${b.min}+`;
}
