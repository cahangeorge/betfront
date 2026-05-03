export type SinglePredictionRunInput = {
  modelKey: string
  league: string
  markets: string[]
  targetMode: string
  trainingMode: string
  trainingLimit: number
  targetLimit: number
}

export type EnsemblePredictionRunInput = {
  modelKeys: string[]
  league: string
  weighting: string
  targetMode: string
  markets: string[]
  targetLimit: number
}

export function buildSinglePredictionRunInput(input: SinglePredictionRunInput) {
  return {
    modelKey: input.modelKey,
    league: input.league,
    markets: input.markets,
    targetMode: input.targetMode,
    trainingMode: input.trainingMode,
    trainingLimit: input.trainingLimit,
    targetLimit: input.targetLimit,
  }
}

export function buildEnsemblePredictionRunInput(input: EnsemblePredictionRunInput) {
  return {
    modelKeys: input.modelKeys,
    league: input.league,
    weighting: input.weighting,
    targetMode: input.targetMode,
    markets: input.markets,
    targetLimit: input.targetLimit,
  }
}

export function buildPredictionRunIdInput(runId: number) {
  return { runId }
}