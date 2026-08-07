// Server-only client for calling the LTX-Video text-to-video Gradio Space
// hosted for free on Hugging Face (ZeroGPU). We talk to the Gradio HTTP
// "queue" API directly with fetch() instead of the @gradio/client npm
// package, because that package assumes a Node.js runtime and breaks when
// Next.js bundles it (see gradio-app/gradio#8864).
//
// Docs for this API shape: https://www.gradio.app/guides/querying-gradio-apps-with-curl
// Space: https://huggingface.co/spaces/Lightricks/ltx-video-distilled

const SPACE_BASE_URL = "https://lightricks-ltx-video-distilled.hf.space";
const API_NAME = "text_to_video";

export interface GenerateVideoParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  seed?: number;
  randomizeSeed?: boolean;
  guidanceScale?: number;
}

export interface GenerateVideoResult {
  videoUrl: string;
  seedUsed: number;
}

// Component value ranges as configured on the Space (see /config), used to
// clamp anything a caller sends us before it hits the model.
const LIMITS = {
  width: { min: 256, max: 1280 },
  height: { min: 256, max: 1280 },
  durationSeconds: { min: 0.3, max: 8.5 },
  guidanceScale: { min: 1, max: 10 },
  seed: { min: 0, max: 4294967295 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

class InferenceError extends Error {}

export async function generateVideo(
  params: GenerateVideoParams,
): Promise<GenerateVideoResult> {
  const prompt = params.prompt.trim();
  if (!prompt) throw new InferenceError("Prompt is required.");

  const width = clamp(params.width ?? 704, LIMITS.width.min, LIMITS.width.max);
  const height = clamp(params.height ?? 512, LIMITS.height.min, LIMITS.height.max);
  const durationSeconds = clamp(
    params.durationSeconds ?? 3,
    LIMITS.durationSeconds.min,
    LIMITS.durationSeconds.max,
  );
  const guidanceScale = clamp(
    params.guidanceScale ?? 1,
    LIMITS.guidanceScale.min,
    LIMITS.guidanceScale.max,
  );
  const randomizeSeed = params.randomizeSeed ?? true;
  const seed = clamp(params.seed ?? 42, LIMITS.seed.min, LIMITS.seed.max);

  // Positional args must match the Space's `text_to_video` handler signature
  // exactly: [prompt, negative_prompt, image_name, video_name, height, width,
  // task, duration_seconds, frames_to_use, seed, randomize_seed,
  // guidance_scale, improve_texture]. image_name/video_name/frames_to_use
  // are only relevant to the Space's image-to-video and video-to-video
  // tabs, so we pass inert defaults.
  const data = [
    prompt,
    params.negativePrompt?.trim() || "worst quality, blurry, distorted, watermark",
    "",
    "",
    height,
    width,
    "text-to-video",
    durationSeconds,
    9,
    seed,
    randomizeSeed,
    guidanceScale,
    true,
  ];

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.HF_TOKEN) {
    headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  }

  const submitRes = await fetch(`${SPACE_BASE_URL}/gradio_api/call/${API_NAME}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });

  if (!submitRes.ok) {
    throw new InferenceError(
      `Failed to submit generation job (HTTP ${submitRes.status}). The Space may be paused or overloaded — try again shortly.`,
    );
  }

  const { event_id: eventId } = (await submitRes.json()) as { event_id: string };
  if (!eventId) throw new InferenceError("Space did not return a job id.");

  const resultRes = await fetch(
    `${SPACE_BASE_URL}/gradio_api/call/${API_NAME}/${eventId}`,
    { headers, signal: AbortSignal.timeout(5 * 60 * 1000) },
  );

  if (!resultRes.ok || !resultRes.body) {
    throw new InferenceError(`Lost connection while waiting for the video (HTTP ${resultRes.status}).`);
  }

  const raw = await resultRes.text();
  return parseSseResult(raw);
}

function parseSseResult(raw: string): GenerateVideoResult {
  // The stream looks like repeated blocks of:
  //   event: <name>\n
  //   data: <json>\n\n
  // We want the last "complete" event; "error"/"heartbeat" can also appear.
  const blocks = raw.split("\n\n").filter(Boolean);

  for (const block of blocks.reverse()) {
    const eventMatch = block.match(/^event:\s*(\S+)/m);
    const dataMatch = block.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) continue;

    const eventName = eventMatch[1];
    if (eventName === "error") {
      throw new InferenceError(`Generation failed on the model Space: ${dataMatch[1]}`);
    }
    if (eventName === "complete") {
      const payload = JSON.parse(dataMatch[1]);
      const [videoField, seedUsed] = payload as [
        { video: { url: string } },
        number,
      ];
      if (!videoField?.video?.url) {
        throw new InferenceError("Space returned a result with no video.");
      }
      return { videoUrl: videoField.video.url, seedUsed };
    }
  }

  throw new InferenceError("Generation timed out or the Space closed the connection before finishing.");
}
