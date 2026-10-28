       "use client";
import { useState, useRef } from "react";

const scenes = [
"Phone vibrating in dark Vienna apartment",
"Man runs down stairs to the subway",
"Orange U3 train arrives at station",
"Inside U3 train at midnight",
"Westbahnhof at night",
"Blonde girl waits under neon lights",
"Dark Vienna alley with red lights",
"Black jacket with golden Edelweiss button",
"Money on table, cinematic closeup",
"DELACO recording studio",
"Music contract being signed",
"Luxury building rising over Vienna",
"Sports car on neon street",
"Wien Mitte station at night",
"Volkstheater pink neon lights",
"Rooftop rap performance above Vienna",
"Dynamic rooftop performance closeup",
"Designer streetwear and money montage",
"Shopping district at night",
"Woman with pink knee tattoo",
"Two characters walking under neon",
"Flashback to small apartment kitchen",
"Old apartment transforms into penthouse",
"Football stadium action scene",
"Golden trophy under stadium lights",
"Woman with eyeliner and bat tattoo",
"Purple-lit Vienna street",
"Empty subway platform at 4 AM",
"Man walking alone in underground tunnel",
"Phone displaying SOS notification",
"Man walks away from phone call",
"Surreal nighttime Vienna panorama",
"Buildings rotate around main character",
"Final chorus on rooftop",
"Orange U3 train speeds past camera",
"Luxury car and studio montage",
"DELACO neon sign in Vienna",
"Phone call at Volkstheater",
"Main character smiles and walks away",
"DELACO logo reveal on black background"
];

const style = "Cinematic 2D/3D comic-book animation, bold ink outlines, halftone shading, fluid camera movements, orange and purple neon Vienna nightlife. Same young male cartoon character in every scene: black curly hair under cap, big expressive eyes, muscular arms, sunglasses hanging from collar. Silent video, no watermark, no text.";

export default function BatchPage() {
  const [clips, setClips] = useState<Record<number,string>>({});
  const [current, setCurrent] = useState(-1);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  async function start() {
    if (running) return;
    stop.current = false;
    setRunning(true);
    setError("");

    for (let i = 0; i < scenes.length; i++) {
      if (stop.current) break;
      if (clips[i]) continue;
      setCurrent(i);

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: style + " Scene: " + scenes[i],
            durationSeconds: i === 39 ? 4 : 5,
            width: 704,
            height: 512,
            guidanceScale: 1,
            randomizeSeed: false,
            seed: 42
          })
        });

        const data = await response.json();
        if (!response.ok || !data.videoUrl) {
          throw new Error(data.error || "Generation failed");
        }

        setClips(prev => ({
          ...prev,
          [i]: data.videoUrl
        }));
      } catch (e) {
        setError("Scene " + (i + 1) + ": " + String(e));
        break;
      }
    }

    setRunning(false);
    setCurrent(-1);
  }

  return (
    <main className="max-w-3xl mx-auto p-5 space-y-5">
      <h1 className="text-3xl font-bold">DELACO</h1>
      <h2 className="text-xl">Sorry Not Sorry</h2>
      <p>40 sequential clips · 03:19 total target</p>
      <p className="text-sm">
        Keep this page open while generating.
        Free model quotas may interrupt generation.
        Character consistency is not guaranteed.
      </p>
      <button
        onClick={start}
        disabled={running}
        className="bg-black text-white px-5 py-3 rounded-lg"
      >
        {running ? "Generating scene " + (current + 1) : "Start / Resume"}
      </button>
      <button
        onClick={() => { stop.current = true; }}
        className="border px-5 py-3 rounded-lg ml-2"
      >
        Stop
      </button>
      {error && <p className="text-red-500">{error}</p>}
      <p>{Object.keys(clips).length} / 40 completed</p>
      {scenes.map((scene, i) => (
        <section key={i} className="border rounded-lg p-3 space-y-2">
          <h3 className="font-bold">Scene {i + 1}</h3>
          <p className="text-sm">{scene}</p>
          {clips[i] ? (
            <>
              <video src={clips[i]} controls className="w-full" />
              <a href={clips[i]} target="_blank" rel="noreferrer"
                 className="underline">
                Open / Download clip
              </a>
            </>
          ) : <p className="text-sm">Pending</p>}
        </section>
      ))}
    </main>
  );
}
