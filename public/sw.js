/* GoalKin service worker: reminders (web push), one-tap check-in, offline fallback. */
const CACHE = "gk-shell-v1";
const OFFLINE_URL = "/offline.html";

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · GoalKin</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F3EC;color:#14213D;font-family:system-ui,sans-serif;padding:16px}
@media (prefers-color-scheme:dark){body{background:#0d1526;color:#F7F3EC}}main{max-width:28rem;text-align:center}h1{font-family:Georgia,serif}
a{display:inline-block;margin-top:12px;padding:12px 18px;border-radius:12px;background:#2F7D6D;color:#fff;font-weight:700;text-decoration:none}</style></head>
<body><main><h1>You're offline</h1><p>GoalKin needs a connection to load your goals. Your progress is safe. Try again when you're back online.</p><a href="/app">Try again</a></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.put(OFFLINE_URL, new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Pages are personal and dynamic, so only navigations get a fallback; nothing private is cached.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "GoalKin", body: event.data ? event.data.text() : "" };
  }
  const actions = [{ action: "open", title: "Open" }];
  if (data.checkinUrl) actions.unshift({ action: "done", title: "Done" });
  event.waitUntil(
    self.registration.showNotification(data.title || "GoalKin", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "goalkin",
      renotify: false,
      data: { url: data.url || "/app", checkinUrl: data.checkinUrl || null },
      actions,
    }),
  );
});

async function openOrFocus(url) {
  const target = new URL(url, self.location.origin).href;
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if (c.url.startsWith(self.location.origin)) {
      await c.focus();
      if ("navigate" in c) return c.navigate(target);
      return c;
    }
  }
  return self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  const { url, checkinUrl } = event.notification.data || {};
  event.notification.close();
  if (event.action === "done" && checkinUrl) {
    event.waitUntil(
      fetch(checkinUrl, { method: "GET", credentials: "include", redirect: "follow" })
        .then((res) =>
          self.registration.showNotification(res.ok ? "Checked in ✓" : "Couldn't check in", {
            body: res.ok ? "Nice work. Today is recorded." : "Open GoalKin to check in.",
            icon: "/icons/icon-192.png",
            tag: "goalkin-checkin",
            data: { url: url || "/app" },
          }),
        )
        .catch(() => openOrFocus(checkinUrl)),
    );
    return;
  }
  event.waitUntil(openOrFocus(url || "/app"));
});
