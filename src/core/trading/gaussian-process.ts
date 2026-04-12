import { matInv, matVec } from '@/core/math/matrix'
import { TRADING_CONFIG } from '@/config/trading'

export interface GpModel {
  X: number[][]
  y: number[]
  noise: number
  lengthscale: number
  Kinv: number[][] | null
}

export function createGp(): GpModel {
  return {
    X: [],
    y: [],
    noise: TRADING_CONFIG.gp.noise,
    lengthscale: TRADING_CONFIG.gp.lengthscale,
    Kinv: null,
  }
}

function rbf(x1: number[], x2: number[], ls: number): number {
  let d2 = 0
  for (let i = 0; i < x1.length; i++) {
    d2 += (x1[i]! - x2[i]!) ** 2
  }
  return Math.exp(-d2 / (2 * ls * ls))
}

export function gpUpdate(gp: GpModel): void {
  const n = gp.X.length
  if (n === 0) {
    gp.Kinv = null
    return
  }

  const K = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      rbf(gp.X[i]!, gp.X[j]!, gp.lengthscale) + (i === j ? gp.noise : 0),
    ),
  )
  gp.Kinv = matInv(K)
}

export interface GpPrediction {
  mean: number
  variance: number
}

export function gpPredict(gp: GpModel, xstar: number[]): GpPrediction {
  if (!gp.Kinv || gp.X.length === 0) {
    return { mean: 0, variance: 1.0 }
  }

  const kstar = gp.X.map((xi) => rbf(xi, xstar, gp.lengthscale))
  const alpha = matVec(gp.Kinv, gp.y)
  let mean = 0
  for (let i = 0; i < gp.X.length; i++) {
    mean += kstar[i]! * alpha[i]!
  }

  const kInvk = matVec(gp.Kinv, kstar)
  let variance = 1.0
  for (let i = 0; i < gp.X.length; i++) {
    variance -= kstar[i]! * kInvk[i]!
  }

  return { mean, variance: Math.max(variance, 1e-6) }
}

export function restoreGp(
  inputs: number[][],
  outputs: number[],
  kernelInverse: number[][] | null,
): GpModel {
  return {
    X: inputs,
    y: outputs,
    noise: TRADING_CONFIG.gp.noise,
    lengthscale: TRADING_CONFIG.gp.lengthscale,
    Kinv: kernelInverse,
  }
}

export function gpAddObservation(gp: GpModel, xNorm: number[], reward: number): void {
  gp.X.push(xNorm.slice())
  gp.y.push(reward)
  if (gp.X.length > TRADING_CONFIG.maxGpObservations) {
    gp.X.shift()
    gp.y.shift()
  }
  gpUpdate(gp)
}
