/**
 * Dev-only logging utilities. Three ring buffers exposed through small
 * accessors that the Astro Dev Toolbar apps read via internal API routes.
 *
 * In production builds these helpers are still imported but the buffers stay
 * empty (we gate appending on `import.meta.env.DEV`).
 */
import {
  spawn as nodeSpawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';

const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

type BridgeLog = {
  ts: number;
  pid: number;
  cmd: string;
  stream: 'stdout' | 'stderr' | 'meta';
  text: string;
};

type QueryLog = {
  ts: number;
  query: string;
  params: string;
  durationMs: number;
};

const BRIDGE_CAP = 500;
const QUERY_CAP = 200;

const bridgeBuf: BridgeLog[] = [];
const queryBuf: QueryLog[] = [];

function pushBridge(entry: BridgeLog) {
  if (!isDev) return;
  bridgeBuf.push(entry);
  if (bridgeBuf.length > BRIDGE_CAP) bridgeBuf.splice(0, bridgeBuf.length - BRIDGE_CAP);
}

export function pushQuery(entry: QueryLog) {
  if (!isDev) return;
  queryBuf.push(entry);
  if (queryBuf.length > QUERY_CAP) queryBuf.splice(0, queryBuf.length - QUERY_CAP);
}

export function getBridgeLogs() {
  return bridgeBuf.slice();
}

export function getQueryLogs() {
  return queryBuf.slice();
}

export function clearBridgeLogs() {
  bridgeBuf.length = 0;
}

export function clearQueryLogs() {
  queryBuf.length = 0;
}

/**
 * Drop-in replacement for `child_process.spawn` that tees stdout/stderr into
 * the bridge log buffer. In production it just delegates without recording.
 */
export function spawnLogged(
  command: string,
  args: ReadonlyArray<string> = [],
  options?: SpawnOptionsWithoutStdio,
): ChildProcessWithoutNullStreams {
  const proc = nodeSpawn(command, args as string[], options) as ChildProcessWithoutNullStreams;
  if (!isDev) return proc;

  const cmd = `${command} ${(args ?? []).slice(0, 3).join(' ')}`.slice(0, 200);
  const pid = proc.pid ?? 0;
  pushBridge({ ts: Date.now(), pid, cmd, stream: 'meta', text: 'spawn' });

  proc.stdout?.on('data', (chunk: Buffer | string) => {
    pushBridge({
      ts: Date.now(),
      pid,
      cmd,
      stream: 'stdout',
      text: typeof chunk === 'string' ? chunk : chunk.toString('utf8'),
    });
  });
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    pushBridge({
      ts: Date.now(),
      pid,
      cmd,
      stream: 'stderr',
      text: typeof chunk === 'string' ? chunk : chunk.toString('utf8'),
    });
  });
  proc.on('exit', (code, signal) => {
    pushBridge({
      ts: Date.now(),
      pid,
      cmd,
      stream: 'meta',
      text: `exit code=${code ?? '∅'} signal=${signal ?? '∅'}`,
    });
  });
  return proc;
}
