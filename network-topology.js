// Topology diagram interactions: hover tooltips + scenario simulator.
// All animations are one-shot — no infinite loops, no SMIL on idle paths.
(() => {
  const wrap = document.querySelector('.topo');
  if (!wrap) return;
  const diagram = wrap.querySelector('.topo-diagram');
  const linesSvg = wrap.querySelector('.topo-lines');
  const fxSvg = wrap.querySelector('.topo-fx-svg');
  const fxHtml = wrap.querySelector('.topo-fx-html');
  const tooltip = wrap.querySelector('.net-tooltip');
  const nodes = wrap.querySelectorAll('.topo-node');
  const readoutState = wrap.querySelector('.net-sim-state');
  const readoutDetail = wrap.querySelector('.net-sim-detail');
  const postmortem = wrap.querySelector('.net-sim-postmortem');
  const postmortemTitle = postmortem && postmortem.querySelector('.net-sim-postmortem-title');
  const postmortemList = postmortem && postmortem.querySelector('.net-sim-postmortem-list');
  const controls = document.querySelectorAll('[data-net-scenario]');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const nodeById = new Map();
  nodes.forEach((n) => {
    const id = n.getAttribute('data-net-id');
    if (id) nodeById.set(id, n);
  });

  // ---------- hover/focus tooltips ----------
  const showTip = (e, node) => {
    if (!tooltip) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.innerHTML = '';
    const s = document.createElement('strong');
    s.textContent = node.getAttribute('data-net-title') || '';
    const d = document.createElement('span');
    d.textContent = node.getAttribute('data-net-info') || '';
    tooltip.append(s, d);
    tooltip.style.display = 'block';
    const cx = (e && e.clientX !== undefined) ? e.clientX : (rect.left + rect.width / 2);
    const cy = (e && e.clientY !== undefined) ? e.clientY : (rect.top + rect.height / 2);
    const x = cx - rect.left + 14;
    const y = cy - rect.top + 14;
    tooltip.style.left = Math.min(Math.max(8, x), rect.width - 280) + 'px';
    tooltip.style.top = Math.min(Math.max(8, y), rect.height - 80) + 'px';
  };
  const hideTip = () => {
    if (tooltip) tooltip.style.display = 'none';
    nodes.forEach((n) => n.classList.remove('is-hover'));
  };
  nodes.forEach((node) => {
    node.addEventListener('pointerenter', (e) => { node.classList.add('is-hover'); showTip(e, node); });
    node.addEventListener('pointermove', (e) => showTip(e, node));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => {
      node.classList.add('is-hover');
      const r = node.getBoundingClientRect();
      showTip({ clientX: r.left + r.width / 2, clientY: r.top }, node);
    });
    node.addEventListener('blur', hideTip);
  });
  wrap.addEventListener('pointerleave', hideTip);

  // ---------- scenario engine ----------
  if (!fxSvg || !fxHtml || !readoutState || !readoutDetail) return;

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

  let timers = [];
  const queue = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const setReadout = (kind, label, detail) => {
    readoutState.dataset.stateKind = kind;
    readoutState.textContent = label;
    readoutDetail.textContent = detail;
  };
  const resetReadout = () => setReadout('idle', 'Idle', 'Pick a scenario to walk through how this stack reacts.');

  const showPostmortem = (key) => {
    if (!postmortem || !postmortemList || !postmortemTitle) return;
    const data = POSTMORTEM[key];
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
  const hidePostmortem = () => { if (postmortem) postmortem.hidden = true; };

  // Spawn a packet that flies along an SVG path via one-shot SMIL.
  // Uses fill="freeze" so it ends statically (no infinite loop).
  const spawnPacket = (pathSelector, opts = {}) => {
    if (reduceMotion) return;
    const path = wrap.querySelector(pathSelector);
    if (!path) return;
    const dur = opts.dur || 900;
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', String(opts.r || 6));
    c.setAttribute('class', 'topo-packet ' + (opts.cls || ''));
    const m = document.createElementNS(SVG_NS, 'animateMotion');
    m.setAttribute('dur', (dur / 1000) + 's');
    m.setAttribute('fill', 'freeze');
    m.setAttribute('rotate', 'auto');
    const mp = document.createElementNS(SVG_NS, 'mpath');
    mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pathSelector);
    mp.setAttribute('href', pathSelector);
    m.appendChild(mp);
    c.appendChild(m);
    fxSvg.appendChild(c);
    queue(() => { if (c.parentNode) c.parentNode.removeChild(c); }, dur + 200);
  };

  // Badges are HTML — easier to style and crisper text than SVG <text>.
  const spawnBadge = (xPct, yPct, text, kind = 'block') => {
    const b = document.createElement('span');
    b.className = 'topo-badge topo-badge-' + kind;
    b.textContent = text;
    b.style.left = xPct + '%';
    b.style.top = yPct + '%';
    fxHtml.appendChild(b);
    queue(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 4500);
  };

  const flash = (id, kind, ms = 2200) => {
    const node = nodeById.get(id);
    if (!node) return;
    const cls = 'is-attack-' + kind;
    node.classList.add(cls);
    queue(() => node.classList.remove(cls), ms);
  };

  const cleanup = () => {
    clearTimers();
    while (fxSvg.firstChild) fxSvg.removeChild(fxSvg.firstChild);
    while (fxHtml.firstChild) fxHtml.removeChild(fxHtml.firstChild);
    nodes.forEach((n) => n.classList.remove('is-attack-block', 'is-attack-target', 'is-attack-compromised'));
    wrap.dataset.netState = 'idle';
    document.querySelectorAll('.net-sim-btn').forEach((b) => b.classList.remove('is-active'));
    hidePostmortem();
  };

  const scenarios = {
    ingress: () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'Inbound probe detected', 'Untrusted source attempting TCP/445 toward internal share.');
      spawnPacket('#topo-path-ingress', { dur: 850, cls: 'topo-packet-attack' });
      queue(() => {
        flash('firewall', 'block', 4500);
        spawnBadge(50, 32, 'DROP — ACL deny TCP/445');
        setReadout('blocked', 'Blocked at perimeter', 'Edge ACL denied TCP/445 from untrusted source. Connection never reached the core.');
      }, 800);
      queue(() => showPostmortem('ingress'), 1300);
    },
    auth: () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'Workstation hitting AD with bad creds', 'Repeated NTLM bind failures from a single endpoint.');
      flash('endpoints', 'compromised', 6000);
      [0, 220, 440, 660, 880].forEach((delay) => {
        queue(() => spawnPacket('#topo-path-auth', { dur: 1300, cls: 'topo-packet-attack', r: 5 }), delay);
      });
      queue(() => {
        flash('vmware', 'block', 4500);
        spawnBadge(20, 78, 'AUTH FAIL ×5');
        setReadout('blocked', 'Account locked by GPO', 'Domain controller tripped the lockout threshold; the account is held until reviewed.');
      }, 1900);
      queue(() => showPostmortem('auth'), 2500);
    },
    vlan: () => {
      wrap.dataset.netState = 'attack';
      setReadout('alert', 'East-west pivot attempt', 'Endpoint VLAN tries to reach a server VLAN it has no business in.');
      flash('endpoints', 'compromised', 5500);
      spawnPacket('#topo-path-vlan', { dur: 1100, cls: 'topo-packet-attack' });
      queue(() => {
        flash('switch', 'block', 4500);
        spawnBadge(50, 49, 'DENY — VLAN 30 → VLAN 10 (ACL)');
        setReadout('blocked', 'Inter-VLAN routing denied', 'Core switch ACL stopped the lateral move before it touched the server segment.');
      }, 1100);
      queue(() => showPostmortem('vlan'), 1800);
    },
  };

  const run = (name) => {
    if (name === 'reset') { cleanup(); resetReadout(); return; }
    const fn = scenarios[name];
    if (!fn) return;
    cleanup();
    const btn = document.querySelector(`.net-sim-btn[data-net-scenario="${name}"]`);
    if (btn) btn.classList.add('is-active');
    fn();
  };
  controls.forEach((btn) => btn.addEventListener('click', () => run(btn.getAttribute('data-net-scenario'))));

  // Pause SMIL when offscreen / tab hidden so spawned scenario packets
  // (which use freeze, not loop) still don't burn a render thread if the
  // user kicks off a scenario then scrolls away.
  if ('IntersectionObserver' in window && linesSvg) {
    const setOff = (off) => {
      wrap.classList.toggle('is-offscreen', off);
      try { off ? linesSvg.pauseAnimations() : linesSvg.unpauseAnimations(); } catch (_) {}
    };
    setOff(true);
    new IntersectionObserver((entries) => {
      entries.forEach((e) => setOff(!e.isIntersecting));
    }, { rootMargin: '120px 0px' }).observe(wrap);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { try { linesSvg.pauseAnimations(); } catch (_) {} }
      else if (!wrap.classList.contains('is-offscreen')) { try { linesSvg.unpauseAnimations(); } catch (_) {} }
    });
  }
})();
