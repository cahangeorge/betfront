import * as React from 'react'
import { Button, Card, Input, Label, Select } from '#/components/ui'

const MARKETS = [
  { label: 'Match Odds', value: 'match_odds' },
  { label: 'Over/Under 2.5 Goals', value: 'over_under_25' },
  { label: 'Both Teams To Score', value: 'btts' },
  { label: 'Correct Score', value: 'correct_score' },
  { label: 'Asian Handicap', value: 'asian_handicap' },
]

const STRATEGY_TYPES = [
  { label: 'Back — Bet on an outcome', value: 'back' },
  { label: 'Lay — Bet against an outcome', value: 'lay' },
  { label: 'Back & Lay — In-play trading', value: 'back_lay' },
]

const EXECUTION_MODES = [
  { label: 'Simulated (Paper Trading)', value: 'simulated' },
  { label: 'Live (Betfair Exchange)', value: 'live' },
]

export function FlumineTab() {
  const [market, setMarket] = React.useState('match_odds')
  const [strategyType, setStrategyType] = React.useState('back')
  const [execution, setExecution] = React.useState('simulated')
  const [maxBet, setMaxBet] = React.useState('10')
  const [maxLoss, setMaxLoss] = React.useState('100')

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <h2 className="text-lg font-bold text-[var(--sea-ink)]">
          📈 Flumine — Betfair Trading
        </h2>
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Automated trading on the Betfair Exchange using the <strong>flumine</strong> framework.
          Configure strategies, backtest on historical data, or run live trading with real-time
          market streams.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Market</Label>
            <Select value={market} onValueChange={setMarket} options={MARKETS} />
          </div>

          <div className="space-y-1">
            <Label>Strategy Type</Label>
            <Select value={strategyType} onValueChange={setStrategyType} options={STRATEGY_TYPES} />
          </div>

          <div className="space-y-1">
            <Label>Execution Mode</Label>
            <Select value={execution} onValueChange={setExecution} options={EXECUTION_MODES} />
          </div>

          <div className="space-y-1">
            <Label>Max Bet Size (€)</Label>
            <Input
              type="number"
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Max Loss Limit (€)</Label>
          <Input
            type="number"
            value={maxLoss}
            onChange={(e) => setMaxLoss(e.target.value)}
          />
        </div>

        <div className="rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--sand)]/30 p-6 text-center">
          <p className="text-sm font-medium text-[var(--sea-ink-soft)]">
            ⏳ Bridge integration in progress
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]/70">
            The Python bridge to <code>flumine</code> is being built.
            Once connected, you'll be able to run backtests and live trading strategies.
          </p>
        </div>

        <Button disabled className="w-full">
          🚀 Start Strategy
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--sea-ink)]">How Flumine trading works</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--sea-ink-soft)]">
          <li>Connect to the Betfair Exchange API with your credentials</li>
          <li>Select a market and define your strategy (back, lay, or in-play trading)</li>
          <li>Set risk controls — max bet size, max loss limit, position sizing</li>
          <li>Run in simulated mode first to validate your strategy on historical data</li>
          <li>Switch to live mode to execute real trades with the Betfair Exchange</li>
        </ol>
      </Card>
    </div>
  )
}
