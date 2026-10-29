"use client";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a photo or voice memo to the private gk-media bucket at
 * `<userId>/<folder>/<file>` and reports the storage path. Files are served
 * later by short-lived signed URLs, never publicly.
 */
export function MediaUpload({
  userId, folder, accept = "image/*", label, name, onUploaded, maxMb = 10,
}: {
  userId: string;
  folder: "why" | "checkins";
  accept?: string;
  label: string;
  name?: string;
  onUploaded?: (path: string | null, fileName: string | null) => void;
  maxMb?: number;
}) {
  const id = useId();
  const [path, setPath] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      setState("error");
      setMsg(`That file is over ${maxMb} MB. Try a shorter clip or smaller photo.`);
      return;
    }
    setState("uploading");
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const p = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await createClient().storage.from("gk-media").upload(p, file, { contentType: file.type, upsert: false });
    if (error) {
      setState("error");
      setMsg("Upload didn't work. You can skip this and add it later.");
      onUploaded?.(null, null);
      return;
    }
    setPath(p);
    setState("done");
    setMsg(`Saved ${file.name}. Only you can see it.`);
    onUploaded?.(p, file.name);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <input id={id} type="file" accept={accept} onChange={onChange}
        className="block w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:font-semibold file:text-ink" />
      {name && <input type="hidden" name={name} value={path ?? ""} />}
      <p aria-live="polite" className={`mt-1 text-xs ${state === "error" ? "text-coral-ink" : "text-muted"}`}>
        {state === "uploading" ? "Uploading..." : msg}
      </p>
    </div>
  );
}
