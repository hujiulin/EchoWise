import { useEffect, useRef, useState } from "react";
import { Mic, Send, Sparkles, X, Loader2, History, Plus, Calendar, MessageCircle, ChevronDown, ArrowUp, StopCircle, Play, Pause } from "lucide-react";
import { useApp, memorySummary } from "../store";
import { Recorder, playBlob } from "../audio";
import { CompatASR, CompatLLM, CompatTTS, companionTurn, reviewSentence, summarizeSession, ttsInstructions } from "../providers";
import { saveUserAudio, saveAssistantAudio, audioSrc } from "../storage";
import { pickDaily, SURPRISE_PROMPTS, TODAYS_TOPIC_POOL } from "../companions";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import Waveform from "./Waveform";
import { cn, formatDuration } from "../lib/cn";
import { dayCount, tierForDay, type Turn, type SentenceReview, type ConversationSummary, type Conversation as Conv } from "../types";
import { bandFor, bandRangeLabel, SCORE_BANDS } from "../scoring";
import Avatar from "./Avatar";

const recorder = new Recorder();
let currentAudio: HTMLAudioElement | undefined;

export default function Conversation() {
  const { active, companion, config, busy, recording, recordStartedAt, error, memory, history } = useApp();
  const { setView, addTurn, updateTurn, setBusy, setRecording, setError, startConversation, loadConversation, endConversation, attachSummary } = useApp();
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [showRecap, setShowRecap] = useState<ConversationSummary | null>(null);
  const [recapDuration, setRecapDuration] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - (recordStartedAt ?? Date.now())), 200);
    return () => clearInterval(id);
  }, [recording, recordStartedAt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.turns.length, busy]);

  const day = dayCount(companion.createdAt);
  const tier = tierForDay(day);

  async function handleUser(userText: string, audioPath?: string, durationMs?: number) {
    if (!userText.trim()) return;
    if (!config.apiKey) {
      setError("Add your API key in Settings first.");
      setView("settings");
      return;
    }
    // Lazy-create a conversation if none is active yet
    if (!active) startConversation();
    const userTurn: Turn = {
      id: crypto.randomUUID(), role: "user", text: userText, audioPath,
      createdAt: Date.now(), durationMs,
    };
    addTurn(userTurn);
    await respond(userTurn);
  }

  async function respond(userTurn: Turn) {
    const a = useApp.getState().active;
    if (!a) return;
    const hist = a.turns.filter((t) => t.id !== userTurn.id).map((t) => ({ role: t.role, content: t.text }));

    // Background: auto-score this user turn if it has substance.
    // Fire-and-forget; the reply flow doesn't wait for it.
    if (countWords(userTurn.text) >= 3) {
      void (async () => {
        try {
          const llm = new CompatLLM(config);
          const review: SentenceReview = await reviewSentence(llm, userTurn.text);
          updateTurn(userTurn.id, { review });
        } catch (e) {
          console.warn("auto-review failed", e);
        }
      })();
    }

    setBusy(true);
    setError(undefined);
    try {
      const llm = new CompatLLM(config);
      const { reply, hint } = await companionTurn(
        llm,
        {
          companionName: companion.name,
          personaLine: companion.persona,
          toneHint: tier.toneHint,
          day,
          topic: a.topic,
          memorySummary: memorySummary(memory),
        },
        hist,
        userTurn.text
      );
      if (hint) updateTurn(userTurn.id, { hint });

      const aiTurn: Turn = { id: crypto.randomUUID(), role: "assistant", text: reply, createdAt: Date.now() };
      addTurn(aiTurn);
      // The reply is on screen — drop the "thinking…" UI immediately.
      // TTS synthesis (network + disk write + playback) runs in the
      // background so it doesn't leave the composer stuck for several
      // seconds after the assistant bubble has already appeared.
      setBusy(false);

      void (async () => {
        try {
          const tts = new CompatTTS(config);
          const blob = await tts.synthesize(reply, companion.voice, ttsInstructions(companion.persona, tier.toneHint));
          try {
            const convId = useApp.getState().active!.id;
            const path = await saveAssistantAudio(convId, aiTurn.id, blob);
            updateTurn(aiTurn.id, { audioPath: path });
          } catch (e) {
            console.warn("assistant audio persist failed", e);
          }
          try {
            currentAudio = await playBlob(blob);
          } catch (e) {
            // Autoplay can be blocked before any user gesture; the bubble
            // still has a play button to recover.
            console.warn("autoplay blocked", e);
          }
        } catch (e: any) {
          setError(`Voice: ${e.message}`);
        }
      })();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function toggleRecord() {
    if (recording) {
      setRecording(false);
      const recStarted = recordStartedAt ?? Date.now();
      try {
        const blob = await recorder.stop();
        const duration = Date.now() - recStarted;
        setBusy(true);
        const asr = new CompatASR(config);
        const { text } = await asr.transcribe(blob, { language: "en" });
        if (!useApp.getState().active) startConversation();
        const convId = useApp.getState().active!.id;
        const turnId = crypto.randomUUID();
        let savedPath: string | undefined;
        try { savedPath = await saveUserAudio(convId, turnId, blob); }
        catch (e) { console.warn("audio persist failed", e); }
        setBusy(false);
        const userTurn: Turn = {
          id: turnId, role: "user", text, audioPath: savedPath,
          createdAt: Date.now(), durationMs: duration,
        };
        addTurn(userTurn);
        await respond(userTurn);
      } catch (e: any) {
        setError(e.message);
        setBusy(false);
      }
    } else {
      setError(undefined);
      try {
        if (currentAudio && !currentAudio.paused) currentAudio.pause();
        await recorder.start();
        recorder.onLevel(setLevel);
        setRecording(true, Date.now());
      } catch (e: any) {
        setError(e.message);
      }
    }
  }

  function cancelRecord() {
    if (!recording) return;
    recorder.cancel();
    setRecording(false);
    setLevel(0);
  }

  function stopPlayback() {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
  }

  async function expandReview(turn: Turn) {
    if (turn.review) { updateTurn(turn.id, { expanded: !turn.expanded }); return; }
    updateTurn(turn.id, { expanded: true });
    try {
      const llm = new CompatLLM(config);
      const review: SentenceReview = await reviewSentence(llm, turn.text);
      updateTurn(turn.id, { review });
    } catch (e: any) { setError(e.message); }
  }

  async function finishAndRecap() {
    if (!active) return;
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    const userTurns = active.turns.filter((t) => t.role === "user");
    if (userTurns.length === 0) { await endConversation(); return; }
    const duration = Date.now() - active.startedAt;
    setRecapDuration(duration);
    setBusy(true);
    try {
      const llm = new CompatLLM(config);
      const summary = await summarizeSession(llm, active.turns.map((t) => ({ role: t.role, text: t.text })));
      const finished = await endConversation();
      if (finished) await attachSummary(finished.id, summary);
      setShowRecap(summary);
    } catch (e: any) {
      await endConversation();
      setShowRecap({
        listening: 0, fluency: 0, pronunciation: 0, vocabulary: 0,
        confidence: 0, grammar: 0,
        highlight: "Great conversation. See you next time.",
      });
      setError(e.message);
    } finally { setBusy(false); }
  }

  function startFresh() {
    if (active) {
      // Save the current one quietly without recap if it has content
      void endConversation();
    }
    startConversation();
    setShowHistory(false);
  }

  function openOld(id: string) {
    if (active) void endConversation();
    loadConversation(id);
    setShowHistory(false);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="h-14 px-4 border-b flex items-center gap-3 bg-card/60 backdrop-blur">
        <Avatar value={companion.avatar} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{companion.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {active?.topic
              ? `on ${active.topic}`
              : active
                ? `Day ${day} · ${tier.label}`
                : `Day ${day} · ${tier.label}`}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
          className="gap-1.5"
        >
          <History className="h-4 w-4" />
          History
          <ChevronDown className={cn("h-3 w-3 transition", showHistory && "rotate-180")} />
        </Button>
        <Button variant="outline" size="sm" onClick={startFresh} disabled={busy}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
        {active && active.turns.filter((t) => t.role === "user").length > 0 && (
          <Button variant="ghost" size="sm" onClick={finishAndRecap} disabled={busy}>
            End
          </Button>
        )}
      </header>

      {/* Body */}
      <div className="relative flex-1 min-h-0">
        {showHistory && (
          <HistoryPanel
            history={history}
            activeId={active?.id}
            onPick={openOld}
            onClose={() => setShowHistory(false)}
            onNew={startFresh}
          />
        )}

        {active && active.turns.length > 0 ? (
          <div ref={scrollRef} className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
              {active.turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} companionAvatar={companion.avatar} onExpand={() => expandReview(turn)} />
              ))}
              {/* Show the typing placeholder ONLY before the AI text arrives.
                  Once the last turn is the assistant's reply, the visible
                  bubble already conveys "AI just spoke" — a trailing
                  three-dot pulse would only re-show during TTS synthesis,
                  which looks like the AI is "thinking again". */}
              {busy && active.turns[active.turns.length - 1]?.role === "user" && (
                <TypingIndicator avatar={companion.avatar} />
              )}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            companionName={companion.name}
            companionAvatar={companion.avatar}
            memberName={memory.name}
            day={day}
            tierLabel={tier.label}
            onStart={() => startConversation()}
            onTopic={(t) => startConversation(t)}
          />
        )}
      </div>

      {/* Footer: single composer with three states */}
      <footer className="border-t bg-card/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {busy ? (
            <ThinkingBar companionName={companion.name} onStop={stopPlayback} />
          ) : recording ? (
            <RecordingBar
              level={level}
              elapsedMs={elapsed}
              onCancel={cancelRecord}
              onSend={toggleRecord}
            />
          ) : (
            <IdleBar
              text={text}
              onTextChange={setText}
              companionName={companion.name}
              onMic={toggleRecord}
              onSubmit={(t) => { setText(""); void handleUser(t); }}
            />
          )}
          {error && (
            <div className="mt-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
              {error}
            </div>
          )}
        </div>
      </footer>

      {showRecap && (
        <RecapModal
          summary={showRecap} duration={recapDuration} companionName={companion.name}
          onClose={() => setShowRecap(null)}
          onViewGrowth={() => { setShowRecap(null); setView("growth"); }}
        />
      )}
    </div>
  );
}

