import * as React from 'react'
import { Button, Card, Input, Label, Select } from '#/components/ui'
import {
  SportCountryLeaguePicker,
  useSportCountryLeagues,
} from '#/components/SportCountryLeaguePicker'

const DIVISIONS = [
  { label: 'Division 1', value: '1' },
  { label: 'Division 2', value: '2' },
]

const CLASSIFIERS = [
  { label: 'Logistic Regression', value: 'LogisticRegression' },
  { label: 'Random Forest', value: 'RandomForest' },
  { label: 'Gradient Boosting', value: 'GradientBoosting' },
  { label: 'XGBoost', value: 'XGBoost' },
]

const ODDS_TYPES = [
  { label: 'Market Maximum', value: 'market_maximum' },
  { label: 'Market Average', value: 'market_average' },
]

function currentYear() {
  return new Date().getFullYear()
}

function yearOptions(count = 6) {
  const y = currentYear()
  return Array.from({ length: count }, (_, i) => {
    const year = y - (count - 1 - i)
    return { label: String(year), value: String(year) }
  })
}

export function TrainPredictTab() {
  const picker = useSportCountryLeagues()
  const [division, setDivision] = React.useState('1')
  const [yearStart, setYearStart] = React.useState(String(currentYear() - 4))
  const [yearEnd, setYearEnd] = React.useState(String(currentYear()))
  const [classifier, setClassifier] = React.useState('LogisticRegression')
  const [oddsType, setOddsType] = React.useState('market_maximum')
  const [stake, setStake] = React.useState('50')
  const [initCash, setInitCash] = React.useState('10000')

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          🧠 Train &amp; Predict — sports-betting
        </h2>
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Use the <strong>sports-betting</strong> ML framework to train classifiers
          on historical football data and predict upcoming match outcomes.
          Supports cross-validated backtesting with configurable betting strategies.
        </p>

        <div className="space-y-2">
          <Label>Sport · Country · League</Label>
          <SportCountryLeaguePicker state={picker} />
          {picker.leagues.length > 1 && (
            <p className="text-[11px] text-[var(--sea-ink-soft)]">
              Train &amp; Predict uses one league at a time — only the first selected (<code>{picker.primaryLeague || '—'}</code>) will be used.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Division</Label>
            <Select value={division} onValueChange={setDivision} options={DIVISIONS} />
          </div>

          <div className="space-y-1">
            <Label>Year Start</Label>
            <Select value={yearStart} onValueChange={setYearStart} options={yearOptions()} />
          </div>

          <div className="space-y-1">
            <Label>Year End</Label>
            <Select value={yearEnd} onValueChange={setYearEnd} options={yearOptions()} />
          </div>

          <div className="space-y-1">
            <Label>Classifier</Label>
            <Select value={classifier} onValueChange={setClassifier} options={CLASSIFIERS} />
          </div>

          <div className="space-y-1">
            <Label>Odds Type</Label>
            <Select value={oddsType} onValueChange={setOddsType} options={ODDS_TYPES} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Initial Cash</Label>
            <Input
              type="number"
              value={initCash}
              onChange={(e) => setInitCash(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Stake per Bet</Label>
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--sand)]/30 p-6 text-center">
          <p className="text-sm font-medium text-[var(--sea-ink-soft)]">
            ⏳ Bridge integration in progress
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]/70">
            The Python bridge to <code>sports-betting</code> is being built.
            Once connected, you'll be able to train models and predict directly from here.
          </p>
        </div>

        <Button disabled className="w-full">
          🚀 Train &amp; Predict
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--sea-ink)]">How it works</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--sea-ink-soft)]">
          <li>Historical data is loaded from football-data.co.uk via <code>SoccerDataLoader</code></li>
          <li>A scikit-learn pipeline preprocesses teams + imputes missing odds</li>
          <li>The classifier is trained with time-series cross-validation</li>
          <li>Predictions are generated for upcoming fixtures</li>
          <li>A betting strategy evaluates expected profit based on odds type</li>
        </ol>
      </Card>
    </div>
  )
}
