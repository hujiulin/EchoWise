import { useEffect, useRef, useState } from "react";

/**
 * Rolling-buffer waveform. Reads the most recent N levels (0..1) and
 * renders them as bars. The component owns its own animation loop, fed by
 * the parent via `currentLevel` updated every frame.
 */
export default function Waveform({
  currentLevel,
  bars = 18,
  className,
}: {
  currentLevel: number;
  bars?: number;
  className?: string;
}) {
  const [history, setHistory] = useState<number[]>(() => Array(bars).fill(0));
  const rafRef = useRef<number>();
  const latestRef = useRef(0);

  useEffect(() => { latestRef.current = currentLevel; }, [currentLevel]);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= 60) {
        last = now;
        setHistory((h) => {
          const next = h.slice(1);
          next.push(latestRef.current);
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div className={"flex items-center gap-[3px] h-6 " + (className ?? "")}>
      {history.map((v, i) => {
        const h = Math.max(3, Math.round(v * 24));
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-current transition-all duration-75"
            style={{ height: `${h}px`, opacity: 0.4 + v * 0.6 }}
          />
        );
      })}
    </div>
  );
}
