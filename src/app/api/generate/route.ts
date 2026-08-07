import { NextRequest, NextResponse } from "next/server";
import { generateVideo } from "@/lib/hf-space";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    prompt,
    negativePrompt,
    width,
    height,
    durationSeconds,
    seed,
    randomizeSeed,
    guidanceScale,
  } = body as Record<string, unknown>;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  try {
    const result = await generateVideo({
      prompt,
      negativePrompt: typeof negativePrompt === "string" ? negativePrompt : undefined,
      width: typeof width === "number" ? width : undefined,
      height: typeof height === "number" ? height : undefined,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : undefined,
      seed: typeof seed === "number" ? seed : undefined,
      randomizeSeed: typeof randomizeSeed === "boolean" ? randomizeSeed : undefined,
      guidanceScale: typeof guidanceScale === "number" ? guidanceScale : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
