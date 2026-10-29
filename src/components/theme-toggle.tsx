"use client";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("gk-theme");
      if (t === "light" || t === "dark") setMode(t);
    } catch {}
  }, []);
  const apply = (m: Mode) => {
    setMode(m);
    try {
      if (m === "system") {
        localStorage.removeItem("gk-theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("gk-theme", m);
        document.documentElement.dataset.theme = m;
      }
    } catch {}
  };
  return (
    <fieldset className="inline-flex rounded-xl border border-line p-0.5 text-xs">
      <legend className="sr-only">Theme</legend>
      {(["system", "light", "dark"] as Mode[]).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => apply(m)}
          className={`min-h-9 rounded-lg px-2.5 capitalize ${mode === m ? "bg-surface-2 font-semibold" : "text-muted"}`}>
          {m}
        </button>
      ))}
    </fieldset>
  );
}
