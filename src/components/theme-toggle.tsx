"use client";
import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "gk-theme";
const listeners = new Set<() => void>();

function read(): Mode {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function write(m: Mode) {
  const root = document.documentElement;
  try {
    if (m === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, m);
  } catch {}
  if (m === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", m);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  return (
    <fieldset className="inline-flex rounded-xl border border-line p-0.5 text-xs">
      <legend className="sr-only">Theme</legend>
      {(["system", "light", "dark"] as Mode[]).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => write(m)}
          className={`min-h-9 rounded-lg px-2.5 capitalize ${mode === m ? "bg-surface-2 font-semibold" : "text-muted"}`}>
          {m}
        </button>
      ))}
    </fieldset>
  );
}
