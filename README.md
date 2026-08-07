# Prompt to Video

A Next.js app that turns a text prompt into a short video, for free, using
[LTX-Video 13B (distilled)](https://huggingface.co/spaces/Lightricks/ltx-video-distilled) —
an open-source text-to-video model — running on a public Hugging Face Space
backed by ZeroGPU. No local GPU, no paid API required.

## How it works

- The browser posts your prompt to `POST /api/generate` (`src/app/api/generate/route.ts`).
- That route calls `src/lib/hf-space.ts`, which submits a job to the Space's
  Gradio HTTP API (`/gradio_api/call/text_to_video`) and polls the SSE event
  stream until the video is ready, then returns its URL.
- The Space is free and shared, so generation typically takes 30s–3min
  depending on the queue.

If the Space ever goes down, is renamed, or you want to swap in a different
model, everything model-specific lives in `src/lib/hf-space.ts` — that's the
only file you need to change.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional: Hugging Face token

The app works out of the box with anonymous requests, but anonymous ZeroGPU
quota is small and shared by everyone. For a smoother experience:

1. Create a free account at https://huggingface.co/join
2. Create a free read-scoped access token at https://huggingface.co/settings/tokens
3. Copy `.env.local.example` to `.env.local` and paste the token into `HF_TOKEN`

Restart `npm run dev` after adding the token.

## Notes / limitations

- This depends on a third-party public Space staying online. It's popular
  and actively maintained, but free demos can occasionally be paused,
  rate-limited, or changed.
- Generation is capped at 5 minutes server-side (`maxDuration` in the API
  route); very long/busy queues can time out.
- If you deploy this (e.g. to Vercel), note serverless function timeout
  limits on your plan — this workload needs a runtime that can hold a
  connection open for minutes, which the free Vercel tier does not allow.
  Running it on a normal Node server (or Vercel Pro+ with an increased
  timeout) works fine.