/* ---------------- Empty state (Pure Door folded in) ---------------- */

function EmptyState({
  companionName, companionAvatar, memberName, day, tierLabel, onStart, onTopic,
}: {
  companionName: string; companionAvatar: string; memberName?: string;
  day: number; tierLabel: string;
  onStart: () => void; onTopic: (title: string) => void;
}) {
  const topic = pickDaily(TODAYS_TOPIC_POOL);
  const surprise = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];

  const greeting = (() => {
    const name = memberName ?? "";
    if (day <= 1) return `Hi${name ? " " + name : ""} — I'm ${companionName}. What would you like to talk about today?`;
    if (day < 8) return `Hey${name ? " " + name : ""}, good to see you again. What's on your mind?`;
    if (day < 30) return `${name ? `Hey ${name} —` : "Hey,"} what's new with you?`;
    return `${name ? `${name}!` : "Hey you."} What are we getting into today?`;
  })();

  return (
    <div className="h-full flex items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
        <div className="relative">
          <Avatar value={companionAvatar} size={96} className="shadow-sm" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium whitespace-nowrap">
            Day {day} · {tierLabel}
          </div>
        </div>

        <p className="text-[17px] leading-relaxed text-foreground/90 max-w-sm pt-2">
          "{greeting}"
        </p>

        <button
          onClick={onStart}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          — or pick a thread —
        </button>

        <div className="grid grid-cols-2 gap-3 w-full">
          <Thread
            icon={<Calendar className="h-3.5 w-3.5" />}
            kicker="Today's topic" title={topic.title}
            onClick={() => onTopic(topic.title)}
          />
          <Thread
            icon={<Sparkles className="h-3.5 w-3.5" />}
            kicker="Surprise me" title={surprise.title}
            onClick={() => onTopic(surprise.title)}
          />
        </div>
      </div>
    </div>
  );
}

