import { defineToolbarApp } from 'astro/toolbar';

type Job = {
  id: number;
  command: string;
  sport: string;
  league: string | null;
  date: string | null;
  season: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

export default defineToolbarApp({
  init(canvas, app) {
    const win = document.createElement('astro-dev-toolbar-window');
    win.style.cssText = 'min-width:560px;max-width:85vw;max-height:60vh;overflow:hidden;display:flex;flex-direction:column;padding:8px 12px;font:12px ui-monospace,Menlo,monospace;';
    win.innerHTML = `
      <header style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(127,127,127,.3)">
        <strong style="font:600 13px ui-sans-serif,system-ui">Scrape jobs</strong>
        <span data-count style="opacity:.7"></span>
        <button data-refresh style="margin-left:auto">Refresh</button>
      </header>
      <div data-body style="margin:8px 0 0;flex:1;min-height:0;overflow:auto"></div>
    `;
    canvas.append(win);

    const body = win.querySelector('[data-body]') as HTMLDivElement;
    const count = win.querySelector('[data-count]') as HTMLSpanElement;
    const refreshBtn = win.querySelector('[data-refresh]') as HTMLButtonElement;

    let timer: number | null = null;

    async function refresh() {
      try {
        const res = await fetch('/api/dev-tools/scrape-jobs');
        const { jobs } = (await res.json()) as { jobs: Job[] };
        count.textContent = `${jobs.length} jobs`;
        body.innerHTML =
          jobs.length === 0
            ? '<em style="opacity:.7">(no scrape jobs in db yet)</em>'
            : `<table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="text-align:left;opacity:.7"><th>id</th><th>cmd</th><th>sport</th><th>scope</th><th>status</th><th>started</th></tr>
                </thead>
                <tbody>
                  ${jobs
                    .map((j) => {
                      const scope = j.league || j.season || j.date || '—';
                      const color =
                        j.status === 'success'
                          ? '#16a34a'
                          : j.status === 'failed'
                            ? '#dc2626'
                            : j.status === 'running'
                              ? '#2563eb'
                              : 'inherit';
                      return `<tr style="border-top:1px solid rgba(127,127,127,.15)">
                        <td>${j.id}</td>
                        <td>${escapeHtml(j.command)}</td>
                        <td>${escapeHtml(j.sport)}</td>
                        <td>${escapeHtml(scope)}</td>
                        <td style="color:${color}">${j.status}</td>
                        <td>${new Date(j.startedAt).toLocaleString()}</td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>`;
      } catch (err) {
        body.textContent = `Error: ${(err as Error).message}`;
      }
    }

    refreshBtn.addEventListener('click', () => void refresh());

    app.onToggled(({ state }) => {
      if (state) {
        void refresh();
        timer = window.setInterval(refresh, 5000);
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
