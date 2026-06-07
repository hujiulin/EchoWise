import { useEffect, useState } from "react";
import { Download, RefreshCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useApp } from "../store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/cn";
import Logo from "./Logo";

const APP_VERSION = "0.1.0";

export default function AboutPanel() {
  const updateStatus = useApp((s) => s.updateStatus);
  const latestUpdate = useApp((s) => s.latestUpdate);
  const updateProgress = useApp((s) => s.updateProgress);
  const updateError = useApp((s) => s.updateError);
  const lastUpdateCheck = useApp((s) => s.lastUpdateCheck);
  const checkForUpdate = useApp((s) => s.checkForUpdate);
  const installUpdate = useApp((s) => s.installUpdate);
  const restartForUpdate = useApp((s) => s.restartForUpdate);
  const dismissUpdate = useApp((s) => s.dismissUpdate);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="p-6 flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-foreground text-background flex items-center justify-center">
            <Logo size={28} />
          </div>
          <div>
            <div className="text-xl font-semibold">EchoWise</div>
            <div className="text-sm text-muted-foreground">Just talk.</div>
            <div className="text-xs text-muted-foreground mt-1">Version {APP_VERSION}</div>
          </div>
        </CardContent>
      </Card>

      <UpdaterCard
        version={APP_VERSION}
        status={updateStatus}
        latest={latestUpdate}
        progress={updateProgress}
        error={updateError}
        lastChecked={lastUpdateCheck}
        onCheck={() => void checkForUpdate()}
        onInstall={() => void installUpdate()}
        onRestart={() => void restartForUpdate()}
        onDismiss={dismissUpdate}
      />

      <Card>
        <CardHeader>
          <CardTitle>What is EchoWise?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            An AI companion that helps you build real English communication ability —
            through daily conversations, not lessons or tests.
          </p>
          <p>
            Open source. Your data stays on your device. Bring your own API key.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Source code"  value="github.com/hujiulin/EchoWise" />
          <Row label="Issues"       value="github.com/hujiulin/EchoWise/issues" />
          <Row label="License"      value="MIT" />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

/* ---------------- Updater card ---------------- */

interface UpdaterCardProps {
  version: string;
  status: ReturnType<typeof useApp.getState>["updateStatus"];
  latest?: ReturnType<typeof useApp.getState>["latestUpdate"];
  progress?: ReturnType<typeof useApp.getState>["updateProgress"];
  error?: string;
  lastChecked?: number;
  onCheck: () => void;
  onInstall: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

function UpdaterCard({
  version, status, latest, progress, error, lastChecked,
  onCheck, onInstall, onRestart, onDismiss,
}: UpdaterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Updates
          {status === "available" && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">
              new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Keep EchoWise up to date with the latest improvements and fixes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Idle / up-to-date row */}
        {(status === "idle" || status === "upToDate" || status === "checking") && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CurrentVersionIcon status={status} />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {status === "upToDate" ? "You're on the latest version" : `Version ${version}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <LastChecked ts={lastChecked} />
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onCheck}
              disabled={status === "checking"}
            >
              {status === "checking" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</>
              ) : (
                <><RefreshCcw className="h-3.5 w-3.5" />Check for updates</>
              )}
            </Button>
          </div>
        )}

        {/* Available row */}
        {status === "available" && latest && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    Update available — v{latest.version}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    You're on v{latest.currentVersion}. {latest.date && `Released ${formatDate(latest.date)}.`}
                  </div>
                </div>
              </div>
            </div>
            {latest.notes && (
              <div className="rounded-md bg-secondary/60 p-3 text-xs whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {latest.notes}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={onInstall}>
                <Download className="h-3.5 w-3.5" /> Install update
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Not now
              </Button>
            </div>
          </div>
        )}

        {/* Downloading */}
        {status === "downloading" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <div className="text-sm font-medium">Downloading update…</div>
            </div>
            <ProgressBar progress={progress} />
          </div>
        )}

        {/* Installed — needs restart */}
        {status === "installed" && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Update installed</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Restart EchoWise to start using the new version.
                </div>
              </div>
            </div>
            <Button onClick={onRestart}>Restart now</Button>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Update failed</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {error ?? "Something went wrong checking for updates."}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onCheck}>
              <RefreshCcw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CurrentVersionIcon({ status }: { status: UpdaterCardProps["status"] }) {
  if (status === "upToDate") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />;
  }
  return <RefreshCcw className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />;
}

function ProgressBar({ progress }: { progress?: { downloaded: number; total?: number } }) {
  const pct = progress?.total
    ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
    : undefined;
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-all",
            pct === undefined && "animate-pulse w-1/3"
          )}
          style={pct !== undefined ? { width: `${pct}%` } : undefined}
        />
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums flex justify-between">
        <span>
          {formatBytes(progress?.downloaded ?? 0)}
          {progress?.total ? ` / ${formatBytes(progress.total)}` : ""}
        </span>
        {pct !== undefined && <span>{pct}%</span>}
      </div>
    </div>
  );
}

function LastChecked({ ts }: { ts?: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return <>Never checked yet.</>;
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return <>Last checked just now.</>;
  if (m < 60) return <>Last checked {m}m ago.</>;
  const h = Math.floor(m / 60);
  if (h < 24) return <>Last checked {h}h ago.</>;
  const d = Math.floor(h / 24);
  return <>Last checked {d}d ago.</>;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}