function Thread({ icon, kicker, title, onClick }: {
  icon: React.ReactNode; kicker: string; title: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1 p-4 rounded-lg border bg-card text-left hover:border-primary/40 hover:bg-accent/30 transition"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {kicker}
      </div>
      <div className="text-sm font-medium line-clamp-2">{title}</div>
    </button>
  );
}

/* ---------------- History dropdown ---------------- */

function HistoryPanel({
  history, activeId, onPick, onClose, onNew,
}: {
  history: Conv[];
  activeId?: string;
  onPick: (id: string) => void;
  onClose: () => void;
  onNew: () => void;
}) {
  return (
    <>
      {/* click-out overlay */}
      <div className="absolute inset-0 z-10" onClick={onClose} />
      <div className="absolute top-2 right-4 z-20 w-[360px] max-h-[70vh] flex flex-col rounded-xl border bg-card shadow-2xl animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-medium">Recent conversations</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No conversations yet.
            </div>
          ) : (
            history.map((c) => {
              const userTurns = c.turns.filter((t) => t.role === "user");
              const preview = userTurns[0]?.text;
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/40 transition",
                    isActive && "bg-accent/30"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <MessageCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium truncate">{c.topic ?? "Open conversation"}</div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {relativeDate(c.startedAt)}
                        </span>
                      </div>
                      {preview && (
                        <div className="text-xs text-muted-foreground italic truncate mt-0.5">"{preview}"</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDuration(c.durationMs)} · {userTurns.length} from you
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={onNew}
          className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-t bg-secondary hover:bg-secondary/80 transition"
        >
          <Plus className="h-3.5 w-3.5" /> New conversation
        </button>
      </div>
    </>
  );
}

function relativeDate(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------------- Turn + Recap ---------------- */

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/* ---------------- Footer composer states ---------------- */

function IdleBar({
  text, onTextChange, companionName, onMic, onSubmit,
}: {
  text: string;
  onTextChange: (v: string) => void;
  companionName: string;
  onMic: () => void;
  onSubmit: (t: string) => void;
}) {
  const hasText = text.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (t) onSubmit(t);
      }}
      className="flex items-center gap-2"
    >
      <input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`Message ${companionName}…`}
        className="flex-1 h-11 px-4 text-sm rounded-full border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      {hasText ? (
        <button
          type="submit"
          className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:scale-105 transition"
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onMic}
          className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:scale-105 transition"
          aria-label="Start recording"
        >
          <Mic className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}

