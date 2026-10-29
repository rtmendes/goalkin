"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type State = "loading" | "unsupported" | "no-config" | "denied" | "off" | "on" | "working";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Registers the service worker and turns web push reminders on or off for this device. */
export function PushDevice({ vapidPublicKey }: { vapidPublicKey: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (!vapidPublicKey) return setState("no-config");
    if (Notification.permission === "denied") return setState("denied");
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }, [vapidPublicKey]);

  useEffect(() => {
    // Async check of browser capabilities; state is set once it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(() => setState("unsupported"));
  }, [refresh]);

  async function enable() {
    setState("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error();
      setState("on");
      setMessage("Reminders are on for this device.");
      router.refresh();
    } catch {
      setState("off");
      setMessage("Couldn't turn on reminders here. Try again, or use email.");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setMessage("Reminders are off for this device.");
      router.refresh();
    } finally {
      setState("off");
    }
  }

  return (
    <div className="space-y-2">
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t show reminders. On iPhone, add GoalKin to your Home Screen first (Share, then Add to Home Screen).</p>}
      {state === "no-config" && <p className="text-sm text-muted">Device reminders aren&apos;t set up on this server yet. Email reminders still work.</p>}
      {state === "denied" && <p className="text-sm text-muted">Notifications are blocked for GoalKin in this browser. Allow them in your browser&apos;s site settings, then come back.</p>}
      {(state === "off" || state === "working" || state === "loading") && (
        <Button type="button" variant="sage" onClick={enable} disabled={state !== "off"}>
          <span aria-hidden>🔔</span> Enable reminders on this device
        </Button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-sage-ink"><span aria-hidden>✓</span> On for this device</span>
          <Button type="button" variant="secondary" onClick={disable}>Turn off on this device</Button>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-muted">{message}</p>
    </div>
  );
}
