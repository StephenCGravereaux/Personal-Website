(() => {
  const canvas = document.getElementById('skills-bubble');
  if (!canvas) return;
  const tooltip = document.getElementById('skills-tooltip');
  const legend = document.getElementById('skills-legend');
  const hint = document.getElementById('skills-hint');

  // The tooltip uses position:fixed, but its current ancestor (.reveal section)
  // applies a CSS transform — which creates a containing block and breaks
  // viewport-relative positioning. Reparent it to <body> so clientX/Y math is
  // correct again.
  if (tooltip && tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip);
  }
  const reduceMotion = document.documentElement.classList.contains('reduce-motion');

  const categories = {
    systems:    { label: 'Systems',         color: '#00f0ff' },
    network:    { label: 'Network & Voice', color: '#8a2be2' },
    security:   { label: 'Security',        color: '#ff007f' },
    ai:         { label: 'AI & Data',       color: '#2ee5d1' },
    tools:      { label: 'Tools & Code',    color: '#39ff14' },
    leadership: { label: 'Leadership',      color: '#ffb347' }
  };
  const catKeys = Object.keys(categories);

  const skills = [
    { name: 'Systems Admin',        cat: 'systems',    weight: 10 },
    { name: 'Active Directory',     cat: 'systems',    weight: 9 },
    { name: 'VMware vSphere',       cat: 'systems',    weight: 9 },
    { name: 'Windows Server',       cat: 'systems',    weight: 8 },
    { name: 'Linux Server',         cat: 'systems',    weight: 7 },
    { name: 'Virtualization',       cat: 'systems',    weight: 8 },
    { name: 'Network Infra',        cat: 'network',    weight: 9 },
    { name: 'Routers & Switches',   cat: 'network',    weight: 7 },
    { name: 'VoIP',                 cat: 'network',    weight: 8 },
    { name: 'Cisco CUCM',           cat: 'network',    weight: 7 },
    { name: 'Cybersecurity',        cat: 'security',   weight: 9 },
    { name: 'Security+',            cat: 'security',   weight: 8 },
    { name: 'Network+',             cat: 'security',   weight: 7 },
    { name: 'Machine Learning',     cat: 'ai',         weight: 8 },
    { name: 'Deep Learning',        cat: 'ai',         weight: 7 },
    { name: 'Generative AI',        cat: 'ai',         weight: 8 },
    { name: 'LLM Fine-Tuning',      cat: 'ai',         weight: 7 },
    { name: 'Data Analytics',       cat: 'ai',         weight: 7 },
    { name: 'RAG',                  cat: 'ai',         weight: 8 },
    { name: 'Prompt Engineering',   cat: 'ai',         weight: 7 },
    { name: 'PyTorch',              cat: 'ai',         weight: 6 },
    { name: 'Troubleshooting',      cat: 'tools',      weight: 8 },
    { name: 'Python',               cat: 'tools',      weight: 7 },
    { name: 'HTML / CSS',           cat: 'tools',      weight: 5 },
    { name: 'Help Desk',            cat: 'leadership', weight: 7 },
    { name: 'Mentorship',           cat: 'leadership', weight: 7 },
    { name: 'Technical Training',   cat: 'leadership', weight: 7 },
    { name: 'Client Comms',         cat: 'leadership', weight: 6 },
    { name: 'Problem Solving',      cat: 'leadership', weight: 8 }
  ];

  // Screen-reader accessible copy of the full skill set (canvas itself is pointer-only).
  const host = canvas.parentElement;
  if (host && !host.querySelector('.skills-sr-list')) {
    const srList = document.createElement('ul');
    srList.className = 'skills-sr-list visually-hidden';
    srList.setAttribute('aria-label', 'Skills list');
    const byCat = {};
    skills.forEach((s) => { (byCat[s.cat] = byCat[s.cat] || []).push(s.name); });
    catKeys.forEach((k) => {
      const group = document.createElement('li');
      group.textContent = `${categories[k].label}: ${(byCat[k] || []).join(', ')}.`;
      srList.appendChild(group);
    });
    host.appendChild(srList);
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let width = 0, height = 0;
  let radiusScale = 1;
  const fontFamily = getComputedStyle(document.body).fontFamily;

  const nodes = skills.map((s) => ({
    ...s,
    radius: 0,
    x: 0, y: 0, vx: 0, vy: 0
  }));

  // Desktop baseline: radius = 18 + weight*4 (yields 38–58 for weights 5–10).
  // Narrow viewports shrink uniformly so 29 bubbles still fit without overlap.
  function recomputeRadii() {
    if (width < 380) radiusScale = 0.55;
    else if (width < 480) radiusScale = 0.65;
    else if (width < 620) radiusScale = 0.78;
    else if (width < 760) radiusScale = 0.9;
    else radiusScale = 1;
    nodes.forEach((n) => {
      n.radius = (18 + n.weight * 4) * radiusScale;
    });
  }

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    recomputeRadii();
  }

  function catCenter(cat) {
    const idx = catKeys.indexOf(cat);
    const total = catKeys.length;
    const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
    const spread = width < 500 ? 0.34 : 0.27;
    const rx = width * spread;
    const ry = height * (width < 500 ? 0.34 : 0.30);
    return {
      x: width / 2 + Math.cos(angle) * rx,
      y: height / 2 + Math.sin(angle) * ry
    };
  }

  function placeInitial() {
    nodes.forEach((n) => {
      const c = catCenter(n.cat);
      n.x = c.x + (Math.random() - 0.5) * 50;
      n.y = c.y + (Math.random() - 0.5) * 50;
      n.vx = 0; n.vy = 0;
    });
  }

  sizeCanvas();
  placeInitial();
  window.addEventListener('resize', () => {
    sizeCanvas();
    placeInitial();
    wake();
  });

  let dragNode = null;
  let hoverNode = null;
  let activeCategory = null;
  let mouseX = 0, mouseY = 0;
  let running = true;
  let restFrames = 0;

  function wake() {
    restFrames = 0;
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  }

  function step() {
    for (const n of nodes) {
      if (n === dragNode) continue;
      const c = catCenter(n.cat);
      n.vx += (c.x - n.x) * 0.0042;
      n.vy += (c.y - n.y) * 0.0042;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minDist = a.radius + b.radius + 5;
        if (dist < minDist * 1.35) {
          const strength = (minDist * 1.35 - dist) / (minDist * 1.35);
          const fx = (dx / dist) * strength * 1.5;
          const fy = (dy / dist) * strength * 1.5;
          if (a !== dragNode) { a.vx -= fx; a.vy -= fy; }
          if (b !== dragNode) { b.vx += fx; b.vy += fy; }
        }
      }
    }

    let ke = 0;
    for (const n of nodes) {
      if (n === dragNode) {
        n.x = mouseX; n.y = mouseY;
        n.vx = 0; n.vy = 0;
        continue;
      }
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x += n.vx;
      n.y += n.vy;
      ke += n.vx * n.vx + n.vy * n.vy;

      if (n.x < n.radius) { n.x = n.radius; n.vx = Math.abs(n.vx) * 0.3; }
      if (n.x > width - n.radius) { n.x = width - n.radius; n.vx = -Math.abs(n.vx) * 0.3; }
      if (n.y < n.radius) { n.y = n.radius; n.vy = Math.abs(n.vy) * 0.3; }
      if (n.y > height - n.radius) { n.y = height - n.radius; n.vy = -Math.abs(n.vy) * 0.3; }
    }
    return ke;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    for (const n of nodes) {
      const cat = categories[n.cat];
      const isHover = n === hoverNode;
      const dim = activeCategory && activeCategory !== n.cat ? 0.18 : 1;

      ctx.save();
      ctx.globalAlpha = dim;
      ctx.shadowColor = cat.color;
      ctx.shadowBlur = isHover ? 28 : 14;
      ctx.fillStyle = cat.color + (isHover ? 'cc' : '55');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = dim;
      ctx.strokeStyle = cat.color;
      ctx.lineWidth = isHover ? 2.2 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#ededed';
      const fs = Math.max(10, Math.min(13, n.radius / 3.2));
      ctx.font = `600 ${fs}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const words = n.name.split(' ');
      if (words.length === 1 || n.name.length <= 9) {
        ctx.fillText(n.name, n.x, n.y);
      } else {
        const line1 = words[0];
        const line2 = words.slice(1).join(' ');
        ctx.fillText(line1, n.x, n.y - fs * 0.55);
        ctx.fillText(line2, n.x, n.y + fs * 0.55);
      }
      ctx.restore();
    }
  }

  const REST_KE = 0.02;
  const REST_FRAMES = 60;

  function loop() {
    if (!running) return;
    const ke = step();
    draw();
    if (!dragNode && !hoverNode && ke < REST_KE) {
      restFrames++;
      if (restFrames > REST_FRAMES) { running = false; return; }
    } else {
      restFrames = 0;
    }
    requestAnimationFrame(loop);
  }

  function findAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(x - n.x, y - n.y) <= n.radius) return n;
    }
    return null;
  }

  function localPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = localPos(e);
    mouseX = p.x; mouseY = p.y;
    const n = findAt(p.x, p.y);
    hoverNode = n;
    canvas.style.cursor = n ? (dragNode ? 'grabbing' : 'grab') : 'default';
    if (hint) hint.style.opacity = n ? '0' : '1';
    if (tooltip) {
      if (n) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.innerHTML = `<strong>${n.name}</strong><span>${categories[n.cat].label}</span>`;
      } else {
        tooltip.style.display = 'none';
      }
    }
    wake();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = localPos(e);
    const n = findAt(p.x, p.y);
    if (n) {
      dragNode = n;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      wake();
    }
  });

  const release = () => {
    dragNode = null;
    canvas.style.cursor = hoverNode ? 'grab' : 'default';
    wake();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hoverNode = null;
    if (tooltip) tooltip.style.display = 'none';
    if (hint) hint.style.opacity = '1';
  });

  if (legend) {
    Object.entries(categories).forEach(([k, v]) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'skills-legend-item';
      item.dataset.cat = k;
      item.innerHTML = `<span class="skills-legend-swatch" style="background:${v.color}"></span>${v.label}`;
      item.addEventListener('click', () => {
        activeCategory = activeCategory === k ? null : k;
        legend.querySelectorAll('.skills-legend-item').forEach((el) => {
          el.classList.toggle('is-active', el.dataset.cat === activeCategory);
        });
        wake();
      });
      legend.appendChild(item);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else {
      wake();
    }
  });

  loop();
})();