function RecordingBar({
  level, elapsedMs, onCancel, onSend,
}: {
  level: number;
  elapsedMs: number;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex items-center gap-3 h-11 px-3 rounded-full bg-destructive/10 border border-destructive/30 animate-fade-in">
      <button
        onClick={onCancel}
        className="h-8 w-8 rounded-full bg-background hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition"
        aria-label="Cancel recording"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex-1 flex items-center gap-3 min-w-0 text-destructive">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <Waveform currentLevel={level} className="flex-1" />
        <span className="text-xs tabular-nums">{formatDuration(elapsedMs)}</span>
      </div>
      <button
        onClick={onSend}
        className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition"
        aria-label="Stop and send"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}

function ThinkingBar({ companionName, onStop }: { companionName: string; onStop: () => void }) {
  return (
    <div className="flex items-center gap-3 h-11 px-4 rounded-full bg-muted/40 animate-fade-in">
      <span className="text-sm text-muted-foreground flex-1">{companionName} is thinking…</span>
      <button
        onClick={onStop}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        title="Stop voice playback"
      >
        <StopCircle className="h-3.5 w-3.5" /> Stop
      </button>
    </div>
  );
}

/**
 * Three pulsing dots — used both inline (next to an empty assistant bubble
 * placeholder while the LLM is responding) and in ThinkingBar.
 */
function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-1", className)} aria-label="thinking">
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

/**
 * iMessage-style typing placeholder: companion avatar + a small bubble
 * containing three pulsing dots. Used where an assistant turn is about to
 * arrive, so the message stream has visual continuity (avatar + bubble shape
 * preserved) without repeating the bottom-bar "Thinking…" copy.
 */
function TypingIndicator({ avatar }: { avatar: string }) {
  return (
    <div className="flex gap-3 animate-slide-up">
      <Avatar value={avatar} size={32} />
      <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3.5">
        <ThinkingDots className="text-muted-foreground" />
      </div>
    </div>
  );
}

function TurnView({ turn, companionAvatar, onExpand }: {
  turn: Turn; companionAvatar: string; onExpand: () => void;
}) {
  const updateTurn = useApp((s) => s.updateTurn);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  useEffect(() => {
    if (turn.audioPath) void audioSrc(turn.audioPath).then(setAudioUrl);
  }, [turn.audioPath]);

  if (turn.role === "assistant") {
    return (
      <div className="flex gap-3 animate-slide-up">
        <Avatar value={companionAvatar} size={32} />
        <div className="flex-1 min-w-0 max-w-[80%] space-y-1">
          <AssistantVoiceBubble
            text={turn.text}
            audioUrl={audioUrl}
            transcriptShown={!!turn.transcriptShown}
            onToggleTranscript={() => updateTurn(turn.id, { transcriptShown: !turn.transcriptShown })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[80%] space-y-1.5">
        <div className="relative inline-block w-full">
          <div
            onClick={onExpand}
            className="cursor-pointer rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 pr-12 text-[15px] leading-relaxed hover:opacity-90 transition"
          >
            {turn.text}
          </div>
          {turn.review && (
            <span
              onClick={onExpand}
              className={cn(
                "absolute top-2 right-2 cursor-pointer text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md transition hover:scale-110",
                bandFor(turn.review.score).chipClass
              )}
              title={`${bandFor(turn.review.score).label} — ${bandFor(turn.review.score).meaning}`}
            >
              {turn.review.score}
            </span>
          )}
        </div>

        {audioUrl && (
          <audio controls src={audioUrl} className="h-7 w-full opacity-60" />
        )}

        {turn.hint && !turn.expanded && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-3">
            <Sparkles className="h-3 w-3" />
            <span className="line-through opacity-70">{turn.hint.original}</span>
            <span>→</span>
            <span className="text-foreground font-medium">{turn.hint.suggestion}</span>
            {turn.hint.note && <span className="opacity-70">· {turn.hint.note}</span>}
          </div>
        )}

        {turn.expanded && (
          <Card className="animate-slide-up">
            <CardContent className="p-4 space-y-3 text-sm">
              {!turn.review ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reviewing…
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border-0", bandFor(turn.review.score).chipClass)}>
                        {bandFor(turn.review.score).label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {bandFor(turn.review.score).meaning}
                      </span>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums">{turn.review.score}</span>
                  </div>
                  <div className="space-y-2.5">
                    <ReviewRow label="Original" text={turn.review.original} tone="muted" />
                    <ReviewRow label="Better" text={turn.review.better} tone="primary" />
                    <ReviewRow label="Native-like" text={turn.review.nativeLike} tone="success" />
                  </div>
                  <BandLegend currentScore={turn.review.score} />
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, text, tone }: {
  label: string; text: string; tone: "muted" | "primary" | "success";
}) {
  const toneCls = {
    muted: "text-muted-foreground",
    primary: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("text-sm leading-relaxed", toneCls)}>{text}</div>
    </div>
  );
}

/* ---------------- Assistant voice bubble ---------------- */

function AssistantVoiceBubble({
  text, audioUrl, transcriptShown, onToggleTranscript,
}: {
  text: string;
  audioUrl?: string;
  transcriptShown: boolean;
  onToggleTranscript: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  useEffect(() => {
    if (!audioUrl) return;
    setLoadError(undefined);
    const a = new Audio(audioUrl);
    a.preload = "auto";
    a.addEventListener("ended", () => setPlaying(false));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(a.duration)) setDuration(a.duration);
    });
    a.addEventListener("error", () => {
      console.error("audio load error", audioUrl, a.error);
      setLoadError(`load failed (code ${a.error?.code ?? "?"})`);
    });
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    try {
      await a.play();
      setPlaying(true);
    } catch (e: any) {
      console.error("audio play error", e);
      setLoadError(`play failed: ${e?.message ?? e}`);
      setPlaying(false);
    }
  }

  const estSec = duration ?? Math.max(2, Math.round(text.split(/\s+/).length / 2.5));
  const widthPx = Math.min(280, 120 + Math.round(estSec * 6));
  const canPlay = !!audioUrl;

  return (
    <>
      <button
        type="button"
        onClick={togglePlay}
        disabled={!canPlay}
        style={{ width: widthPx }}
        className={cn(
          "group h-12 rounded-2xl rounded-tl-sm flex items-center gap-3 pl-3 pr-4 transition select-none",
          canPlay
            ? "bg-secondary hover:bg-accent text-foreground cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        <span
          className={cn(
            "shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition",
            playing
              ? "bg-primary text-primary-foreground"
              : "bg-background text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
          )}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
        </span>
        <VoiceBars playing={playing} />
        <span className="ml-auto text-xs tabular-nums opacity-70">
          {duration ? formatSec(duration) : "·"}
        </span>
      </button>
      <button
        onClick={onToggleTranscript}
        className="text-[11px] text-muted-foreground hover:text-foreground pl-2 transition"
      >
        {transcriptShown ? "Hide transcript" : "Show transcript"}
      </button>
      {loadError && (
        <div className="text-[11px] text-destructive pl-2">⚠ Audio {loadError}</div>
      )}
      {transcriptShown && (
        <div className="rounded-xl bg-secondary/60 px-4 py-2.5 text-sm leading-relaxed text-foreground/90 animate-fade-in">
          {text}
        </div>
      )}
    </>
  );
}

function VoiceBars({ playing }: { playing: boolean }) {
  const heights = [10, 16, 22, 18, 12, 20, 14, 18, 10, 22, 14, 16];
  return (
    <div className="flex items-center gap-[2px] h-5">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full bg-current",
            playing && "animate-pulse"
          )}
          style={{
            height: `${h}px`,
            animationDelay: playing ? `${i * 60}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function formatSec(s: number) {
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

function BandLegend({ currentScore }: { currentScore: number }) {
  const current = bandFor(currentScore);
  return (
    <div className="pt-3 border-t">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
        How scoring works
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {SCORE_BANDS.map((b) => {
          const active = b.id === current.id;
          return (
            <div
              key={b.id}
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}
              title={b.meaning}
            >
              <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
              <span>{b.label}</span>
              <span className="tabular-nums opacity-60">{bandRangeLabel(b)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecapModal({
  summary, duration, companionName, onClose, onViewGrowth,
}: {
  summary: ConversationSummary;
  duration: number;
  companionName: string;
  onClose: () => void;
  onViewGrowth: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <Card className="max-w-md w-full shadow-2xl">
        <CardContent className="p-6 space-y-5">
          <button onClick={onClose} className="float-right text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Great conversation
            </div>
            <div className="text-3xl font-semibold tabular-nums">{formatDuration(duration)}</div>
            <div className="text-sm text-muted-foreground mt-1">of conversation with {companionName}</div>
          </div>

          <div className="p-4 rounded-lg bg-secondary text-sm leading-relaxed">
            ✨ {summary.highlight}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Listening", summary.listening],
              ["Fluency", summary.fluency],
              ["Confidence", summary.confidence],
            ].map(([label, v]) => (
              <div key={label as string} className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-semibold tabular-nums">{v as number}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Done</Button>
            <Button className="flex-1" onClick={onViewGrowth}>View growth</Button>
          </div>
          <div className="text-center text-xs text-muted-foreground">See you tomorrow.</div>
        </CardContent>
      </Card>
    </div>
  );
}
