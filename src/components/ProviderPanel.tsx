import { useState } from "react";
import { useApp } from "../store";
import { CompatLLM } from "../providers";
import type { ProviderConfig, ProviderKind } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input, Label } from "./ui/Input";
import { Separator } from "./ui/Separator";
import { cn } from "../lib/cn";

const PROVIDER_DEFAULTS: Record<ProviderKind, Partial<ProviderConfig>> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    asrModel: "gpt-4o-transcribe",
    llmModel: "gpt-5",
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "nova",
  },
  azure: {
    azureApiVersion: "2025-04-01-preview",
    asrModel: "gpt-4o-transcribe",
    llmModel: "gpt-5",
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "nova",
  },
};

export default function ProviderPanel() {
  const config = useApp((s) => s.config);
  const setConfig = useApp((s) => s.setConfig);
  const memory = useApp((s) => s.memory);
  const setMemoryName = useApp((s) => s.setMemoryName);

  const [draft, setDraft] = useState<ProviderConfig>(config);
  const [name, setName] = useState(memory.name ?? "");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);

  function update<K extends keyof ProviderConfig>(k: K, v: ProviderConfig[K]) {
    setDraft({ ...draft, [k]: v });
  }
  function switchProvider(provider: ProviderKind) {
    const defaults = PROVIDER_DEFAULTS[provider];
    setDraft({ ...draft, provider, ...defaults });
    setTestMsg("");
  }
  async function testConn() {
    setTesting(true); setTestMsg("");
    try {
      const llm = new CompatLLM(draft);
      await llm.chatJSON([
        { role: "system", content: "Reply with JSON: {\"ok\":true}" },
        { role: "user", content: "ping" },
      ]);
      setTestMsg("Connected ✓");
    } catch (e: any) {
      setTestMsg(`Failed: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }
  function save() {
    setConfig(draft);
    setMemoryName(name.trim());
    setTestMsg("Saved");
  }

  const modelFieldLabel = draft.provider === "azure" ? "deployment" : "model";

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>What should your companion call you?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>Where the brains, voice, and ears come from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <PresetButton
              active={draft.provider === "openai"}
              title="OpenAI"
              subtitle="Direct API"
              onClick={() => switchProvider("openai")}
            />
            <PresetButton
              active={draft.provider === "azure"}
              title="Azure OpenAI"
              subtitle="Your Azure resource"
              onClick={() => switchProvider("azure")}
            />
          </div>

          {draft.provider === "openai" ? (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={draft.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Defaults to OpenAI. Change to any OpenAI-compatible endpoint (DeepSeek, LM Studio, …).
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Azure endpoint</Label>
                <Input
                  value={draft.azureEndpoint}
                  onChange={(e) => update("azureEndpoint", e.target.value)}
                  placeholder="https://my-resource.openai.azure.com"
                />
                <p className="text-xs text-muted-foreground">
                  From the Azure portal: <span className="font-mono">https://&lt;resource&gt;.openai.azure.com</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>API version</Label>
                <Input value={draft.azureApiVersion} onChange={(e) => update("azureApiVersion", e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>API key</Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder={draft.provider === "azure" ? "Azure resource key" : "sk-…"}
            />
          </div>

          <Separator />

          {draft.provider === "azure" && (
            <p className="text-xs text-muted-foreground -mt-1">
              Azure routes by deployment name, not model id. Create three deployments in your Azure
              resource (LLM, ASR, TTS) and enter the deployment names below.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={`LLM ${modelFieldLabel}`}  value={draft.llmModel} onChange={(v) => update("llmModel", v)} />
            <Field label={`ASR ${modelFieldLabel}`}  value={draft.asrModel} onChange={(v) => update("asrModel", v)} />
            <Field label={`TTS ${modelFieldLabel}`}  value={draft.ttsModel} onChange={(v) => update("ttsModel", v)} />
            <Field label="TTS voice"                value={draft.ttsVoice} onChange={(v) => update("ttsVoice", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save}>Save changes</Button>
        <Button
          variant="outline"
          onClick={testConn}
          disabled={testing || !draft.apiKey || (draft.provider === "azure" && !draft.azureEndpoint)}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {testMsg && <span className="text-xs text-muted-foreground">{testMsg}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PresetButton({
  active, title, subtitle, onClick,
}: { active: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border text-left transition",
        active
          ? "border-primary bg-accent ring-1 ring-primary"
          : "border-input hover:bg-accent/50"
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}
