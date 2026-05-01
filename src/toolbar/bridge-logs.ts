import { defineToolbarApp } from 'astro/toolbar';

type BridgeLog = {
  ts: number;
  pid: number;
  cmd: string;
  stream: 'stdout' | 'stderr' | 'meta';
  text: string;
};

export default defineToolbarApp({
  init(canvas, app) {
    const win = document.createElement('astro-dev-toolbar-window');
    win.style.cssText = 'min-width:520px;max-width:80vw;max-height:60vh;overflow:hidden;display:flex;flex-direction:column;padding:8px 12px;font:12px ui-monospace,Menlo,monospace;';
    win.innerHTML = `
      <header style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.3)">
        <strong style="font:600 13px ui-sans-serif,system-ui">Bridge logs</strong>
        <span data-count style="opacity:.7"></span>
        <button data-refresh style="margin-left:auto">Refresh</button>
        <button data-clear>Clear</button>
      </header>
      <pre data-body style="margin:8px 0 0;flex:1;min-height:0;overflow:auto;white-space:pre-wrap;word-break:break-word">Loading…</pre>
    `;
    canvas.append(win);

    const body = win.querySelector('[data-body]') as HTMLPreElement;
    const count = win.querySelector('[data-count]') as HTMLSpanElement;
    const refreshBtn = win.querySelector('[data-refresh]') as HTMLButtonElement;
    const clearBtn = win.querySelector('[data-clear]') as HTMLButtonElement;

    let timer: number | null = null;

    async function refresh() {
      try {
        const res = await fetch('/api/dev-tools/bridge-logs');
        const { logs } = (await res.json()) as { logs: BridgeLog[] };
        count.textContent = `${logs.length} entries`;
        body.textContent =
          logs.length === 0
            ? '(no bridge activity yet — run a scrape, predict, or soccerdata fetch)'
            : logs
                .slice(-200)
                .map((l) => {
                  const t = new Date(l.ts).toISOString().slice(11, 23);
                  const tag = l.stream === 'stderr' ? '!' : l.stream === 'meta' ? '·' : '>';
                  return `[${t}] ${tag} pid=${l.pid} ${l.cmd}\n    ${l.text.replace(/\n/g, '\n    ').trimEnd()}`;
                })
                .join('\n');
        body.scrollTop = body.scrollHeight;
      } catch (err) {
        body.textContent = `Error: ${(err as Error).message}`;
      }
    }

    refreshBtn.addEventListener('click', () => void refresh());
    clearBtn.addEventListener('click', async () => {
      await fetch('/api/dev-tools/bridge-logs', { method: 'DELETE' });
      void refresh();
    });

    app.onToggled(({ state }) => {
      if (state) {
        void refresh();
        timer = window.setInterval(refresh, 2000);
      } else if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    });
  },
});
