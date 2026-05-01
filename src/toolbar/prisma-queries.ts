import { defineToolbarApp } from 'astro/toolbar';

type QueryLog = {
  ts: number;
  query: string;
  params: string;
  durationMs: number;
};

export default defineToolbarApp({
  init(canvas, app) {
    const win = document.createElement('astro-dev-toolbar-window');
    win.style.cssText = 'min-width:560px;max-width:85vw;max-height:60vh;overflow:hidden;display:flex;flex-direction:column;padding:8px 12px;font:12px ui-monospace,Menlo,monospace;';
    win.innerHTML = `
      <header style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.3)">
        <strong style="font:600 13px ui-sans-serif,system-ui">Prisma queries</strong>
        <span data-count style="opacity:.7"></span>
        <button data-refresh style="margin-left:auto">Refresh</button>
        <button data-clear>Clear</button>
      </header>
      <div data-body style="margin:8px 0 0;flex:1;min-height:0;overflow:auto"></div>
    `;
    canvas.append(win);

    const body = win.querySelector('[data-body]') as HTMLDivElement;
    const count = win.querySelector('[data-count]') as HTMLSpanElement;
    const refreshBtn = win.querySelector('[data-refresh]') as HTMLButtonElement;
    const clearBtn = win.querySelector('[data-clear]') as HTMLButtonElement;

    let timer: number | null = null;

    async function refresh() {
      try {
        const res = await fetch('/api/dev-tools/prisma-log');
        const { logs } = (await res.json()) as { logs: QueryLog[] };
        count.textContent = `${logs.length} queries`;
        body.innerHTML =
          logs.length === 0
            ? '<em style="opacity:.7">(no queries recorded yet)</em>'
            : logs
                .slice(-100)
                .reverse()
                .map((l) => {
                  const t = new Date(l.ts).toISOString().slice(11, 23);
                  const dur =
                    l.durationMs > 50
                      ? `<strong style="color:#d97706">${l.durationMs}ms</strong>`
                      : `${l.durationMs}ms`;
                  return `<div style="padding:6px 0;border-bottom:1px dashed rgba(127,127,127,.2)">
                    <div style="opacity:.6;font-size:11px">${t} · ${dur}</div>
                    <code style="white-space:pre-wrap;word-break:break-word">${escapeHtml(l.query)}</code>
                    ${l.params && l.params !== '[]' ? `<div style="opacity:.7;margin-top:2px">params: ${escapeHtml(l.params)}</div>` : ''}
                  </div>`;
                })
                .join('');
      } catch (err) {
        body.textContent = `Error: ${(err as Error).message}`;
      }
    }

    refreshBtn.addEventListener('click', () => void refresh());
    clearBtn.addEventListener('click', async () => {
      await fetch('/api/dev-tools/prisma-log', { method: 'DELETE' });
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

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}
