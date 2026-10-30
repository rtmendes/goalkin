import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { getUser } from "@/lib/auth";
import { sharpenGoal } from "@/lib/ai";

// Onboarding step 2: three sharper versions of the person's sentence.
const body = z.object({ sentence: z.string().trim().min(2).max(200), area: z.string().max(60).nullable().optional() });

export async function POST(req: Request) {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a short sentence first." }, { status: 400 });
  const options = await sharpenGoal(parsed.data.sentence, parsed.data.area ?? null);
  return NextResponse.json({ options: options.slice(0, 3) });
}
