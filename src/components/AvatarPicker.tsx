import { useRef } from "react";
import { Check, Upload } from "lucide-react";
import { useApp } from "../store";
import { saveAvatarFile } from "../storage";
import { PRESET_AVATARS } from "../companions";
import { cn } from "../lib/cn";
import Avatar from "./Avatar";

export default function AvatarPicker() {
  const companion = useApp((s) => s.companion);
  const setCompanion = useApp((s) => s.setCompanion);
  const setError = useApp((s) => s.setError);
  const fileRef = useRef<HTMLInputElement>(null);

  const options: string[] = PRESET_AVATARS.map((p) => `preset:${p}`);

  async function onUpload(file: File | null | undefined) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError("Please choose an image file.");
      return;
    }
    try {
      const ref = await saveAvatarFile(file);
      setCompanion({ avatar: ref });
    } catch (e: any) {
      setError(`Could not save avatar: ${e.message}`);
    }
  }

  const isCustom = companion.avatar.startsWith("upload:");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2.5">
        {options.map((v) => {
          const active = companion.avatar === v;
          return (
            <button
              key={v}
              onClick={() => setCompanion({ avatar: v })}
              className={cn(
                "relative aspect-square rounded-full overflow-visible transition",
                active
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                  : "ring-1 ring-border hover:ring-foreground/40"
              )}
              title={v.replace("preset:", "")}
            >
              <Avatar value={v} fill />
              {active && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                  <Check className="h-2.5 w-2.5" />
                </div>
              )}
            </button>
          );
        })}

        <button
          onClick={() => fileRef.current?.click()}
          className={cn(
            "relative aspect-square rounded-full overflow-visible transition",
            isCustom
              ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
              : "ring-1 ring-border hover:ring-foreground/40"
          )}
          title="Upload an image"
        >
          {isCustom ? (
            <>
              <Avatar value={companion.avatar} fill />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                <Check className="h-2.5 w-2.5" />
              </div>
            </>
          ) : (
            <div className="h-full w-full rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Upload className="h-4 w-4" />
            </div>
          )}
        </button>
      </div>

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
      <p className="text-xs text-muted-foreground">
        Pick the EchoWise mark, a cartoon, or upload your own image. PNG / JPG / SVG.
      </p>
    </div>
  );
}
