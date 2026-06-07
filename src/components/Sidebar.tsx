import { MessageCircle, TrendingUp, User, Settings as SettingsIcon } from "lucide-react";
import { useApp, type View } from "../store";
import { cn } from "../lib/cn";
import { dayCount } from "../types";
import Logo from "./Logo";
import Avatar from "./Avatar";

const NAV: { id: View; label: string; icon: typeof MessageCircle }[] = [
  { id: "conversation", label: "Conversation", icon: MessageCircle },
  { id: "growth", label: "Growth", icon: TrendingUp },
  { id: "companion", label: "Companion", icon: User },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const companion = useApp((s) => s.companion);
  const updateStatus = useApp((s) => s.updateStatus);

  const day = dayCount(companion.createdAt);
  const updateAvailable = updateStatus === "available" || updateStatus === "installed";

  return (
    <aside className="w-60 shrink-0 h-full border-r bg-card flex flex-col">
      <div className="px-4 h-14 flex items-center gap-2.5 border-b">
        <Logo size={22} className="text-foreground shrink-0" />
        <div>
          <div className="text-sm font-semibold leading-none">EchoWise</div>
          <div className="text-[10px] text-muted-foreground mt-1">Just talk.</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const showDot = id === "settings" && updateAvailable;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                view === id
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{label}</span>
              {showDot && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  aria-label="Update available"
                  title="Update available"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={() => setView("companion")}
          className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-accent transition-colors"
        >
          <Avatar value={companion.avatar} size={36} />
          <div className="text-left min-w-0">
            <div className="text-sm font-medium truncate">{companion.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">Day {day} together</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
