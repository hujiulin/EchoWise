import { useEffect } from "react";
import { useApp } from "./store";
import Sidebar from "./components/Sidebar";
import Conversation from "./components/Conversation";
import Growth from "./components/Growth";
import CompanionView from "./components/Companions";
import Settings from "./components/Settings";
import Logo from "./components/Logo";
import AppearanceHost from "./components/AppearanceHost";

export default function App() {
  const ready = useApp((s) => s.ready);
  const initError = useApp((s) => s.initError);
  const view = useApp((s) => s.view);
  const init = useApp((s) => s.init);

  useEffect(() => { void init(); }, [init]);

  if (!ready) return <Loading />;
  if (initError) return <InitFailed message={initError} />;

  return (
    <AppearanceHost>
      <div className="h-full flex">
        <Sidebar />
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-background/80">
          {view === "conversation" && <Conversation />}
          {view === "growth" && <Growth />}
          {view === "companion" && <CompanionView />}
          {view === "settings" && <Settings />}
        </main>
      </div>
    </AppearanceHost>
  );
}

function Loading() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-background animate-fade-in">
      <div className="animate-pulse">
        <Logo size={56} />
      </div>
      <div className="text-sm text-muted-foreground">Waking up your companion…</div>
    </div>
  );
}

function InitFailed({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Logo size={48} />
      <div className="text-lg font-semibold">Could not open local storage</div>
      <div className="text-sm text-muted-foreground max-w-md">{message}</div>
      <div className="text-xs text-muted-foreground mt-4">
        Try restarting the app. If it persists, the database file may be locked by another instance.
      </div>
    </div>
  );
}
