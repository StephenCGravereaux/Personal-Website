(() => {
  const input = document.getElementById('keystroke-input');
  if (!input) return;

  const dwellCanvas = document.getElementById('keystroke-dwell');
  const flightCanvas = document.getElementById('keystroke-flight');
  const statsEl = document.getElementById('keystroke-stats');
  const scoreEl = document.getElementById('keystroke-score');
  const scoreLabel = document.getElementById('keystroke-score-label');
  const resetBtn = document.getElementById('keystroke-reset');

  // DP demo elements (optional — only present on the smartwatch project page)
  const dpDwellCanvas = document.getElementById('dp-dwell');
  const dpFlightCanvas = document.getElementById('dp-flight');
  const dpEpsInput = document.getElementById('dp-epsilon');
  const dpEpsValueEl = document.getElementById('dp-epsilon-value');
  const dpScaleEl = document.getElementById('dp-scale-value');
  const dpEpsInline = document.getElementById('dp-eps-inline');
  const dpCleanScoreEl = document.getElementById('dp-clean-score');
  const dpNoisyScoreEl = document.getElementById('dp-noisy-score');
  const dpNoisySubEl = document.getElementById('dp-noisy-sub');
  const hasDp = !!(dpDwellCanvas && dpFlightCanvas && dpEpsInput);

  const pressed = new Map();
  let lastUp = null;
  const dwells = [];
  const flights = [];
  const dpr = window.devicePixelRatio || 1;

  // Map slider index -> epsilon. Index 5 = off (no noise).
  const EPS_TABLE = [0.05, 0.1, 0.5, 1.0, 2.0, Infinity];
  const epsFromSlider = () => EPS_TABLE[Math.max(0, Math.min(5, parseInt(dpEpsInput.value, 10) || 0))];

  // Population-typical ranges used to derive Laplace scale b = range / eps.
  // Matches "feature-level Laplace with per-feature clipping bounds" from the paper.
  const DWELL_RANGE = 250;   // ms
  const FLIGHT_RANGE = 400;  // ms

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

  // Inverse-CDF Laplace sample with scale b (mean 0).
  function laplace(b) {
    if (!isFinite(b) || b <= 0) return 0;
    const u = Math.random() - 0.5;
    return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  function noisify(arr, b) {
    if (!isFinite(b) || b <= 0) return arr.slice();
    return arr.map((v) => Math.max(0, v + laplace(b)));
  }

  function drawBars(canvas, data, color, emptyLabel, opts = {}) {
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
    const ceiling = opts.ceiling || Math.max(...slice, 80) * 1.1;
    const max = Math.max(ceiling, 1);
    const n = slice.length;
    const w = (canvas.width - pad * 2) / n;
    const h = canvas.height - pad * 2;

    ctx.fillStyle = color;
    slice.forEach((v, i) => {
      const clipped = Math.min(v, max);
      const bh = Math.max(2 * dpr, (clipped / max) * h);
      const x = pad + i * w + dpr;
      const y = canvas.height - pad - bh;
      ctx.fillRect(x, y, Math.max(2, w - 2 * dpr), bh);
    });

    const med = median(slice);
    const medY = canvas.height - pad - (Math.min(med, max) / max) * h;
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

  function updateClean() {
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

  // Identifiability: how distinguishable a typing signature is from a population baseline,
  // attenuated by the Laplace noise that the DP defense adds. 50 = chance, 100 = perfectly identifiable.
  function identifiability(arr, baseline, b) {
    if (arr.length < 2) return 50;
    const med = median(arr);
    const std = stddev(arr);
    const signal = Math.abs(med - baseline) + std * 0.6; // contribution from rhythm distinctiveness
    if (!isFinite(b) || b <= 0) {
      return 50 + 50 * (signal / (signal + 25)); // clean ceiling shaped by sample size implicitly
    }
    // Laplace std is sqrt(2)*b; averaging over n samples shrinks median noise by ~1/sqrt(n).
    const noiseStd = (Math.SQRT2 * b) / Math.max(1, Math.sqrt(arr.length));
    return 50 + 50 * (signal / (signal + noiseStd));
  }

  function noisyScoreLabel(score) {
    if (score >= 78) return 'Attacker still recovers the signature';
    if (score >= 62) return 'Some leakage remains';
    if (score >= 54) return 'Mostly noise — attacker degraded';
    return 'Indistinguishable from chance';
  }

  function noisyScoreColor(score) {
    if (score >= 78) return 'var(--prism-pink)';
    if (score >= 62) return 'var(--prism-purple)';
    if (score >= 54) return 'var(--prism-blue)';
    return '#6dffb0';
  }

  function updateDp() {
    if (!hasDp) return;
    const eps = epsFromSlider();
    const isOff = !isFinite(eps);
    const bDwell = isOff ? 0 : DWELL_RANGE / eps;
    const bFlight = isOff ? 0 : FLIGHT_RANGE / eps;

    dpEpsValueEl.textContent = isOff ? 'ε = ∞ (no defense)' : `ε = ${eps}`;
    if (dpEpsInline) dpEpsInline.textContent = isOff ? '∞' : String(eps);
    dpScaleEl.textContent = isOff
      ? 'Laplace scale: 0 ms (no noise added)'
      : `Laplace scale: dwell b ≈ ${bDwell.toFixed(0)} ms · flight b ≈ ${bFlight.toFixed(0)} ms`;

    const noisyDwells = noisify(dwells, bDwell);
    const noisyFlights = noisify(flights, bFlight);

    // Match y-axis ceilings between clean and noisy charts so the visual comparison is fair.
    const dCeiling = Math.max(80, Math.max(...dwells, 0) * 1.1, Math.max(...noisyDwells, 0) * 1.1);
    const fCeiling = Math.max(80, Math.max(...flights, 0) * 1.1, Math.max(...noisyFlights, 0) * 1.1);

    drawBars(dpDwellCanvas, noisyDwells, 'rgba(255, 165, 0, 0.78)', 'Type to see DP-noised dwell', { ceiling: dCeiling });
    drawBars(dpFlightCanvas, noisyFlights, 'rgba(255, 165, 0, 0.78)', 'Type to see DP-noised flight', { ceiling: fCeiling });

    const cleanScore = Math.round(identifiability(dwells, 100, 0) * 0.5 + identifiability(flights, 150, 0) * 0.5);
    const noisyScore = Math.round(identifiability(dwells, 100, bDwell) * 0.5 + identifiability(flights, 150, bFlight) * 0.5);

    if (dwells.length < 6) {
      dpCleanScoreEl.textContent = '—';
      dpNoisyScoreEl.textContent = '—';
      dpNoisySubEl.textContent = 'Type at least six keys to compare';
      dpCleanScoreEl.style.color = 'var(--muted)';
      dpNoisyScoreEl.style.color = 'var(--muted)';
      return;
    }

    dpCleanScoreEl.textContent = cleanScore + '%';
    dpCleanScoreEl.style.color = 'var(--prism-pink)';
    dpNoisyScoreEl.textContent = noisyScore + '%';
    dpNoisyScoreEl.style.color = noisyScoreColor(noisyScore);
    dpNoisySubEl.textContent = isOff ? 'No defense applied' : noisyScoreLabel(noisyScore);
  }

  function update() {
    updateClean();
    updateDp();
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
  if (hasDp) dpEpsInput.addEventListener('input', updateDp);

  const setup = () => {
    sizeCanvas(dwellCanvas);
    sizeCanvas(flightCanvas);
    if (hasDp) {
      sizeCanvas(dpDwellCanvas);
      sizeCanvas(dpFlightCanvas);
    }
    update();
  };

  requestAnimationFrame(setup);
  window.addEventListener('resize', () => {
    clearTimeout(setup._t);
    setup._t = setTimeout(setup, 120);
  });
})();
