"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MAX_SECONDS = 60;

const noop = () => () => {};
const canRecord = () => typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

type State = "idle" | "recording" | "recorded" | "uploading" | "error";

/**
 * Records a short voice note, uploads it to the private gk-media bucket under the
 * sender's own folder, then hands the storage path to a Server Action.
 */
export function VoiceRecorder({ userId, action }: { userId: string; action: (fd: FormData) => Promise<void> }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = useSyncExternalStore(noop, canRecord, () => false);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  useEffect(() => {
    if (state === "recording" && seconds >= MAX_SECONDS) stop();
  }, [state, seconds]);

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function start() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        blob.current = new Blob(chunks.current, { type: "audio/webm" });
        setBlobUrl(URL.createObjectURL(blob.current));
        setState("recorded");
        setMessage("Recorded. Listen back, then send or record again.");
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState("recording");
      setMessage("Recording. Up to one minute.");
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState("error");
      setMessage("We couldn't use your microphone. Check your browser's permission and try again.");
    }
  }

  async function send() {
    if (!blob.current) return;
    setState("uploading");
    setMessage("Sending…");
    const path = `${userId}/voice/${crypto.randomUUID()}.webm`;
    const { error } = await createClient().storage.from("gk-media").upload(path, blob.current, { contentType: "audio/webm", upsert: false });
    if (error) {
      setState("recorded");
      setMessage("Upload didn't work. Please try again.");
      return;
    }
    const fd = new FormData();
    fd.set("path", path);
    await action(fd);
    blob.current = null;
    setBlobUrl(null);
    setState("idle");
    setMessage("Voice note sent.");
  }

  if (!supported) return <p className="text-sm text-muted">Voice notes need a browser that can record audio.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {state !== "recording" ? (
          <Button type="button" variant="secondary" onClick={start} disabled={state === "uploading"}>
            <span aria-hidden>●</span> {state === "recorded" ? "Record again" : "Record a voice note"}
          </Button>
        ) : (
          <Button type="button" variant="danger" onClick={stop}>
            <span aria-hidden>■</span> Stop ({seconds}s)
          </Button>
        )}
        {state === "recorded" && (
          <Button type="button" variant="sage" onClick={send}>Send voice note</Button>
        )}
      </div>
      {blobUrl && state !== "uploading" && <audio controls src={blobUrl} className="w-full" aria-label="Your recording" />}
      <p className="text-sm text-muted" aria-live="polite">{message}</p>
    </div>
  );
}
