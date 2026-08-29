import { spawnLogged } from '#/server/dev-log'
import { readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type BridgeResult<T> = { ok: true; result: T } | { ok: false; error: string }

export type BridgeOptions = {
  pythonBin: string
  bridgeScript: string
  label: string
  timeout?: number
}

let tempDirPromise: Promise<string> | null = null

async function getTempDir(): Promise<string> {
  if (!tempDirPromise) {
    tempDirPromise = mkdtemp(join(tmpdir(), 'betfront-bridge-'))
  }
  return tempDirPromise
}

export async function runBridge<T>(
  payload: Record<string, unknown>,
  opts: BridgeOptions,
): Promise<T> {
  const { pythonBin, bridgeScript, label, timeout = 180_000 } = opts
  const tempDir = await getTempDir()
  const outputPath = join(tempDir, `${Date.now()}_${Math.random().toString(36).slice(2)}.json`)

  return new Promise((resolve, reject) => {
    const proc = spawnLogged(
      pythonBin,
      [bridgeScript, '--payload', JSON.stringify(payload), '--output', outputPath],
      {
        detached: true,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      },
    )

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      try {
        process.kill(-proc.pid!, 'SIGTERM')
      } catch { /* already exited */ }
      reject(new Error(`${label} request timed out after ${timeout}ms`))
    }, timeout)

    proc.on('close', async (code) => {
      clearTimeout(timer)
      if (code === null) {
        reject(new Error(stderr.trim() || `${label} bridge killed by signal`))
        return
      }
      try {
        const text = await readFile(outputPath, 'utf-8')
        const parsed = JSON.parse(text) as BridgeResult<T>
        await unlink(outputPath).catch(() => undefined)
        if (!parsed.ok || code !== 0) {
          reject(new Error((parsed as { ok: false; error: string }).error ?? (stderr.trim() || `${label} bridge failed`)))
          return
        }
        resolve(parsed.result as T)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`Failed to read ${label} response`))
      }
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

export async function runBridgeWithConcurrency<T>(
  items: Array<{ payload: Record<string, unknown>; key: string }>,
  opts: BridgeOptions,
  concurrency = 3,
): Promise<Map<string, { result?: T; error?: Error }>> {
  const results = new Map<string, { result?: T; error?: Error }>()
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      const item = items[i]
      try {
        const result = await runBridge<T>(item.payload, opts)
        results.set(item.key, { result })
      } catch (error) {
        results.set(item.key, { error: error instanceof Error ? error : new Error(String(error)) })
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export function resolveBridgePath(
  envVar: string,
  defaultRelPath: string,
): string {
  const fromEnv = process.env[envVar]
  if (fromEnv) return fromEnv
  return defaultRelPath
}
