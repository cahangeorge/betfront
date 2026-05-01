import { z } from 'zod'

// Curated registry of penaltyblog goals models we expose for fit + predict.
// Keys MUST match `penaltyblog.models.<ClassName>`.
export const PREDICT_MODELS = [
  { key: 'PoissonGoalsModel', label: 'Poisson', description: 'Independent Poisson goals model.' },
  { key: 'BivariatePoissonGoalModel', label: 'Bivariate Poisson', description: 'Karlis-Ntzoufras bivariate Poisson.' },
  { key: 'DixonColesGoalModel', label: 'Dixon-Coles', description: 'Poisson with low-score dependency correction.' },
  { key: 'NegativeBinomialGoalModel', label: 'Negative Binomial', description: 'Overdispersed Poisson alternative.' },
  { key: 'ZeroInflatedPoissonGoalsModel', label: 'Zero-Inflated Poisson', description: 'Poisson with zero-inflation component.' },
  { key: 'WeibullCopulaGoalsModel', label: 'Weibull Copula', description: 'Weibull-count goals with copula dependency.' },
  { key: 'BayesianGoalModel', label: 'Bayesian Goal', description: 'Bayesian Poisson goals model (MCMC).' },
  { key: 'HierarchicalBayesianGoalModel', label: 'Bayesian Hierarchical', description: 'Hierarchical Bayesian goals model (MCMC).' },
] as const

export type PredictModelKey = (typeof PREDICT_MODELS)[number]['key']
export const PREDICT_MODEL_KEYS = PREDICT_MODELS.map((m) => m.key) as [PredictModelKey, ...PredictModelKey[]]

export const PREDICT_MARKETS = ['1x2', 'btts', 'ou_2_5'] as const
export type PredictMarket = (typeof PREDICT_MARKETS)[number]

// Outcomes per market — keep in sync with how engine derives probabilities from grid.
export const MARKET_OUTCOMES: Record<PredictMarket, readonly string[]> = {
  '1x2': ['home', 'draw', 'away'],
  btts: ['yes', 'no'],
  ou_2_5: ['over', 'under'],
}

export const TRAINING_MODE = ['recent', 'season'] as const
export type TrainingMode = (typeof TRAINING_MODE)[number]

export const TARGET_MODE = ['future', 'history', 'matches'] as const
export type TargetMode = (typeof TARGET_MODE)[number]

export const ENSEMBLE_WEIGHTING = ['uniform', 'brier'] as const
export type EnsembleWeighting = (typeof ENSEMBLE_WEIGHTING)[number]

// Common selectors used by both single + ensemble runs.
export const baseRunSchema = z.object({
  league: z.string().min(1),
  sport: z.string().default('football'),
  markets: z.array(z.enum(PREDICT_MARKETS)).min(1).default(['1x2']),
  trainingMode: z.enum(TRAINING_MODE).default('recent'),
  trainingLimit: z.number().int().min(20).max(2000).default(380),
  trainingDateFrom: z.string().optional(),
  trainingDateTo: z.string().optional(),
  targetMode: z.enum(TARGET_MODE).default('future'),
  targetMatchIds: z.array(z.number().int().positive()).optional(),
  targetLimit: z.number().int().min(1).max(200).default(50),
  targetDateFrom: z.string().optional(),
  targetDateTo: z.string().optional(),
  maxGoals: z.number().int().min(5).max(15).default(10),
})

export const runSingleSchema = baseRunSchema.extend({
  modelKey: z.enum(PREDICT_MODEL_KEYS),
})

export const runEnsembleSchema = baseRunSchema.extend({
  modelKeys: z.array(z.enum(PREDICT_MODEL_KEYS)).min(2),
  weighting: z.enum(ENSEMBLE_WEIGHTING).default('uniform'),
})

export type RunSingleInput = z.infer<typeof runSingleSchema>
export type RunEnsembleInput = z.infer<typeof runEnsembleSchema>
