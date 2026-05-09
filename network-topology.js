(() => {
  const svg = document.getElementById('net-topology');
  if (!svg) return;
  const wrap = svg.closest('.net-topology-wrap');
  const tooltip = wrap && wrap.querySelector('.net-tooltip');
  const nodes = svg.querySelectorAll('[data-net-title]');
  const fxLayer = svg.querySelector('.net-sim-fx');
  const readoutState = wrap && wrap.querySelector('.net-sim-state');
  const readoutDetail = wrap && wrap.querySelector('.net-sim-detail');
  const postmortem = wrap && wrap.querySelector('.net-sim-postmortem');
  const postmortemTitle = postmortem && postmortem.querySelector('.net-sim-postmortem-title');
  const postmortemList = postmortem && postmortem.querySelector('.net-sim-postmortem-list');
  const controls = document.querySelectorAll('[data-net-scenario]');

  const POSTMORTEM = {
    ingress: {
      title: 'Why the perimeter held',
      bullets: [
        ['Edge ACL', 'denied TCP/445 (SMB) from an untrusted source — internet hosts have no business reaching internal file shares.'],
        ['Blast radius', 'the packet never crossed into the core, so AD, VMware, and CUCM never saw the probe.'],
      ],
    },
    auth: {
      title: 'Why the account locked',
      bullets: [
        ['Lockout GPO', 'fired after 5 failed NTLM binds — the DC stops accepting attempts on that user.'],
        ['Containment', 'the endpoint stays online, but cannot keep brute-forcing without administrator review and reset.'],
      ],
    },
    vlan: {
      title: 'Why the lateral move failed',
      bullets: [
        ['Inter-VLAN ACL', 'on the core switch denied VLAN 30 (endpoints) → VLAN 10 (servers).'],
        ['Segmentation', 'even with a compromised workstation, east-west pivot to AD, VMware, or CUCM is blocked at L3.'],
      ],
    },
  };

  const showPostmortem = (name) => {
    if (!postmortem || !postmortemTitle || !postmortemList) return;
    const data = POSTMORTEM[name];
    if (!data) return;
    postmortemTitle.textContent = data.title;
    postmortemList.innerHTML = '';
    data.bullets.forEach(([lead, body]) => {
      const li = document.createElement('li');
      const s = document.createElement('strong');
      s.textContent = lead + ' — ';
      li.appendChild(s);
      li.appendChild(document.createTextNode(body));
      postmortemList.appendChild(li);
    });
    postmortem.hidden = false;
  };

  const hidePostmortem = () => {
    if (postmortem) postmortem.hidden = true;
  };

  // ---------- hover tooltips (preserved) ----------
  const showTip = (e, node) => {
    if (!tooltip) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${node.getAttribute('data-net-title')}</strong><span>${node.getAttribute('data-net-info') || ''}</span>`;
    tooltip.style.display = 'block';
    const x = e.clientX - rect.left + 16;
    const y = e.clientY - rect.top + 16;
    tooltip.style.left = Math.min(x, rect.width - 220) + 'px';
    tooltip.style.top = Math.min(y, rect.height - 60) + 'px';
  };
  const hideTip = () => {
    if (tooltip) tooltip.style.display = 'none';
    nodes.forEach((n) => n.classList.remove('is-active'));
  };
  nodes.forEach((node) => {
    node.addEventListener('pointerenter', (e) => { node.classList.add('is-active'); showTip(e, node); });
    node.addEventListener('pointermove', (e) => showTip(e, node));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', (e) => {
      node.classList.add('is-active');
      const r = node.getBoundingClientRect();
      showTip({ clientX: r.left + r.width / 2, clientY: r.top }, node);
    });
    node.addEventListener('blur', hideTip);
  });
  if (wrap) wrap.addEventListener('pointerleave', hideTip);

  // ---------- scenario engine ----------
  if (!fxLayer || !readoutState || !readoutDetail) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const nodeById = new Map();
  nodes.forEach((n) => {
    const id = n.getAttribute('data-net-id');
    if (id) nodeById.set(id, n);
  });
  // include the AD DC sub-tile
  const adTile = svg.querySelector('[data-net-id="ad"]');
  if (adTile) nodeById.set('ad', adTile);

  let activeScenario = null;
  let cleanupTimers = [];
  const queueTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    cleanupTimers.push(t);
    return t;
  };
  const wait = (ms) => new Promise((r) => queueTimer(r, ms));

  const setReadout = (kind, state, detail) => {
    readoutState.dataset.stateKind = kind;
    readoutState.textContent = state;
    readoutDetail.textContent = detail;
  };

  const flash = (id, kind, ms = 2200) => {
    const node = nodeById.get(id);
    if (!node) return;
    const cls = `is-attack-${kind}`;
    node.classList.add(cls);
    queueTimer(() => node.classList.remove(cls), ms);
  };

  const spawnPacket = (pathD, opts = {}) => {
    const dur = (opts.dur || 1200) / 1000;
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', String(opts.r || 5));
    c.setAttribute('class', `net-attack-packet ${opts.cls || ''}`.trim());
    if (opts.fill) c.setAttribute('fill', opts.fill);
    const m = document.createElementNS(SVG_NS, 'animateMotion');
    m.setAttribute('dur', `${reduceMotion ? 0.01 : dur}s`);
    m.setAttribute('path', pathD);
    m.setAttribute('fill', 'freeze');
    m.setAttribute('rotate', 'auto');
    c.appendChild(m);
    fxLayer.appendChild(c);
    return {
      element: c,
      done: wait(opts.dur || 1200),
      remove: () => { if (c.parentNode) c.parentNode.removeChild(c); },
    };
  };

  const spawnBadge = (x, y, text, kind = 'block') => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `net-attack-badge net-attack-badge-${kind}`);
    g.setAttribute('transform', `translate(${x} ${y})`);
    const r = document.createElementNS(SVG_NS, 'rect');
    const w = Math.max(80, text.length * 6.6 + 14);
    r.setAttribute('x', String(-w / 2));
    r.setAttribute('y', '-12');
    r.setAttribute('width', String(w));
    r.setAttribute('height', '22');
    r.setAttribute('rx', '4');
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('y', '3');
    t.textContent = text;
    g.appendChild(r);
    g.appendChild(t);
    fxLayer.appendChild(g);
    return g;
  };

  const cleanup = () => {
    cleanupTimers.forEach(clearTimeout);
    cleanupTimers = [];
    while (fxLayer.firstChild) fxLayer.removeChild(fxLayer.firstChild);
    nodes.forEach((n) => {
      n.classList.remove('is-attack-block', 'is-attack-target', 'is-attack-compromised');
    });
    if (adTile) adTile.classList.remove('is-attack-block', 'is-attack-target', 'is-attack-compromised');
    wrap.dataset.netState = 'idle';
    activeScenario = null;
    document.querySelectorAll('.net-sim-btn').forEach((b) => b.classList.remove('is-active'));
    hidePostmortem();
  };

  const resetReadout = () => {
    setReadout('idle', 'Idle', 'Pick a scenario to walk through how this stack reacts.');
  };

  const scenarios = {
    ingress: async () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'Inbound probe detected', 'Untrusted source attempting TCP/445 toward internal share.');
      const p = spawnPacket('M 130 90 L 220 90', { dur: 900, r: 5, cls: 'net-packet-malicious' });
      await p.done;
      flash('firewall', 'block', 4000);
      spawnBadge(280, 40, 'DROP — ACL deny TCP/445', 'block');
      setReadout('blocked', 'Blocked at perimeter', 'Edge ACL denied TCP/445 from untrusted source. Connection never reached the core.');
      await wait(700);
      showPostmortem('ingress');
    },

    auth: async () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'Workstation hitting AD with bad creds', 'Repeated NTLM bind failures from a single endpoint.');
      flash('endpoints', 'compromised', 6000);
      const burst = (delay) => queueTimer(() => {
        spawnPacket('M 740 240 L 740 180 L 220 180 L 220 280 L 200 295', {
          dur: 900, r: 4, cls: 'net-packet-malicious',
        });
      }, delay);
      [0, 220, 440, 660, 880].forEach(burst);
      await wait(1700);
      flash('ad', 'block', 4500);
      spawnBadge(177, 268, 'AUTH FAIL ×5', 'block');
      setReadout('blocked', 'Account locked by GPO', 'Domain controller tripped the lockout threshold; the account is held until reviewed.');
      await wait(700);
      showPostmortem('auth');
    },

    vlan: async () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'East-west pivot attempt', 'Endpoint VLAN tries to reach a server VLAN it has no business in.');
      flash('endpoints', 'compromised', 5500);
      const p = spawnPacket('M 740 240 L 740 180 L 480 180', { dur: 1100, r: 5, cls: 'net-packet-malicious' });
      await p.done;
      flash('switch', 'block', 4000);
      spawnBadge(500, 40, 'DENY — VLAN 30 → VLAN 10 (ACL)', 'block');
      // bounce-back animation
      spawnPacket('M 480 180 L 740 180 L 740 240', { dur: 900, r: 4, cls: 'net-packet-rejected' });
      setReadout('blocked', 'Inter-VLAN routing denied', 'Core switch ACL stopped the lateral move before it touched the server segment.');
      await wait(700);
      showPostmortem('vlan');
    },
  };

  const run = (name) => {
    if (name === 'reset') {
      cleanup();
      resetReadout();
      return;
    }
    const fn = scenarios[name];
    if (!fn) return;
    cleanup();
    activeScenario = name;
    const activeBtn = document.querySelector(`.net-sim-btn[data-net-scenario="${name}"]`);
    if (activeBtn) activeBtn.classList.add('is-active');
    fn().catch(() => { cleanup(); resetReadout(); });
  };

  controls.forEach((btn) => {
    btn.addEventListener('click', () => run(btn.getAttribute('data-net-scenario')));
  });

  // Pause the SMIL packet animations + dashed-link flow when the topology
  // isn't on screen — keeps Chrome's compositor idle while the user is
  // reading other parts of the page.
  if (wrap && 'IntersectionObserver' in window) {
    const setOffscreen = (off) => {
      wrap.classList.toggle('is-offscreen', off);
      try {
        if (off) svg.pauseAnimations();
        else svg.unpauseAnimations();
      } catch (_) { /* SMIL unsupported */ }
    };
    setOffscreen(true);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => setOffscreen(!e.isIntersecting));
    }, { rootMargin: '120px 0px' });
    io.observe(wrap);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        try { svg.pauseAnimations(); } catch (_) {}
      } else if (!wrap.classList.contains('is-offscreen')) {
        try { svg.unpauseAnimations(); } catch (_) {}
      }
    });
  }
})();
