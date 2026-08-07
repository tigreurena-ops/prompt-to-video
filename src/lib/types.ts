export interface GenerationRecord {
  id: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  durationSeconds: number;
  guidanceScale: number;
  seedUsed: number;
  videoUrl: string;
  createdAt: number;
}

export const ASPECT_PRESETS = {
  landscape: { label: "Landscape (16:9-ish)", width: 704, height: 512 },
  portrait: { label: "Portrait (9:16-ish)", width: 512, height: 704 },
  square: { label: "Square", width: 576, height: 576 },
} as const;

export type AspectKey = keyof typeof ASPECT_PRESETS;
