(() => {
  const input = document.getElementById('keystroke-input');
  if (!input) return;

  const dwellCanvas = document.getElementById('keystroke-dwell');
  const flightCanvas = document.getElementById('keystroke-flight');
  const statsEl = document.getElementById('keystroke-stats');
  const scoreEl = document.getElementById('keystroke-score');
  const scoreLabel = document.getElementById('keystroke-score-label');
  const resetBtn = document.getElementById('keystroke-reset');

  const pressed = new Map();
  let lastUp = null;
  const dwells = [];
  const flights = [];
  const dpr = window.devicePixelRatio || 1;

  const fontFamily = getComputedStyle(document.body).fontFamily;

  function sizeCanvas(c) {
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    return Math.sqrt(v);
  }

  function drawBars(canvas, data, color, emptyLabel) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 10 * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(pad, canvas.height - pad);
    ctx.lineTo(canvas.width - pad, canvas.height - pad);
    ctx.stroke();

    if (!data.length) {
      ctx.fillStyle = 'rgba(192,192,192,0.6)';
      ctx.font = `${12 * dpr}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emptyLabel, canvas.width / 2, canvas.height / 2);
      return;
    }

    const slice = data.slice(-48);
    const max = Math.max(...slice, 80) * 1.1;
    const n = slice.length;
    const w = (canvas.width - pad * 2) / n;
    const h = canvas.height - pad * 2;

    ctx.fillStyle = color;
    slice.forEach((v, i) => {
      const bh = Math.max(2 * dpr, (v / max) * h);
      const x = pad + i * w + dpr;
      const y = canvas.height - pad - bh;
      ctx.fillRect(x, y, Math.max(2, w - 2 * dpr), bh);
    });

    const med = median(slice);
    const medY = canvas.height - pad - (med / max) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(pad, medY);
    ctx.lineTo(canvas.width - pad, medY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(237,237,237,0.85)';
    ctx.font = `${11 * dpr}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`median ${med.toFixed(0)} ms`, pad + 4 * dpr, medY - 8 * dpr);
  }

  function update() {
    const dMed = median(dwells);
    const fMed = median(flights);
    const dStd = stddev(dwells);
    const fStd = stddev(flights);

    statsEl.innerHTML = `
      <div><span>Keys captured</span><strong>${dwells.length}</strong></div>
      <div><span>Dwell median</span><strong>${dMed.toFixed(0)} ms</strong></div>
      <div><span>Flight median</span><strong>${fMed.toFixed(0)} ms</strong></div>
      <div><span>Dwell &sigma;</span><strong>${dStd.toFixed(0)} ms</strong></div>
      <div><span>Flight &sigma;</span><strong>${fStd.toFixed(0)} ms</strong></div>
    `;

    const samples = Math.min(1, dwells.length / 40);
    const variance = Math.min(1, (dStd + fStd) / 220);
    const score = Math.round(samples * 65 + variance * 35);
    scoreEl.textContent = dwells.length < 6 ? '—' : String(score);
    if (dwells.length < 6) {
      scoreLabel.textContent = 'Keep typing — baseline forming';
      scoreEl.style.color = 'var(--muted)';
    } else if (score >= 65) {
      scoreLabel.textContent = 'Strongly identifiable signature';
      scoreEl.style.color = 'var(--prism-pink)';
    } else if (score >= 35) {
      scoreLabel.textContent = 'Partially identifiable pattern';
      scoreEl.style.color = 'var(--prism-purple)';
    } else {
      scoreLabel.textContent = 'Low distinctiveness so far';
      scoreEl.style.color = 'var(--prism-blue)';
    }

    drawBars(dwellCanvas, dwells, 'rgba(0, 240, 255, 0.78)', 'Dwell time will appear as you type');
    drawBars(flightCanvas, flights, 'rgba(255, 0, 127, 0.78)', 'Flight time will appear as you type');
  }

  function reset() {
    pressed.clear();
    lastUp = null;
    dwells.length = 0;
    flights.length = 0;
    input.value = '';
    update();
    input.focus();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return;
    if (!pressed.has(e.code)) pressed.set(e.code, performance.now());
  });

  input.addEventListener('keyup', (e) => {
    const down = pressed.get(e.code);
    if (down == null) return;
    const now = performance.now();
    const dwell = now - down;
    if (dwell > 5 && dwell < 1500) dwells.push(dwell);
    if (lastUp != null) {
      const flight = down - lastUp;
      if (flight > 0 && flight < 2500) flights.push(flight);
    }
    lastUp = now;
    pressed.delete(e.code);
    update();
  });

  if (resetBtn) resetBtn.addEventListener('click', reset);

  const setup = () => {
    sizeCanvas(dwellCanvas);
    sizeCanvas(flightCanvas);
    update();
  };

  requestAnimationFrame(setup);
  window.addEventListener('resize', () => {
    clearTimeout(setup._t);
    setup._t = setTimeout(setup, 120);
  });
})();
