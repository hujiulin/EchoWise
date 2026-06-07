export interface PresetBackground {
  id: string;
  label: string;
  /** CSS gradient string (used both for the live background and for picker swatch). */
  css: string;
}

export const PRESET_BACKGROUNDS: PresetBackground[] = [
  {
    id: "dawn",
    label: "Dawn",
    css: "linear-gradient(135deg, #fcd5ce 0%, #f8e1c2 50%, #cdebff 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(135deg, #d0f0fd 0%, #7dd3fc 60%, #6366f1 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    css: "linear-gradient(135deg, #d1fae5 0%, #6ee7b7 60%, #047857 100%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    css: "linear-gradient(135deg, #fde68a 0%, #fb923c 60%, #be185d 100%)",
  },
  {
    id: "lavender",
    label: "Lavender",
    css: "linear-gradient(135deg, #ede9fe 0%, #c4b5fd 60%, #7c3aed 100%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    css: "linear-gradient(135deg, #1f2937 0%, #374151 60%, #111827 100%)",
  },
];

export function presetBackgroundCss(p: PresetBackground): string {
  return p.css;
}

export const FONT_OPTIONS = [
  { id: "inter",  label: "Inter",        sample: "The quick brown fox" },
  { id: "system", label: "System UI",    sample: "The quick brown fox" },
  { id: "serif",  label: "Serif",        sample: "The quick brown fox" },
  { id: "mono",   label: "Monospace",    sample: "The quick brown fox" },
] as const;

export const FONT_SIZE_OPTIONS = [
  { id: "sm", label: "Compact", px: 14 },
  { id: "md", label: "Default", px: 16 },
  { id: "lg", label: "Large",   px: 18 },
  { id: "xl", label: "X-Large", px: 20 },
] as const;

export const THEME_OPTIONS = [
  { id: "system", label: "Match system" },
  { id: "light",  label: "Light" },
  { id: "dark",   label: "Dark" },
] as const;
