import { useEffect, useState } from "react";
import { avatarUploadSrc } from "../storage";
import { cn } from "../lib/cn";
import Logo from "./Logo";

/**
 * Avatar reference grammar:
 *  - "logo"               → app logo
 *  - "preset:<id>"        → built-in cartoon (cat, bear, …)
 *  - "upload:<relPath>"   → user-uploaded image in appData/avatars/
 *  - "emoji:<char>"       → legacy emoji fallback
 *  - anything else        → treated as legacy emoji
 *
 * If `fill` is true, the avatar stretches to its parent. Otherwise `size` (px) is used.
 */
export default function Avatar({
  value, size = 40, className, fill = false,
}: { value: string; size?: number; className?: string; fill?: boolean }) {
  const [uploadSrc, setUploadSrc] = useState<string | undefined>();

  useEffect(() => {
    if (value.startsWith("upload:")) {
      void avatarUploadSrc(value).then(setUploadSrc);
    } else {
      setUploadSrc(undefined);
    }
  }, [value]);

  const base = cn(
    "rounded-full flex items-center justify-center shrink-0 overflow-hidden",
    fill && "w-full h-full",
    className
  );
  const style = fill ? undefined : { width: size, height: size };

  if (value === "logo") {
    return (
      <div className={cn(base, "bg-foreground text-background")} style={style}>
        <Logo size={fill ? 24 : Math.round(size * 0.58)} className={fill ? "w-[58%] h-[58%]" : undefined} />
      </div>
    );
  }
  if (value.startsWith("preset:")) {
    const id = value.slice("preset:".length);
    return (
      <div className={cn(base, "bg-secondary")} style={style}>
        <PresetSvg id={id} fill={fill} size={size} />
      </div>
    );
  }
  if (value.startsWith("upload:")) {
    return (
      <div className={cn(base, "bg-secondary")} style={style}>
        {uploadSrc ? (
          <img src={uploadSrc} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
    );
  }
  if (value.startsWith("emoji:")) {
    return (
      <div className={cn(base, "bg-secondary")} style={style}>
        <span style={{ fontSize: (fill ? 24 : size) * 0.55 }}>{value.slice("emoji:".length)}</span>
      </div>
    );
  }
  // Legacy: a raw emoji character left over from old data
  return (
    <div className={cn(base, "bg-secondary")} style={style}>
      <span style={{ fontSize: (fill ? 24 : size) * 0.55 }}>{value}</span>
    </div>
  );
}

/* ---------- preset SVG illustrations ---------- */

function PresetSvg({ id, fill, size }: { id: string; fill: boolean; size: number }) {
  const common = {
    viewBox: "0 0 64 64",
    fill: "none" as const,
    ...(fill
      ? { className: "w-full h-full" }
      : { width: size, height: size }),
  };
  switch (id) {
    case "cat":
      return (
        <svg {...common}>
          <path d="M10 22 L18 6 L26 22 Z M54 22 L46 6 L38 22 Z" fill="#F59E0B"/>
          <circle cx="32" cy="36" r="26" fill="#FBBF24"/>
          <ellipse cx="23" cy="33" rx="2.6" ry="3.6" fill="#1F2937"/>
          <ellipse cx="41" cy="33" rx="2.6" ry="3.6" fill="#1F2937"/>
          <path d="M28 44 Q32 47 36 44" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          <path d="M18 38 L11 35 M18 41 L11 43 M46 38 L53 35 M46 41 L53 43"
                stroke="#1F2937" strokeWidth="1.2" strokeLinecap="round"/>
          <ellipse cx="32" cy="40" rx="2" ry="1.4" fill="#FB7185" opacity="0.6"/>
        </svg>
      );
    case "bear":
      return (
        <svg {...common}>
          <circle cx="14" cy="16" r="8" fill="#92400E"/>
          <circle cx="50" cy="16" r="8" fill="#92400E"/>
          <circle cx="14" cy="16" r="4" fill="#FBBF24"/>
          <circle cx="50" cy="16" r="4" fill="#FBBF24"/>
          <circle cx="32" cy="36" r="26" fill="#A16207"/>
          <ellipse cx="32" cy="44" rx="13" ry="10" fill="#FEF3C7"/>
          <circle cx="24" cy="31" r="2.4" fill="#1F2937"/>
          <circle cx="40" cy="31" r="2.4" fill="#1F2937"/>
          <ellipse cx="32" cy="42" rx="3" ry="2.2" fill="#1F2937"/>
          <path d="M29 48 Q32 51 35 48" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case "fox":
      return (
        <svg {...common}>
          <path d="M8 8 L24 22 L14 30 Z" fill="#EA580C"/>
          <path d="M56 8 L40 22 L50 30 Z" fill="#EA580C"/>
          <circle cx="32" cy="36" r="26" fill="#F97316"/>
          <path d="M16 44 Q32 56 48 44 L48 52 Q32 62 16 52 Z" fill="#FED7AA"/>
          <circle cx="23" cy="33" r="2.6" fill="#1F2937"/>
          <circle cx="41" cy="33" r="2.6" fill="#1F2937"/>
          <ellipse cx="32" cy="44" rx="2.2" ry="1.6" fill="#1F2937"/>
          <path d="M29 49 Q32 52 35 49" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case "owl":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="34" rx="26" ry="28" fill="#7C3AED"/>
          <circle cx="22" cy="30" r="10" fill="#FEF3C7"/>
          <circle cx="42" cy="30" r="10" fill="#FEF3C7"/>
          <circle cx="22" cy="30" r="4" fill="#1F2937"/>
          <circle cx="42" cy="30" r="4" fill="#1F2937"/>
          <circle cx="23.5" cy="28.5" r="1.4" fill="#FFFFFF"/>
          <circle cx="43.5" cy="28.5" r="1.4" fill="#FFFFFF"/>
          <path d="M28 42 L32 48 L36 42 Z" fill="#FBBF24"/>
          <path d="M12 14 Q16 6 22 12" stroke="#5B21B6" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M52 14 Q48 6 42 12" stroke="#5B21B6" strokeWidth="3" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case "whale":
      return (
        <svg {...common}>
          <path d="M4 36 Q10 14 32 14 Q54 14 60 36 Q54 56 32 56 Q10 56 4 36 Z" fill="#0EA5E9"/>
          <path d="M52 22 L62 10 L60 36 Z" fill="#0EA5E9"/>
          <path d="M14 50 Q22 60 32 56" stroke="#0284C7" strokeWidth="2.5" fill="none"/>
          <circle cx="20" cy="34" r="2.6" fill="#1F2937"/>
          <circle cx="20.8" cy="33.2" r="0.9" fill="#FFFFFF"/>
          <path d="M14 26 Q10 18 16 14" stroke="#7DD3FC" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
          <path d="M10 22 Q6 16 12 10" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case "bunny":
      return (
        <svg {...common}>
          <ellipse cx="20" cy="12" rx="5" ry="12" fill="#F9A8D4"/>
          <ellipse cx="44" cy="12" rx="5" ry="12" fill="#F9A8D4"/>
          <ellipse cx="20" cy="12" rx="2.4" ry="7" fill="#FCE7F3"/>
          <ellipse cx="44" cy="12" rx="2.4" ry="7" fill="#FCE7F3"/>
          <circle cx="32" cy="36" r="26" fill="#FBCFE8"/>
          <circle cx="24" cy="33" r="2.4" fill="#1F2937"/>
          <circle cx="40" cy="33" r="2.4" fill="#1F2937"/>
          <ellipse cx="32" cy="42" rx="1.8" ry="1.2" fill="#FB7185"/>
          <path d="M29 47 Q32 50 35 47" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          <circle cx="20" cy="42" r="2.5" fill="#FB7185" opacity="0.5"/>
          <circle cx="44" cy="42" r="2.5" fill="#FB7185" opacity="0.5"/>
        </svg>
      );
    default:
      return (
        <div style={{ fontSize: size * 0.5 }} className="text-muted-foreground">?</div>
      );
  }
}
