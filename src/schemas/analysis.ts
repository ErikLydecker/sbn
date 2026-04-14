import { z } from 'zod/v4'

export const HmmStateNameSchema = z.enum(['RISING', 'PEAK', 'FALLING', 'TROUGH'])
export type HmmStateName = z.infer<typeof HmmStateNameSchema>

export const FrequencyBinSchema = z.object({
  k: z.number().int().positive(),
  re: z.number(),
  im: z.number(),
  amp: z.number().nonnegative(),
})

export type FrequencyBin = z.infer<typeof FrequencyBinSchema>

export const RawAnalysisSchema = z.object({
  phaseDeg: z.number(),
  rBar: z.number(),
  cyclePosition: z.number(),
  dominantK: z.number().int(),
  frequencies: z.array(FrequencyBinSchema),
  windowData: z.array(z.number()),
  meanPhase: z.number(),
})

export type RawAnalysis = z.infer<typeof RawAnalysisSchema>

export const SmoothAnalysisSchema = z.object({
  phaseDeg: z.number(),
  rBar: z.number(),
  vmKappa: z.number(),
  vmMu: z.number(),
  clockPosition: z.number(),
  clockVelocity: z.number(),
  trail: z.array(z.number()),
  hmmAlpha: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  hmmActiveState: z.number().int().min(0).max(3),
  tDom: z.number().int().positive(),
  tDomFrac: z.number().positive().optional(),
  goertzelSpectrum: z.array(FrequencyBinSchema).optional(),
  goertzelDomK: z.number().int().positive().optional(),
  goertzelConfidence: z.number().min(0).max(1).optional(),
  tau: z.number().int().positive(),
  embeddingDim: z.number().int().positive(),
  embedSpan: z.number().int().nonnegative(),
  phaseWindow: z.number().int().positive(),
  vmHorizon: z.number().int().positive(),
  vmLambda: z.number().positive(),
  hmmDwell: z.number().int().positive(),
  hmmPSelf: z.number(),
  barCount: z.number().int().nonnegative(),
  isBootstrapping: z.boolean(),
  bootstrapProgress: z.number().min(0).max(1),

  embeddingVecs: z.array(z.array(z.number())).optional(),
  recurrenceMatrix: z.array(z.number()).optional(),
  recurrenceSize: z.number().int().nonnegative().optional(),
  recurrenceRate: z.number().optional(),
  fixedRecurrenceRate: z.number().optional(),
  corrDimEstimate: z.number().optional(),
  structureScore: z.number().min(0).max(1).optional(),
  subspaceStability: z.number().min(0).max(1).optional(),
  pipelineReturns: z.array(z.number()).optional(),
  pipelineDenoised: z.array(z.number()).optional(),
  pipelineTimestamps: z.array(z.number()).optional(),

  windingNumber: z.number().optional(),
  absWinding: z.number().optional(),
  circulation: z.number().optional(),
  loopClosure: z.number().optional(),
  topologyStability: z.number().min(0).max(1).optional(),
  topologyScore: z.number().min(0).max(1).optional(),
  topologyClass: z.enum(['stable_loop', 'unstable_loop', 'drift', 'chaotic']).optional(),

  morphologySpecies: z.number().int().optional(),
  curvatureProfile: z.array(z.number()).optional(),
  torsionProfile: z.array(z.number()).optional(),
  meanCurvature: z.number().optional(),
  maxCurvature: z.number().optional(),
  curvatureVariance: z.number().optional(),
  curvatureConcentration: z.number().optional(),
  meanTorsion: z.number().optional(),
  torsionEnergy: z.number().optional(),
  h0Persistence: z.number().optional(),
  h1Peak: z.number().optional(),
  h1Persistence: z.number().optional(),
  fragmentationRate: z.number().optional(),
  bettiH0: z.array(z.number()).optional(),
  bettiH1: z.array(z.number()).optional(),
  bettiThresholds: z.array(z.number()).optional(),
  fourierDescriptors: z.array(z.number()).optional(),
  curvatureSignature: z.array(z.number()).optional(),

  ppc: z.number().optional(),
  hurst: z.number().min(0).max(1).optional(),
})

export type SmoothAnalysis = z.infer<typeof SmoothAnalysisSchema>
