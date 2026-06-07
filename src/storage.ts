import { BaseDirectory, mkdir, writeFile, readFile, exists } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";

const AUDIO_ROOT = "audio";
const AVATAR_ROOT = "avatars";
const BG_ROOT = "backgrounds";

export async function saveUserAudio(
  conversationId: string,
  turnId: string,
  blob: Blob
): Promise<string> {
  return saveTurnAudio(conversationId, turnId, blob);
}

export async function saveAssistantAudio(
  conversationId: string,
  turnId: string,
  blob: Blob
): Promise<string> {
  return saveTurnAudio(conversationId, turnId, blob);
}

async function saveTurnAudio(
  conversationId: string,
  turnId: string,
  blob: Blob
): Promise<string> {
  const dir = `${AUDIO_ROOT}/${conversationId}`;
  if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const ext = blob.type.includes("wav")
    ? "wav"
    : blob.type.includes("mp3") || blob.type.includes("mpeg")
      ? "mp3"
      : "webm";
  const relPath = `${dir}/${turnId}.${ext}`;
  const buf = new Uint8Array(await blob.arrayBuffer());
  await writeFile(relPath, buf, { baseDir: BaseDirectory.AppData });
  return relPath;
}

export async function audioSrc(relPath: string): Promise<string> {
  const root = await appDataDir();
  const abs = await join(root, relPath);
  return convertFileSrc(abs);
}

export async function readAudioBlob(relPath: string): Promise<Blob> {
  const buf = await readFile(relPath, { baseDir: BaseDirectory.AppData });
  const ext = relPath.split(".").pop();
  const mime = ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/webm";
  return new Blob([buf as BlobPart], { type: mime });
}

/** Save an uploaded image; returns the avatar reference string `upload:<relPath>`. */
export async function saveAvatarFile(file: File): Promise<string> {
  if (!(await exists(AVATAR_ROOT, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(AVATAR_ROOT, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const ext = (file.name.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1] ?? "png").toLowerCase();
  const fname = `${crypto.randomUUID()}.${ext}`;
  const relPath = `${AVATAR_ROOT}/${fname}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  await writeFile(relPath, buf, { baseDir: BaseDirectory.AppData });
  return `upload:${relPath}`;
}

export async function avatarUploadSrc(uploadRef: string): Promise<string> {
  const rel = uploadRef.replace(/^upload:/, "");
  const root = await appDataDir();
  const abs = await join(root, rel);
  return convertFileSrc(abs);
}

/** Save uploaded background image. Returns `upload:<relPath>`. */
export async function saveBackgroundImage(file: File): Promise<string> {
  if (!(await exists(BG_ROOT, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(BG_ROOT, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const ext = (file.name.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1] ?? "png").toLowerCase();
  const fname = `${crypto.randomUUID()}.${ext}`;
  const relPath = `${BG_ROOT}/${fname}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  await writeFile(relPath, buf, { baseDir: BaseDirectory.AppData });
  return `upload:${relPath}`;
}

export async function backgroundSrc(ref: string): Promise<string | undefined> {
  if (!ref) return undefined;
  if (ref.startsWith("preset:")) return undefined; // handled inline via CSS gradient
  if (ref.startsWith("upload:")) {
    const rel = ref.replace(/^upload:/, "");
    const root = await appDataDir();
    const abs = await join(root, rel);
    return convertFileSrc(abs);
  }
  return undefined;
}
