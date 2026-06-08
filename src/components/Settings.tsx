import { useEffect, useState } from "react";
import { Palette, Cpu, Info } from "lucide-react";
import { cn } from "../lib/cn";
import { useApp } from "../store";
import AppearancePanel from "./AppearancePanel";
import ProviderPanel from "./ProviderPanel";
import AboutPanel from "./AboutPanel";

type Tab = "appearance" | "provider" | "about";

const TABS: { id: Tab; label: string; icon: typeof Palette; desc: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme · typography · background" },
  { id: "provider",   label: "AI provider", icon: Cpu,    desc: "Models · keys · endpoints" },
  { id: "about",      label: "About",       icon: Info,   desc: "Version · updates · links" },
];

export default function Settings() {
  const consumePendingSettingsTab = useApp((s) => s.consumePendingSettingsTab);
  const [tab, setTab] = useState<Tab>(() => consumePendingSettingsTab() ?? "appearance");
  const updateStatus = useApp((s) => s.updateStatus);
  const updateAvailable = updateStatus === "available" || updateStatus === "installed";

  // If a deep-link request arrives *after* mount (e.g. user is already on
  // Settings and clicks an in-app banner that re-targets a tab), honor it.
  const pending = useApp((s) => s.pendingSettingsTab);
  useEffect(() => {
    if (pending) {
      setTab(pending);
      consumePendingSettingsTab();
    }
  }, [pending, consumePendingSettingsTab]);

  return (
    <div className="h-full flex">
      {/* Sub-nav */}
      <nav className="w-56 shrink-0 h-full border-r p-4 space-y-1">
        <div className="px-2 pb-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Settings</div>
          <h1 className="text-lg font-semibold mt-0.5">Make it yours</h1>
        </div>
        {TABS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md text-left transition",
              tab === id
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium leading-tight">{label}</span>
                {id === "about" && updateAvailable && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                    aria-label="Update available"
                  />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>
            </div>
          </button>
        ))}
      </nav>

      {/* Panel */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {tab === "appearance" && <AppearancePanel />}
          {tab === "provider" && <ProviderPanel />}
          {tab === "about" && <AboutPanel />}
        </div>
      </main>
    </div>
  );
}
