"use client";
import { Select } from "@/components/ui";

type Mode = "system" | "light" | "dark";

/** Applies the theme right away (same storage as ThemeToggle); the form saves it to the profile. */
export function ThemeSelect({ id, defaultValue }: { id: string; defaultValue: Mode }) {
  function apply(m: Mode) {
    try {
      if (m === "system") {
        localStorage.removeItem("gk-theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("gk-theme", m);
        document.documentElement.dataset.theme = m;
      }
    } catch {}
  }
  return (
    <Select id={id} name="theme" defaultValue={defaultValue} onChange={(e) => apply(e.currentTarget.value as Mode)}>
      <option value="system">Match my device</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </Select>
  );
}
