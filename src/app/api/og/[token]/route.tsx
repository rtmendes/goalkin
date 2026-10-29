import { ImageResponse } from "next/og";
import { loadPublicGoal } from "@/lib/goals";
import type { SharedGoalView } from "@/lib/visibility";

// Share card for /s/[token]. Draws only what the public view already allows:
// the title, the status word and % only when the owner made them public.

const NAVY = "#14213D", GOLD = "#C9A86A", CORAL = "#FF6B4A", SAGE = "#2F7D6D", IVORY = "#F7F3EC";
const STATUS: Record<NonNullable<SharedGoalView["status"]>, [string, string]> = {
  on_track: ["On track", SAGE], behind: ["Catching up", CORAL], finished: ["Finished", GOLD], not_started: ["Starting soon", "#4A5468"],
};

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let view: SharedGoalView | null = null;
  try {
    view = await loadPublicGoal(token);
  } catch {
    view = null;
  }
  const title = view?.title ?? "A goal on GoalKin";
  const status = view?.status ? STATUS[view.status] : null;
  const pct = view?.percent;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: IVORY, padding: 64, fontFamily: "serif" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 900, color: NAVY }}>
          <span>goal</span><span style={{ color: GOLD }}>Kin</span>
          {view?.area && <span style={{ marginLeft: 24, fontSize: 26, fontWeight: 400, color: "#4A5468" }}>{view.area}</span>}
        </div>
        <div style={{ display: "flex", fontSize: title.length > 60 ? 56 : 72, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {status && <div style={{ display: "flex", background: status[1], color: "white", borderRadius: 999, padding: "10px 28px", fontSize: 30, fontWeight: 700 }}>{status[0]}</div>}
            {pct !== undefined && <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: NAVY }}>{pct}% there</div>}
          </div>
          {pct !== undefined && (
            <div style={{ display: "flex", width: "100%", height: 24, background: "#E5DDCF", borderRadius: 999 }}>
              <div style={{ display: "flex", width: `${Math.max(2, pct)}%`, height: 24, background: SAGE, borderRadius: 999 }} />
            </div>
          )}
          <div style={{ display: "flex", height: 8, width: 160, background: CORAL, borderRadius: 4 }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
