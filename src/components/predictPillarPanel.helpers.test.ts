import { describe, expect, it } from 'vitest'

import {
  buildEnsemblePredictionRunInput,
  buildPredictionRunIdInput,
  buildSinglePredictionRunInput,
} from '#/components/predictPillarPanel.helpers'

describe('predictPillarPanel helpers', () => {
  it('builds the single-model payload as a raw prediction input object', () => {
    expect(buildSinglePredictionRunInput({
      modelKey: 'PoissonGoalsModel',
      league: 'Championship',
      markets: ['1x2', 'btts'],
      targetMode: 'future',
      trainingMode: 'recent',
      trainingLimit: 380,
      targetLimit: 20,
    })).toEqual({
      modelKey: 'PoissonGoalsModel',
      league: 'Championship',
      markets: ['1x2', 'btts'],
      targetMode: 'future',
      trainingMode: 'recent',
      trainingLimit: 380,
      targetLimit: 20,
    })
  })

  it('builds the ensemble payload as a raw prediction input object', () => {
    expect(buildEnsemblePredictionRunInput({
      modelKeys: ['PoissonGoalsModel', 'DixonColesGoalModel'],
      league: 'Premier League',
      weighting: 'uniform',
      targetMode: 'future',
      markets: ['1x2'],
      targetLimit: 15,
    })).toEqual({
      modelKeys: ['PoissonGoalsModel', 'DixonColesGoalModel'],
      league: 'Premier League',
      weighting: 'uniform',
      targetMode: 'future',
      markets: ['1x2'],
      targetLimit: 15,
    })
  })

  it('builds raw run-id payloads for detail and delete actions', () => {
    expect(buildPredictionRunIdInput(42)).toEqual({ runId: 42 })
  })
})