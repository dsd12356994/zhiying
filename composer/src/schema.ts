import { z } from "zod";

// Each scene type gets one literal-discriminated schema entry here.
// M2 adds particle/shader/3D cut types alongside this one — same union, same dispatch pattern.
export const textCardCutSchema = z.object({
  type: z.literal("text_card"),
  durationInFrames: z.number().int().positive(),
  title: z.string(),
  subtitle: z.string().optional(),
  background: z.string().default("#0b0b12"),
});

export const cutSchema = z.discriminatedUnion("type", [textCardCutSchema]);
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
