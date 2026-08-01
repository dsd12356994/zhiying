import { z } from "zod";

// Each scene type gets one literal-discriminated schema entry here.
export const textCardCutSchema = z.object({
  type: z.literal("text_card"),
  durationInFrames: z.number().int().positive(),
  title: z.string(),
  subtitle: z.string().optional(),
  background: z.string().default("#0b0b12"),
});

export const threeTextIntroCutSchema = z.object({
  type: z.literal("three_text_intro"),
  durationInFrames: z.number().int().positive(),
  text: z.string(),
  color: z.string().default("#e8e8ff"),
  background: z.string().default("#05050a"),
});

export const particleBurstCutSchema = z.object({
  type: z.literal("particle_burst"),
  durationInFrames: z.number().int().positive(),
  particleCount: z.number().int().positive().default(1200),
  color: z.string().default("#7dd3fc"),
  background: z.string().default("#05050a"),
});

export const shaderTransitionCutSchema = z.object({
  type: z.literal("shader_transition"),
  durationInFrames: z.number().int().positive(),
  fromColor: z.string().default("#05050a"),
  toColor: z.string().default("#0b0b12"),
});

export const videoClipCutSchema = z.object({
  type: z.literal("video_clip"),
  durationInFrames: z.number().int().positive(),
  src: z.string(),
  trimStart: z.number().min(0).default(0),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  volume: z.number().min(0).max(1).default(1),
});

export const videoTransitionCutSchema = z.object({
  type: z.literal("video_transition"),
  durationInFrames: z.number().int().positive(),
  fromSrc: z.string(),
  fromTrimStart: z.number().min(0).default(0),
  toSrc: z.string(),
  toTrimStart: z.number().min(0).default(0),
});

export const cutSchema = z.discriminatedUnion("type", [
  textCardCutSchema,
  threeTextIntroCutSchema,
  particleBurstCutSchema,
  shaderTransitionCutSchema,
  videoClipCutSchema,
  videoTransitionCutSchema,
]);
export type Cut = z.infer<typeof cutSchema>;

export const compositionPropsSchema = z.object({
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  cuts: z.array(cutSchema).min(1),
});
export type CompositionProps = z.infer<typeof compositionPropsSchema>;

export const totalDurationInFrames = (cuts: Cut[]): number =>
  cuts.reduce((sum, cut) => sum + cut.durationInFrames, 0);
