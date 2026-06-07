import { useMemo } from "react";
import { Flame, TrendingUp, MessageCircle, Mic2 } from "lucide-react";
import { useApp } from "../store";
import type { Conversation, Turn } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { bandFor, SCORE_BANDS } from "../scoring";
import { cn } from "../lib/cn";

/**
 * Growth uses sentence reviews as its primary source. Every user turn already
 * gets auto-scored (≥3 words) — those numbers stream in as you talk, so the
 * page is meaningful without anyone hitting "End session".
 */
export default function Growth() {
  const history = useApp((s) => s.history);
  const stats = useApp((s) => s.stats);
  const active = useApp((s) => s.active);

  // Pool of all scored user turns (active + history), newest last
  const scored = useMemo(() => {
    const all: { score: number; createdAt: number; convId: string; turn: Turn }[] = [];
    for (const c of history) {
      for (const t of c.turns) {
        if (t.role === "user" && t.review) {
          all.push({ score: t.review.score, createdAt: t.createdAt, convId: c.id, turn: t });
        }
      }
    }
    if (active) {
      for (const t of active.turns) {
        if (t.role === "user" && t.review) {
          all.push({ score: t.review.score, createdAt: t.createdAt, convId: active.id, turn: t });
        }
      }
    }
    all.sort((a, b) => a.createdAt - b.createdAt);
    return all;
  }, [history, active]);

  const totalConversations = history.length + (active ? 1 : 0);
  const totalMinutes = stats.reduce((acc, s) => acc + s.minutes, 0);
  const streak = computeStreak(stats.map((s) => s.date));

  // Confidence trend = rolling avg of last 5 sentence scores, sampled per turn
  const trend = useMemo(() => buildTrend(scored.map((s) => s.score), 5), [scored]);

  const latestAvg = trend.length ? trend[trend.length - 1] : 0;
  const earlyAvg = trend.length >= 4 ? trend[Math.min(4, trend.length - 1)] : 0;
  const delta = trend.length >= 8 ? latestAvg - trend[Math.max(0, trend.length - 16)] : 0;

  const bandCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scored) {
      const id = bandFor(s.score).id;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [scored]);

  const highlight = useMemo(() => {
    if (scored.length < 3) return undefined;
    return [...scored].sort((a, b) => b.score - a.score)[0];
  }, [scored]);

  const toRevisit = useMemo(() => {
    if (scored.length < 3) return undefined;
    return [...scored].sort((a, b) => a.score - b.score)[0];
  }, [scored]);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-8 animate-fade-in">
      <div>
        <div className="text-sm text-muted-foreground mb-1">Your growth</div>
        <h1 className="text-3xl font-semibold tracking-tight">Am I getting better?</h1>
        {trend.length >= 5 && (
          <p className="text-sm text-muted-foreground mt-3">
            {delta > 3
              ? <>Your rolling average is up <span className="text-emerald-600 font-medium">+{delta} points</span>. Keep going.</>
              : delta < -3
                ? <>A small dip lately. One more conversation and you'll bounce back.</>
                : <>Steady at <span className="font-medium text-foreground">{latestAvg}</span>. Consistency is the real signal.</>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} label="Conversations" value={totalConversations} />
        <Stat icon={<Mic2 className="h-3.5 w-3.5" />}          label="Sentences"      value={scored.length} />
        <Stat icon={<TrendingUp className="h-3.5 w-3.5" />}    label="Minutes"        value={Math.round(totalMinutes)} />
        <Stat icon={<Flame className="h-3.5 w-3.5" />}          label="Day streak"     value={streak} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confidence over time</CardTitle>
          <CardDescription>
            Rolling average of your last 5 sentences — updates every time you speak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <Empty msg="Say a few sentences and the curve starts here." />
          ) : trend.length === 1 ? (
            <div className="text-center py-4">
              <div className="text-5xl font-semibold tabular-nums">{trend[0]}</div>
              <div className="text-xs text-muted-foreground mt-2">Your baseline. Keep talking — the trend takes shape after a few more.</div>
            </div>
          ) : (
            <Sparkline values={trend} delta={delta} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score distribution</CardTitle>
          <CardDescription>
            How your sentences fall across the 5 bands. {scored.length} sentences scored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scored.length === 0 ? (
            <Empty msg="Sentences land in bands as you talk." />
          ) : (
            <DistributionBars total={scored.length} counts={bandCounts} />
          )}
        </CardContent>
      </Card>

      {(highlight || toRevisit) && (
        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
            <CardDescription>One thing you nailed and one to revisit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {highlight && (
              <SentenceCard
                kicker="Best so far"
                turn={highlight.turn}
                convId={highlight.convId}
              />
            )}
            {toRevisit && toRevisit.turn.id !== highlight?.turn.id && (
              <SentenceCard
                kicker="Worth revisiting"
                turn={toRevisit.turn}
                convId={toRevisit.convId}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider">
          {icon} {label}
        </div>
        <div className="text-3xl font-semibold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function DistributionBars({ total, counts }: { total: number; counts: Map<string, number> }) {
  return (
    <div className="space-y-2">
      {SCORE_BANDS.slice().reverse().map((b) => {
        const c = counts.get(b.id) ?? 0;
        const pct = total > 0 ? Math.round((c / total) * 100) : 0;
        return (
          <div key={b.id} className="flex items-center gap-3 text-sm">
            <div className="w-32 flex items-center gap-2 shrink-0">
              <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
              <span>{b.label}</span>
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full", b.dotClass)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
              {c} <span className="opacity-60">· {pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SentenceCard({ kicker, turn, convId: _ }: { kicker: string; turn: Turn; convId: string }) {
  const band = bandFor(turn.review!.score);
  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <Badge variant="outline" className="text-[10px]">{kicker}</Badge>
        <Badge className={cn("border-0 text-[10px]", band.chipClass)}>
          {band.label} · {turn.review!.score}
        </Badge>
      </div>
      <div className="text-sm leading-relaxed">"{turn.text}"</div>
      {turn.review?.better && turn.review.better !== turn.review.original && (
        <div className="text-xs text-muted-foreground mt-1.5">
          <span className="opacity-70">Better:</span> {turn.review.better}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, delta }: { values: number[]; delta: number }) {
  const w = 600, h = 120, pad = 12;
  const max = Math.max(100, ...values), min = 0;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const last = values[values.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${h - pad} ${pts} ${pad + (values.length - 1) * step},${h - pad}`}
          fill="url(#sg)"
        />
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex items-baseline justify-between mt-2 text-sm">
        <span className="text-muted-foreground text-xs">{values.length} samples</span>
        <span>
          <span className="text-2xl font-semibold tabular-nums">{last}</span>
          <span className={cn("ml-2 text-xs", delta >= 0 ? "text-emerald-600" : "text-muted-foreground")}>
            {delta > 0 ? `+${delta}` : delta} recent vs early
          </span>
        </span>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{msg}</div>;
}

/**
 * Compute a rolling-average trend: for each index i, average of the last
 * `window` samples up to and including i. Output length == input length.
 */
function buildTrend(values: number[], windowSize: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    const avg = Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    out.push(avg);
  }
  return out;
}

function computeStreak(dates: string[]) {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let count = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
