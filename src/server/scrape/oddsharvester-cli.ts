// OddsHarvester CLI invocation: arg builders + subprocess runners.
// Maintains a process registry so jobs can be cancelled.

import path from 'node:path'

import { spawnLogged as spawn } from '#/server/dev-log'
import { prisma } from '#/db'

import type { HistoricParams, UpcomingParams } from './types'

export const ODDSHARVESTER_BIN = path.resolve(
  `${import.meta.dirname}/../../../../OddsHarvester/.venv/bin/oddsharvester`,
)

// Track running child processes so we can kill them on cancel
export const runningProcesses = new Map<number, ReturnType<typeof spawn>>()

export function buildUpcomingArgs(params: UpcomingParams, outputPath: string): string[] {
  const args: string[] = ['upcoming', '-s', params.sport]
  if (params.date) args.push('-d', params.date)
  if (params.league) args.push('-l', params.league)
  if (params.markets) args.push('-m', params.markets)
  if (params.headless) args.push('--headless')
  if (params.concurrency !== 3) args.push('-c', String(params.concurrency))
  if (params.requestDelay !== 1) args.push('--request-delay', String(params.requestDelay))
  if (params.previewOnly) args.push('--preview-only')
  if (params.bookiesFilter !== 'all') args.push('--bookies-filter', params.bookiesFilter)
  if (params.oddsFormat !== 'Decimal Odds') args.push('--odds-format', params.oddsFormat)
  if (params.oddsHistory) args.push('--odds-history')
  if (params.proxyUrl) {
    args.push('--proxy-url', params.proxyUrl)
    if (params.proxyUser) args.push('--proxy-user', params.proxyUser)
    if (params.proxyPass) args.push('--proxy-pass', params.proxyPass)
  }
  if (params.browserUserAgent) args.push('--user-agent', params.browserUserAgent)
  if (params.locale) args.push('--locale', params.locale)
  if (params.timezone) args.push('--timezone', params.timezone)
  if (params.period) args.push('--period', params.period)
  if (params.targetBookmaker) args.push('--target-bookmaker', params.targetBookmaker)
  if (params.matchLinks) {
    for (const link of params.matchLinks) args.push('--match-link', link)
  }
  args.push('-f', params.outputFormat, '-o', outputPath)
  return args
}

export function buildHistoricArgs(params: HistoricParams, outputPath: string): string[] {
  const args: string[] = ['historic', '-s', params.sport, '--season', params.season]
  if (params.league) args.push('-l', params.league)
  if (params.markets) args.push('-m', params.markets)
  if (params.maxPages) args.push('--max-pages', String(params.maxPages))
  if (params.headless) args.push('--headless')
  if (params.concurrency !== 3) args.push('-c', String(params.concurrency))
  if (params.requestDelay !== 1) args.push('--request-delay', String(params.requestDelay))
  if (params.previewOnly) args.push('--preview-only')
  if (params.bookiesFilter !== 'all') args.push('--bookies-filter', params.bookiesFilter)
  if (params.oddsFormat !== 'Decimal Odds') args.push('--odds-format', params.oddsFormat)
  if (params.oddsHistory) args.push('--odds-history')
  if (params.proxyUrl) {
    args.push('--proxy-url', params.proxyUrl)
    if (params.proxyUser) args.push('--proxy-user', params.proxyUser)
    if (params.proxyPass) args.push('--proxy-pass', params.proxyPass)
  }
  if (params.browserUserAgent) args.push('--user-agent', params.browserUserAgent)
  if (params.locale) args.push('--locale', params.locale)
  if (params.timezone) args.push('--timezone', params.timezone)
  if (params.period) args.push('--period', params.period)
  if (params.targetBookmaker) args.push('--target-bookmaker', params.targetBookmaker)
  if (params.matchLinks) {
    for (const link of params.matchLinks) args.push('--match-link', link)
  }
  args.push('-f', params.outputFormat, '-o', outputPath)
  return args
}

export async function runCli(args: string[], jobId: number): Promise<{ output: string; success: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(ODDSHARVESTER_BIN, args, {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })

    runningProcesses.set(jobId, proc)

    let output = ''
    let flushedLen = 0

    // Flush accumulated output to DB every 2s so clients can stream it in real-time
    const flushInterval = setInterval(async () => {
      if (output.length > flushedLen) {
        flushedLen = output.length
        // Store last 300KB so recent errors are always visible
        const slice = output.length > 300000 ? output.slice(output.length - 300000) : output
        await prisma.scrapeJob
          .update({ where: { id: jobId }, data: { output: slice } })
          .catch(() => {})
      }
    }, 2000)

    proc.stdout.on('data', (d: Buffer) => {
      output += d.toString()
    })
    proc.stderr.on('data', (d: Buffer) => {
      output += d.toString()
    })

    proc.on('close', async (code) => {
      clearInterval(flushInterval)
      runningProcesses.delete(jobId)
      const success = code === 0
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          status: success ? 'success' : 'failed',
          output: output.length > 300000 ? output.slice(output.length - 300000) : output,
          finishedAt: new Date(),
        },
      })
      resolve({ output, success })
    })
  })
}

// Lightweight CLI runner (no DB writes) — used for extra-period sweeps.
export async function runCliSimple(args: string[]): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(ODDSHARVESTER_BIN, args, {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })
    proc.on('close', (code) => resolve({ success: code === 0 }))
  })
}

export function parseProgress(output: string | null): { pct: number | null; done: number; total: number } {
  if (!output) return { pct: null, done: 0, total: 0 }
  const totalMatch = output.match(/Starting to scrape odds for (\d+) match links/)
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0
  const done = (output.match(/Successfully scraped match link:/g) ?? []).length
  const pct = total > 0 ? Math.round((done / total) * 100) : null
  return { pct, done, total }
}
