"use client";

import { useEffect, useRef, useState } from "react";
import { ASPECT_PRESETS, type AspectKey, type GenerationRecord } from "@/lib/types";

const HISTORY_KEY = "prompt-to-video:history";
const MAX_HISTORY = 12;

const STATUS_MESSAGES = [
  "Warming up the GPU…",
  "Waiting in the shared queue…",
  "Sketching the first frames…",
  "Animating motion…",
  "Upscaling texture detail…",
  "Almost there…",
];

function loadHistory(): GenerationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GenerationRecord[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: GenerationRecord[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
}

export default function Generator() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("worst quality, blurry, distorted, watermark");
  const [aspect, setAspect] = useState<AspectKey>("landscape");
  const [duration, setDuration] = useState(3);
  const [guidanceScale, setGuidanceScale] = useState(1);
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [seed, setSeed] = useState(42);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState(STATUS_MESSAGES[0]);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GenerationRecord | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // localStorage isn't available during SSR, so history has to be read
    // after mount rather than as a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || status === "loading") return;

    setStatus("loading");
    setErrorMessage("");
    setElapsed(0);
    let tick = 0;
    timerRef.current = setInterval(() => {
      tick += 1;
      setElapsed(tick);
      setStatusMessage(STATUS_MESSAGES[Math.min(Math.floor(tick / 8), STATUS_MESSAGES.length - 1)]);
    }, 1000);

    const { width, height } = ASPECT_PRESETS[aspect];

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          width,
          height,
          durationSeconds: duration,
          guidanceScale,
          randomizeSeed,
          seed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      const record: GenerationRecord = {
        id: crypto.randomUUID(),
        prompt,
        negativePrompt,
        width,
        height,
        durationSeconds: duration,
        guidanceScale,
        seedUsed: data.seedUsed,
        videoUrl: data.videoUrl,
        createdAt: Date.now(),
      };

      setResult(record);
      setHistory((prev) => {
        const next = [record, ...prev].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prompt to Video</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Free text-to-video generation powered by{" "}
          <a
            href="https://huggingface.co/spaces/Lightricks/ltx-video-distilled"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            LTX-Video 13B (distilled)
          </a>{" "}
          running on a shared Hugging Face GPU — generation can take 30s&ndash;3min depending on queue.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A majestic dragon flying over a medieval castle at sunset, cinematic"
            rows={3}
            required
            className="resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(ASPECT_PRESETS) as AspectKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAspect(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                aspect === key
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
              }`}
            >
              {ASPECT_PRESETS[key].label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm font-medium">
            <span>Duration</span>
            <span className="text-neutral-500 dark:text-neutral-400">{duration.toFixed(1)}s</span>
          </span>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="self-start text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          {showAdvanced ? "Hide advanced options" : "Show advanced options"}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Negative prompt</span>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-sm font-medium">
                <span>Guidance scale (CFG)</span>
                <span className="text-neutral-500 dark:text-neutral-400">{guidanceScale.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={guidanceScale}
                onChange={(e) => setGuidanceScale(Number(e.target.value))}
              />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                LTX-Video generally looks best with a low value (1&ndash;3).
              </span>
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={randomizeSeed}
                  onChange={(e) => setRandomizeSeed(e.target.checked)}
                />
                Randomize seed
              </label>
              {!randomizeSeed && (
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="w-32 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
                />
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="mt-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {isLoading ? `Generating… ${elapsed}s` : "Generate video"}
        </button>
      </form>

      {isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{statusMessage}</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {result && !isLoading && (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <video
            key={result.id}
            src={result.videoUrl}
            controls
            loop
            muted
            autoPlay
            preload="auto"
            className="w-full rounded-lg bg-black"
          />
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>seed {result.seedUsed}</span>
            <a href={result.videoUrl} download target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200">
              Download
            </a>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">History</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => setResult(item)}
                className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 text-left dark:border-neutral-800"
              >
                <video
                  src={item.videoUrl}
                  muted
                  preload="metadata"
                  playsInline
                  onLoadedMetadata={(e) => {
                    // Nudge the frame forward so the browser paints a
                    // thumbnail instead of leaving the element blank/black.
                    e.currentTarget.currentTime = 0.05;
                  }}
                  className="aspect-video w-full bg-black object-cover"
                />
                <span className="line-clamp-2 px-2 py-1.5 text-xs text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-neutral-100">
                  {item.prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
