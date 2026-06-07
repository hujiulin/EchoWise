import { useState } from "react";
import { Sparkles, RefreshCcw } from "lucide-react";
import { useApp } from "../store";
import { DEFAULT_COMPANION, VOICE_OPTIONS } from "../companions";
import { dayCount, tierForDay, RELATIONSHIP_TIERS } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Input, Label } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Separator } from "./ui/Separator";
import { cn } from "../lib/cn";
import Avatar from "./Avatar";
import AvatarPicker from "./AvatarPicker";

export default function CompanionView() {
  const companion = useApp((s) => s.companion);
  const setCompanion = useApp((s) => s.setCompanion);
  const resetCompanion = useApp((s) => s.resetCompanion);

  const [confirmReset, setConfirmReset] = useState(false);

  const day = dayCount(companion.createdAt);
  const currentTier = tierForDay(day);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-6 animate-fade-in">
      <div>
        <div className="text-sm text-muted-foreground mb-1">Your companion</div>
        <h1 className="text-3xl font-semibold tracking-tight">{companion.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You have one companion who grows with you. Shape who they are below.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-5">
          <Avatar value={companion.avatar} size={80} />
          <div className="flex-1">
            <div className="text-xl font-semibold">{companion.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">Day {day}</Badge>
              <Badge variant="outline">{currentTier.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{currentTier.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shape them</CardTitle>
          <CardDescription>
            Change any of this any time. The relationship continues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={companion.name} onChange={(e) => setCompanion({ name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Avatar</Label>
            <AvatarPicker />
          </div>

          <div className="space-y-2">
            <Label>Voice</Label>
            <div className="grid grid-cols-2 gap-2">
              {VOICE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setCompanion({ voice: v.id })}
                  className={cn(
                    "px-3 py-2 rounded-md border text-sm text-left transition",
                    companion.voice === v.id
                      ? "border-primary bg-accent"
                      : "border-input hover:bg-accent/50"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Who are they?</Label>
            <textarea
              value={companion.persona}
              onChange={(e) => setCompanion({ persona: e.target.value })}
              rows={4}
              className="w-full text-sm p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="A curious tech friend who loves AI and small side projects…"
            />
            <p className="text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 inline mr-1" />
              This shapes their personality. Keep it short and personal.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How you'll grow together</CardTitle>
          <CardDescription>
            The longer you talk, the more naturally they speak with you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {RELATIONSHIP_TIERS.map((tier) => {
              const reached = day >= tier.minDay;
              const isCurrent = tier.id === currentTier.id;
              return (
                <li key={tier.id} className="flex items-start gap-3">
                  <div className={cn(
                    "mt-1 h-2 w-2 rounded-full shrink-0",
                    isCurrent ? "bg-primary ring-4 ring-primary/20"
                      : reached ? "bg-foreground/60" : "bg-border"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        !reached && "text-muted-foreground"
                      )}>{tier.label}</span>
                      <span className="text-[10px] text-muted-foreground">Day {tier.minDay || 1}+</span>
                      {isCurrent && <Badge variant="default" className="text-[10px]">You are here</Badge>}
                    </div>
                    <p className={cn(
                      "text-xs mt-0.5",
                      reached ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}>{tier.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Start over with a new companion</div>
          <div className="text-xs text-muted-foreground">
            This resets the relationship to Day 1. Your conversation history stays.
          </div>
        </div>
        {confirmReset ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="destructive" size="sm"
              onClick={() => { resetCompanion(); setConfirmReset(false); }}>
              Reset
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {companion.name === DEFAULT_COMPANION.name && day <= 1 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Tip: give them a name that feels right to you. It changes everything.
        </p>
      )}
    </div>
  );
}
