import { useRef } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useApp } from "../store";
import { saveBackgroundImage } from "../storage";
import { FONT_OPTIONS, FONT_SIZE_OPTIONS, PRESET_BACKGROUNDS, THEME_OPTIONS } from "../appearance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Label } from "./ui/Input";
import { cn } from "../lib/cn";
import Avatar from "./Avatar";

export default function AppearancePanel() {
  const appearance = useApp((s) => s.appearance);
  const setAppearance = useApp((s) => s.setAppearance);
  const setError = useApp((s) => s.setError);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(file: File | null | undefined) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError("Please choose an image file."); return; }
    try {
      const ref = await saveBackgroundImage(file);
      setAppearance({ bgImage: ref });
    } catch (e: any) {
      setError(`Could not save background: ${e.message}`);
    }
  }

  const isUpload = appearance.bgImage.startsWith("upload:");

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Match your operating system, or pick a fixed mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setAppearance({ theme: t.id })}
                className={cn(
                  "p-3 rounded-lg border text-sm transition",
                  appearance.theme === t.id
                    ? "border-primary bg-accent ring-1 ring-primary"
                    : "border-input hover:bg-accent/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Pick a font and reading size.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font</Label>
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAppearance({ font: f.id })}
                  className={cn(
                    "p-3 rounded-lg border text-left transition",
                    appearance.font === f.id
                      ? "border-primary bg-accent ring-1 ring-primary"
                      : "border-input hover:bg-accent/50"
                  )}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div
                    className="text-xs text-muted-foreground mt-0.5"
                    style={{ fontFamily: previewFontFamily(f.id) }}
                  >
                    {f.sample}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <div className="grid grid-cols-4 gap-2">
              {FONT_SIZE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAppearance({ fontSize: s.id })}
                  className={cn(
                    "p-3 rounded-lg border text-center transition",
                    appearance.fontSize === s.id
                      ? "border-primary bg-accent ring-1 ring-primary"
                      : "border-input hover:bg-accent/50"
                  )}
                >
                  <div className="font-medium" style={{ fontSize: `${s.px}px` }}>Aa</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Background</CardTitle>
          <CardDescription>A subtle wash that sits behind everything.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setAppearance({ bgImage: "" })}
              className={cn(
                "aspect-video rounded-lg border-2 transition flex items-center justify-center text-xs text-muted-foreground",
                appearance.bgImage === ""
                  ? "border-primary"
                  : "border-input hover:border-foreground/30"
              )}
              title="No background"
            >
              <X className="h-4 w-4" /> <span className="ml-1">None</span>
            </button>
            {PRESET_BACKGROUNDS.map((p) => (
              <button
                key={p.id}
                onClick={() => setAppearance({ bgImage: `preset:${p.id}` })}
                className={cn(
                  "aspect-video rounded-lg border-2 transition relative overflow-hidden",
                  appearance.bgImage === `preset:${p.id}`
                    ? "border-primary"
                    : "border-input hover:border-foreground/30"
                )}
                title={p.label}
                style={{ background: p.css }}
              >
                <span className="absolute bottom-1 left-1.5 text-[10px] text-white drop-shadow font-medium">{p.label}</span>
              </button>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className={cn(
                "aspect-video rounded-lg border-2 border-dashed transition flex flex-col items-center justify-center text-xs text-muted-foreground",
                isUpload
                  ? "border-primary bg-accent"
                  : "border-input hover:border-foreground/30"
              )}
              title="Upload an image"
            >
              <Upload className="h-4 w-4 mb-0.5" />
              {isUpload ? "Custom" : "Upload"}
            </button>
          </div>

          {appearance.bgImage && (
            <div className="space-y-2">
              <Label>
                Opacity <span className="text-muted-foreground tabular-nums">{appearance.bgOpacity}%</span>
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={appearance.bgOpacity}
                onChange={(e) => setAppearance({ bgOpacity: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          void onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function previewFontFamily(id: string): string {
  switch (id) {
    case "inter":  return "Inter, ui-sans-serif, sans-serif";
    case "system": return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case "serif":  return "ui-serif, Georgia, serif";
    case "mono":   return "ui-monospace, SFMono-Regular, Menlo, monospace";
    default:       return "inherit";
  }
}
