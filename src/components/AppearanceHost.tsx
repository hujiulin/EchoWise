import { useEffect, useState } from "react";
import { useApp } from "../store";
import { backgroundSrc } from "../storage";
import { PRESET_BACKGROUNDS, presetBackgroundCss } from "../appearance";

/** Applies appearance settings globally: theme class, font family, font size, background. */
export default function AppearanceHost({ children }: { children: React.ReactNode }) {
  const appearance = useApp((s) => s.appearance);
  const [uploadUrl, setUploadUrl] = useState<string | undefined>();

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark = appearance.theme === "dark"
      || (appearance.theme === "system"
          && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
  }, [appearance.theme]);

  // Listen to OS theme change while in system mode
  useEffect(() => {
    if (appearance.theme !== "system") return;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) =>
      document.documentElement.classList.toggle("dark", e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [appearance.theme]);

  // Font family
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.font = appearance.font;
  }, [appearance.font]);

  // Font size
  useEffect(() => {
    const root = document.documentElement;
    const px = { sm: 14, md: 16, lg: 18, xl: 20 }[appearance.fontSize] ?? 16;
    root.style.fontSize = `${px}px`;
  }, [appearance.fontSize]);

  // Background image
  useEffect(() => {
    if (appearance.bgImage.startsWith("upload:")) {
      void backgroundSrc(appearance.bgImage).then(setUploadUrl);
    } else {
      setUploadUrl(undefined);
    }
  }, [appearance.bgImage]);

  const bgStyle = computeBackgroundStyle(appearance.bgImage, appearance.bgOpacity, uploadUrl);

  return (
    <div className="relative h-full">
      {bgStyle && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={bgStyle}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function computeBackgroundStyle(
  ref: string,
  opacity: number,
  uploadUrl?: string
): React.CSSProperties | undefined {
  if (!ref) return undefined;
  const o = Math.max(0, Math.min(100, opacity)) / 100;
  if (ref.startsWith("preset:")) {
    const id = ref.slice("preset:".length);
    const preset = PRESET_BACKGROUNDS.find((p) => p.id === id);
    if (!preset) return undefined;
    return {
      background: presetBackgroundCss(preset),
      opacity: o,
    };
  }
  if (ref.startsWith("upload:") && uploadUrl) {
    return {
      backgroundImage: `url(${uploadUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      opacity: o,
    };
  }
  return undefined;
}
