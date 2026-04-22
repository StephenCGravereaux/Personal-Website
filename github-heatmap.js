(() => {
  const container = document.getElementById('gh-heatmap');
  if (!container) return;
  const username = container.dataset.user || 'StephenCGravereaux';
  const statusEl = container.querySelector('.gh-status');
  const summaryEl = container.querySelector('.gh-summary');
  const vizEl = container.querySelector('.gh-viz');

  const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`;

  fetch(url, { mode: 'cors' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(render)
    .catch(() => {
      if (statusEl) {
        statusEl.innerHTML = `GitHub activity temporarily unavailable. <a href="https://github.com/${username}" target="_blank" rel="noopener noreferrer">Visit profile &rarr;</a>`;
      }
    });

  function render(data) {
    const days = Array.isArray(data.contributions) ? data.contributions : [];
    if (!days.length) return;

    const first = new Date(days[0].date + 'T00:00:00');
    const firstWeekday = first.getDay();
    const weeks = [];
    let cur = [];
    for (let i = 0; i < firstWeekday; i++) cur.push(null);
    for (const d of days) {
      cur.push(d);
      if (cur.length === 7) { weeks.push(cur); cur = []; }
    }
    if (cur.length) {
      while (cur.length < 7) cur.push(null);
      weeks.push(cur);
    }

    const cell = 12;
    const gap = 3;
    const pad = 24;
    const svgW = pad + weeks.length * (cell + gap);
    const svgH = pad + 7 * (cell + gap);

    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((wk, wi) => {
      const firstReal = wk.find((x) => x);
      if (!firstReal) return;
      const m = new Date(firstReal.date + 'T00:00:00').getMonth();
      if (m !== lastMonth) {
        monthLabels.push({
          x: pad + wi * (cell + gap),
          label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]
        });
        lastMonth = m;
      }
    });

    const dayLabels = [
      { y: pad + 1 * (cell + gap) + cell - 2, label: 'Mon' },
      { y: pad + 3 * (cell + gap) + cell - 2, label: 'Wed' },
      { y: pad + 5 * (cell + gap) + cell - 2, label: 'Fri' }
    ];

    const cells = weeks.map((wk, wi) => wk.map((d, di) => {
      if (!d) return '';
      const x = pad + wi * (cell + gap);
      const y = pad + di * (cell + gap);
      const lvl = Math.max(0, Math.min(4, d.level ?? 0));
      const title = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" ry="2" class="gh-cell gh-level-${lvl}"><title>${title}</title></rect>`;
    }).join('')).join('');

    const monthText = monthLabels
      .map((m) => `<text x="${m.x}" y="${pad - 8}" class="gh-axis">${m.label}</text>`)
      .join('');

    const dayText = dayLabels
      .map((d) => `<text x="0" y="${d.y}" class="gh-axis">${d.label}</text>`)
      .join('');

    const svg = `<svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="GitHub contribution heatmap for the last year">${monthText}${dayText}${cells}</svg>`;
    vizEl.innerHTML = svg;

    const total = days.reduce((a, d) => a + d.count, 0);
    if (summaryEl) {
      summaryEl.innerHTML = `<strong>${total.toLocaleString()}</strong> contributions in the last year · <a href="https://github.com/${username}" target="_blank" rel="noopener noreferrer">@${username}</a>`;
    }
    if (statusEl) statusEl.remove();
  }
})();
