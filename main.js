const root = document.documentElement;
const yearTarget = document.getElementById('year');
if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

const params = new URLSearchParams(window.location.search);
const motionParam = params.get('motion');
const getStoredValue = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
};
const setStoredValue = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (_error) {
    // No-op if storage is blocked by browser privacy mode.
  }
};

let motionPreference = getStoredValue('motion-preference');

if (motionParam === 'on' || motionParam === 'off') {
  motionPreference = motionParam;
  setStoredValue('motion-preference', motionPreference);
} else if (!motionPreference) {
  motionPreference = 'on';
  setStoredValue('motion-preference', motionPreference);
}

const prefersReducedMotion = motionPreference === 'off';
root.classList.toggle('reduce-motion', prefersReducedMotion);
const isFinePointer = window.matchMedia('(pointer: fine)').matches;

const progressElement = document.querySelector('.scroll-progress span');
const updateScrollProgress = () => {
  if (!progressElement) return;
  const scrollTop = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
  progressElement.style.width = `${Math.min(100, Math.max(0, progress)).toFixed(2)}%`;
};

window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress);
updateScrollProgress();

if (!prefersReducedMotion && isFinePointer) {
  let rafId = 0;
  let pointerX = window.innerWidth * 0.5;
  let pointerY = window.innerHeight * 0.3;

  const applyPointerGlow = () => {
    root.style.setProperty('--mouse-x', `${pointerX}px`);
    root.style.setProperty('--mouse-y', `${pointerY}px`);
    rafId = 0;
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!rafId) {
        rafId = window.requestAnimationFrame(applyPointerGlow);
      }
    },
    { passive: true }
  );
}

const revealItems = document.querySelectorAll('.reveal');
if (!('IntersectionObserver' in window) || prefersReducedMotion) {
  revealItems.forEach((item) => item.classList.add('visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -40px 0px'
    }
  );

  revealItems.forEach((item, index) => {
    item.style.setProperty('--reveal-delay', `${Math.min(index * 38, 240)}ms`);
    observer.observe(item);
  });
}

if (!prefersReducedMotion && isFinePointer) {
  const tiltTargets = document.querySelectorAll(
    '.project-card, .timeline-card, .impact-card, .skill-card, .publication-card'
  );

  tiltTargets.forEach((card) => {
    card.classList.add('interactive-card');

    const resetTilt = () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.classList.remove('is-hovered');
    };

    card.addEventListener('pointerenter', () => {
      card.classList.add('is-hovered');
    });

    card.addEventListener('pointerleave', resetTilt);
    card.addEventListener('pointercancel', resetTilt);

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const tiltX = (0.5 - py) * 7.5;
      const tiltY = (px - 0.5) * 8;

      card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
    });
  });
}

// Animated stat counters in hero — hero is always visible on load, so
// run immediately instead of relying on IntersectionObserver (which some
// environments fail to fire for already-in-viewport elements).
const statCounts = document.querySelectorAll('.stat-count');
if (statCounts.length) {
  const renderStat = (el, value) => {
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    el.textContent = `${prefix}${value}${suffix}`;
  };
  if (prefersReducedMotion) {
    statCounts.forEach((el) => {
      renderStat(el, parseInt(el.dataset.countTo || '0', 10));
    });
  } else {
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const animateCount = (el) => {
      const target = parseInt(el.dataset.countTo || '0', 10);
      const duration = 1100;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        renderStat(el, Math.round(easeOut(t) * target));
        if (t < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    statCounts.forEach((el) => {
      renderStat(el, 0);
      window.setTimeout(() => animateCount(el), 200);
    });
  }
}

// Parallax tilt on the photo only — tilting the whole .profile-card
// rotates around a point below the photo, which visually throws the
// photo off-center. Pivoting on .photo-frame keeps the rotation origin
// at the photo's own center.
const photoFrame = document.querySelector('.profile-card .photo-frame');
if (photoFrame && !prefersReducedMotion && isFinePointer) {
  const resetPhotoTilt = () => {
    photoFrame.style.removeProperty('transform');
    photoFrame.classList.remove('is-tilting');
  };
  photoFrame.addEventListener('pointerenter', () => {
    photoFrame.classList.add('is-tilting');
  });
  photoFrame.addEventListener('pointerleave', resetPhotoTilt);
  photoFrame.addEventListener('pointercancel', resetPhotoTilt);
  photoFrame.addEventListener('pointermove', (event) => {
    const rect = photoFrame.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 10;
    const ry = (px - 0.5) * 12;
    photoFrame.style.setProperty(
      'transform',
      `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
    );
  });
}

// Experience chip filter
const chipBar = document.querySelector('.exp-chip-bar');
const timelineSection = document.querySelector('.timeline');
if (chipBar && timelineSection) {
  const chips = chipBar.querySelectorAll('.exp-chip');
  const clearBtn = chipBar.querySelector('.exp-chip-clear');
  const allBullets = timelineSection.querySelectorAll('.timeline-card li[data-tags]');

  const applyFilter = () => {
    const active = Array.from(chips)
      .filter((c) => c.classList.contains('is-active'))
      .map((c) => c.dataset.filter);
    if (active.length === 0) {
      timelineSection.classList.remove('is-filtering');
      allBullets.forEach((li) => li.classList.remove('is-match'));
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    timelineSection.classList.add('is-filtering');
    allBullets.forEach((li) => {
      const tags = (li.dataset.tags || '').split(/\s+/);
      li.classList.toggle('is-match', active.some((a) => tags.includes(a)));
    });
    if (clearBtn) clearBtn.hidden = false;
  };

  chips.forEach((chip) => {
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      chip.classList.toggle('is-active');
      chip.setAttribute('aria-pressed', chip.classList.contains('is-active') ? 'true' : 'false');
      applyFilter();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      applyFilter();
    });
  }
}

// Deployment map tooltip
const deployMap = document.querySelector('.deployment-map');
if (deployMap) {
  const tooltip = deployMap.querySelector('.dm-tooltip');
  const svg = deployMap.querySelector('.dm-svg');
  const nodes = deployMap.querySelectorAll('.dm-node');

  const showTip = (node) => {
    if (!tooltip || !svg) return;
    const title = node.dataset.dmTitle || '';
    const desc = node.dataset.dmDesc || '';
    const dates = node.dataset.dmDates || '';

    tooltip.textContent = '';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);
    tooltip.appendChild(document.createTextNode(desc));
    if (dates) {
      const dateEl = document.createElement('div');
      dateEl.className = 'dm-tip-dates';
      dateEl.textContent = dates;
      tooltip.appendChild(dateEl);
    }

    const dot = node.querySelector('.dm-dot');
    if (!dot) return;
    const mapRect = deployMap.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    const left = dotRect.left + dotRect.width / 2 - mapRect.left;
    const top = dotRect.top - mapRect.top - 12;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
  };

  const hideTip = () => {
    if (!tooltip) return;
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  };

  nodes.forEach((node) => {
    node.addEventListener('pointerenter', () => showTip(node));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => showTip(node));
    node.addEventListener('blur', hideTip);
  });

  window.addEventListener('scroll', hideTip, { passive: true });
  window.addEventListener('resize', hideTip);

  // Chronological reveal: arcs draw on and dots pop in, in posting order.
  const orderedNodes = Array.from(nodes)
    .map((n) => ({ el: n, order: parseInt(n.dataset.dmOrder || '0', 10) }))
    .filter((n) => n.order > 0)
    .sort((a, b) => a.order - b.order)
    .map((n) => n.el);
  const orderedArcs = Array.from(deployMap.querySelectorAll('.dm-arc'))
    .map((a) => ({ el: a, order: parseInt(a.dataset.dmArcOrder || '0', 10) }))
    .filter((a) => a.order > 0)
    .sort((a, b) => a.order - b.order)
    .map((a) => a.el);
  const replayBtn = deployMap.querySelector('.dm-replay');

  // Pre-measure each arc so the dash animation duration is proportional to
  // path length (so arc 3 — the long Darwin→Albany trip — draws slower).
  orderedArcs.forEach((arc) => {
    let len = 1200;
    try { len = arc.getTotalLength(); } catch (_e) { /* keep default */ }
    arc.style.setProperty('--dm-arc-len', String(len));
    const ms = Math.round(Math.min(1700, Math.max(700, len * 1.45)));
    arc.style.setProperty('--dm-arc-dur', `${ms}ms`);
    arc.dataset.dmArcDurMs = String(ms);
  });

  let timeouts = [];
  const clearTimers = () => {
    timeouts.forEach((id) => window.clearTimeout(id));
    timeouts = [];
  };
  const scheduleAt = (ms, fn) => {
    timeouts.push(window.setTimeout(fn, ms));
  };

  let totalDurMs = 0;

  const resetSequence = () => {
    clearTimers();
    deployMap.setAttribute('data-dm-anim', 'pending');
    orderedArcs.forEach((a) => a.classList.remove('is-revealed', 'is-settled'));
    orderedNodes.forEach((n) => n.classList.remove('is-revealed'));
  };

  const playSequence = () => {
    if (prefersReducedMotion) {
      deployMap.setAttribute('data-dm-anim', 'done');
      orderedArcs.forEach((a) => a.classList.add('is-revealed', 'is-settled'));
      orderedNodes.forEach((n) => n.classList.add('is-revealed'));
      if (replayBtn) replayBtn.hidden = false;
      return;
    }
    resetSequence();
    deployMap.setAttribute('data-dm-anim', 'playing');
    if (replayBtn) {
      replayBtn.disabled = true;
      replayBtn.dataset.dmSpinning = 'true';
    }
    let t = 200;
    // First posting reveal kicks the sequence off.
    scheduleAt(t, () => orderedNodes[0] && orderedNodes[0].classList.add('is-revealed'));
    t += 480;
    orderedArcs.forEach((arc, i) => {
      const dur = parseInt(arc.dataset.dmArcDurMs || '1200', 10);
      const arcStart = t;
      scheduleAt(arcStart, () => arc.classList.add('is-revealed'));
      t += dur;
      // Once the arc has drawn fully, swap to the dashed style and reveal the
      // destination posting.
      scheduleAt(t, () => arc.classList.add('is-settled'));
      const target = orderedNodes[i + 1];
      if (target) {
        scheduleAt(t + 80, () => target.classList.add('is-revealed'));
        t += 320;
      }
    });
    totalDurMs = t + 200;
    scheduleAt(totalDurMs, () => {
      deployMap.setAttribute('data-dm-anim', 'done');
      if (replayBtn) {
        replayBtn.disabled = false;
        replayBtn.dataset.dmSpinning = 'false';
        replayBtn.hidden = false;
      }
    });
  };

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (replayBtn.disabled) return;
      // Reset to "pending" first so styles re-apply, then play next frame.
      resetSequence();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(playSequence);
      });
    });
  }

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const playOnce = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            playOnce.disconnect();
            playSequence();
            break;
          }
        }
      },
      { threshold: 0.35 }
    );
    playOnce.observe(deployMap);
  } else {
    playSequence();
  }
}

// "Now" card — relative freshness indicator
const nowUpdated = document.querySelector('.now-updated');
if (nowUpdated) {
  const timeEl = nowUpdated.querySelector('time[datetime]');
  const datetimeAttr = timeEl && timeEl.getAttribute('datetime');
  const updated = datetimeAttr ? new Date(datetimeAttr) : null;
  if (updated && !Number.isNaN(updated.getTime())) {
    const startOfDay = (d) => {
      const c = new Date(d);
      c.setHours(0, 0, 0, 0);
      return c;
    };
    const now = new Date();
    const days = Math.floor((startOfDay(now) - startOfDay(updated)) / 86400000);
    const absoluteText = timeEl.textContent.trim();

    let label;
    if (days <= 0) {
      label = 'Updated today';
    } else if (days === 1) {
      label = 'Updated yesterday';
    } else if (days < 30) {
      label = `Updated ${days} days ago`;
    } else if (days < 120) {
      const m = now.getMonth();
      const season =
        m === 11 || m <= 1 ? 'winter' :
        m <= 4 ? 'spring' :
        m <= 7 ? 'summer' :
        'fall';
      label = `Updated earlier this ${season}`;
    } else {
      label = `Updated ${updated.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
    }

    while (nowUpdated.firstChild) nowUpdated.removeChild(nowUpdated.firstChild);
    const t = document.createElement('time');
    t.setAttribute('datetime', datetimeAttr);
    t.title = absoluteText;
    t.textContent = label;
    nowUpdated.appendChild(t);
  }
}

// =====================================================================
// Hero eyebrow typewriter cycle
// =====================================================================
(() => {
  const node = document.querySelector('.eyebrow-cycle');
  if (!node) return;
  const raw = node.getAttribute('data-cycle') || '';
  const phrases = raw.split('|').map((s) => s.trim()).filter(Boolean);
  if (phrases.length < 2) return;
  if (prefersReducedMotion) { node.textContent = phrases[0]; return; }

  let phraseIndex = 0;
  let charIndex = phrases[0].length;
  let typing = false;
  node.textContent = phrases[0];

  const tick = async () => {
    // hold the current phrase for a beat
    await new Promise((r) => setTimeout(r, 2400));
    // delete
    while (charIndex > 0) {
      charIndex -= 1;
      node.textContent = phrases[phraseIndex].slice(0, charIndex);
      await new Promise((r) => setTimeout(r, 28 + Math.random() * 20));
    }
    phraseIndex = (phraseIndex + 1) % phrases.length;
    // type next
    const next = phrases[phraseIndex];
    while (charIndex < next.length) {
      charIndex += 1;
      node.textContent = next.slice(0, charIndex);
      await new Promise((r) => setTimeout(r, 55 + Math.random() * 35));
    }
    tick();
  };
  // start after a short delay so the page renders first
  setTimeout(tick, 1400);
})();

// =====================================================================
// Tech-stack marquee — duplicate items so the loop is seamless
// =====================================================================
(() => {
  const track = document.querySelector('[data-marquee]');
  if (!track) return;
  // Clone all children once so the -50% translate creates a seamless loop
  const items = Array.from(track.children);
  items.forEach((el) => {
    const clone = el.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
})();

// =====================================================================
// Live ops console — rolling synthetic sysadmin log lines
// =====================================================================
(() => {
  const list = document.querySelector('[data-ops-console]');
  if (!list) return;

  const HOSTS = ['ad-dc01', 'ad-dc02', 'esxi-01', 'esxi-02', 'cucm-pub', 'cucm-sub', 'fw-edge', 'core-sw01', 'rtr-vpn', 'piper-tts', 'rag-svc', 'gh-runner'];
  const TEMPLATES = [
    { tag: 'OK',   msg: 'NTP drift {n}ms within tolerance' },
    { tag: 'OK',   msg: 'AD replication {n}s — converged' },
    { tag: 'OK',   msg: 'SIP register 200 — peers={n}' },
    { tag: 'OK',   msg: 'vMotion completed in {n}s' },
    { tag: 'OK',   msg: 'GPO refresh — {n} objects updated' },
    { tag: 'OK',   msg: 'snapshot pruned — reclaimed {n} GB' },
    { tag: 'OK',   msg: 'TLS cert renewed — {n}d remaining' },
    { tag: 'OK',   msg: 'backup verified sha256 ({n} GB)' },
    { tag: 'OK',   msg: 'piper-tts synth latency {n}ms' },
    { tag: 'OK',   msg: 'rag retrieval — top-{n} cited' },
    { tag: 'WARN', msg: 'vlan40 utilization {n}% (threshold 75)' },
    { tag: 'WARN', msg: 'failed bind from 10.0.{n}.14 — locked' },
    { tag: 'WARN', msg: 'CPU ready time {n}% on web-vm-03' },
    { tag: 'WARN', msg: 'fan2 rpm dropped to {n}' },
    { tag: 'OK',   msg: 'firewall ACL deny tcp/{n} (drop)' },
    { tag: 'OK',   msg: 'HSRP vrrp{n} active — failover ready' },
    { tag: 'OK',   msg: 'patch ring {n} — reboot pending' },
  ];
  const TIME_BIAS = Date.now();

  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (offsetSec) => {
    const d = new Date(TIME_BIAS + offsetSec * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));

  const buildLine = (offsetSec) => {
    const tpl = pick(TEMPLATES);
    const host = pick(HOSTS);
    const n = randInt(1, 999);
    const msg = tpl.msg.replace('{n}', String(n));
    const li = document.createElement('li');
    const tagClass = tpl.tag === 'OK' ? 'ok' : tpl.tag === 'WARN' ? 'warn' : 'err';
    li.innerHTML = `
      <span class="ops-line-time">${fmtTime(offsetSec)}</span>
      <span class="ops-line-host">${host}</span>
      <span class="ops-line-msg">${msg}</span>
      <span class="ops-line-tag ${tagClass}">[${tpl.tag}]</span>
    `;
    return li;
  };

  const MAX_LINES = 5;
  // seed with a backlog so the console looks lived-in immediately
  for (let i = MAX_LINES - 1; i >= 0; i--) list.appendChild(buildLine(-i * 4));

  if (prefersReducedMotion) return;

  const push = () => {
    list.appendChild(buildLine(0));
    while (list.children.length > MAX_LINES) list.removeChild(list.firstChild);
  };

  let timer;
  const schedule = () => {
    const delay = 1800 + Math.random() * 2200;
    timer = setTimeout(() => { push(); schedule(); }, delay);
  };
  // Pause when tab is hidden (saves CPU + avoids flood-on-return)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); }
    else { schedule(); }
  });
  schedule();
})();

// =====================================================================
// Last-commit ticker — fetch latest commit from GitHub
// =====================================================================
(() => {
  const el = document.querySelector('.last-commit');
  if (!el) return;
  const repo = el.getAttribute('data-repo');
  if (!repo) return;

  const txt = el.querySelector('.last-commit-text');

  const relativeTime = (date) => {
    const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  };

  fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
    headers: { 'Accept': 'application/vnd.github+json' },
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((commits) => {
      if (!Array.isArray(commits) || !commits.length) throw new Error('no commits');
      const c = commits[0];
      const sha = (c.sha || '').slice(0, 7);
      const msgFull = (c.commit && c.commit.message ? c.commit.message : '').split('\n')[0];
      const when = c.commit && c.commit.author && c.commit.author.date
        ? new Date(c.commit.author.date)
        : null;
      const url = c.html_url;
      txt.innerHTML = '';
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = msgFull;
      const sShi = document.createElement('span');
      sShi.className = 'last-commit-sha';
      sShi.textContent = sha;
      const sMsg = document.createElement('span');
      sMsg.className = 'last-commit-msg';
      sMsg.textContent = '"' + msgFull + '"';
      const sTime = document.createElement('span');
      sTime.className = 'last-commit-time';
      sTime.textContent = when ? '· ' + relativeTime(when) : '';
      a.append(sShi, sMsg, sTime);
      txt.appendChild(a);
      el.hidden = false;
    })
    .catch(() => {
      // silent failure — keep element hidden so the layout doesn't show "Loading..."
      el.hidden = true;
    });
})();

// =====================================================================
// Scroll-tied parallax — exposes --scroll-y on :root
// =====================================================================
(() => {
  if (prefersReducedMotion) return;
  let ticking = false;
  const apply = () => {
    root.style.setProperty('--scroll-y', String(window.scrollY));
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
  apply();
})();

// =====================================================================
// Page transitions — fade between internal navigation
// =====================================================================
(() => {
  if (prefersReducedMotion) return;
  // Browsers that support cross-document View Transitions handle this via CSS
  // (@view-transition { navigation: auto; }). For others, we provide a JS
  // fade-out that runs before navigation. The CSS page-enter animation runs
  // automatically on every fresh page load.
  const supportsViewTransitions = !!document.startViewTransition
    || (typeof CSSRule !== 'undefined' && 'ViewTransitionRule' in window);

  if (supportsViewTransitions) return;

  const sameOrigin = (url) => {
    try { return new URL(url, window.location.href).origin === window.location.origin; }
    catch (_e) { return false; }
  };
  const isInternalNav = (a) => {
    if (!a || !a.href) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    if (a.getAttribute('href').startsWith('#')) return false;
    if (a.getAttribute('href').startsWith('mailto:')) return false;
    if (a.getAttribute('href').startsWith('tel:')) return false;
    if (!sameOrigin(a.href)) return false;
    // Only intercept when the path actually changes; same-page anchor links
    // and same-page reloads should fall through to default behavior.
    const here = window.location.pathname;
    const there = new URL(a.href).pathname;
    return there !== here;
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || !isInternalNav(a)) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    const dest = a.href;
    setTimeout(() => { window.location.href = dest; }, 190);
  });
})();

// ---- Press: lazy click-to-play video posters ----
(() => {
  const posters = document.querySelectorAll('.press-video-poster');
  if (!posters.length) return;

  const playMp4 = (poster, src) => {
    const frame = document.createElement('div');
    frame.className = 'press-video-frame';
    const v = document.createElement('video');
    v.src = src;
    v.controls = true;
    v.autoplay = true;
    v.preload = 'metadata';
    v.playsInline = true;
    frame.appendChild(v);
    poster.parentNode.insertBefore(frame, poster);
    poster.parentNode.classList.add('is-playing');
    v.play().catch(() => {});
  };

  const playYouTube = (poster, id) => {
    const frame = document.createElement('div');
    frame.className = 'press-video-frame';
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
    f.title = 'UAlbany News video';
    f.loading = 'eager';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.allowFullscreen = true;
    frame.appendChild(f);
    poster.parentNode.insertBefore(frame, poster);
    poster.parentNode.classList.add('is-playing');
  };

  posters.forEach((poster) => {
    poster.addEventListener('click', () => {
      const type = poster.getAttribute('data-video-type');
      if (type === 'mp4') {
        const src = poster.getAttribute('data-video-src');
        if (src) playMp4(poster, src);
      } else if (type === 'youtube') {
        const id = poster.getAttribute('data-video-id');
        if (id) playYouTube(poster, id);
      }
    });
  });
})();

// ---- VS Code-style chrome: bottom status bar + Cmd/Ctrl+K command palette ----
(() => {
  if (window.__vscChromeMounted) return;
  window.__vscChromeMounted = true;

  const PAGES = [
    { file: 'index.html',                       title: 'Home' },
    { file: 'projects.html',                    title: 'Projects' },
    { file: 'publication.html',                 title: 'Publication' },
    { file: 'experience.html',                  title: 'Experience' },
    { file: 'skills.html',                      title: 'Skills' },
    { file: 'resume.html',                      title: 'Resume' },
    { file: 'contact.html',                     title: 'Contact' },
    { file: 'crypto-lab-project.html',          title: 'CRYPTO Lab — Local RAG Assistant' },
    { file: 'cafe-lab-project.html',            title: 'Café Lab — Behavioral Biometrics' },
    { file: 'smartwatch-biometrics-project.html', title: 'Smartwatch Biometrics — Side-channel & DP defense' },
    { file: 'twitch-chatbot-project.html',      title: 'Twitch Chatbot — Streaming Automation' },
  ];

  const ACTIONS = [
    { label: 'Open GitHub',           hint: 'github.com/StephenCGravereaux',
      run: () => window.open('https://github.com/StephenCGravereaux', '_blank', 'noopener') },
    { label: 'Open LinkedIn',         hint: 'linkedin.com/in/stephen-gravereaux-30752b35a',
      run: () => window.open('https://www.linkedin.com/in/stephen-gravereaux-30752b35a/', '_blank', 'noopener') },
    { label: 'Email Stephen',         hint: 'StephenGrav@outlook.com',
      run: () => { window.location.href = 'mailto:StephenGrav@outlook.com'; } },
    { label: 'Download Resume',       hint: 'Stephen Gravereaux Resume.pdf',
      run: () => window.open('Stephen Gravereaux Resume.pdf', '_blank', 'noopener') },
    { label: 'Toggle reduced motion', hint: 'Disable or enable animations',
      run: () => document.documentElement.classList.toggle('reduce-motion') },
    { label: 'Scroll to top',         hint: 'Jump to the top of this page',
      run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  ];

  const currentFile = () => {
    let p = (location.pathname || '').split('/').pop();
    return p || 'index.html';
  };

  // ----- status bar -----
  const ICONS = {
    branch: '<svg class="vsc-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.249 2.249 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 3.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/></svg>',
    err:    '<svg class="vsc-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M5 5l6 6"/></svg>',
    warn:   '<svg class="vsc-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M8 2.4 14.4 13.6H1.6L8 2.4z"/><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 7v3"/><circle cx="8" cy="11.6" r="0.7" fill="currentColor"/></svg>',
    cmd:    '<svg class="vsc-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M5.5 4a1.5 1.5 0 1 0-1.5 1.5h1.5V4zm0 0v8m0-8h5m0 0v8m0-8a1.5 1.5 0 1 1 1.5 1.5H10.5V4zm-5 8a1.5 1.5 0 1 1-1.5-1.5h1.5V12zm5 0a1.5 1.5 0 1 0 1.5 1.5H10.5V12z"/></svg>',
    radio:  '<svg class="vsc-icon" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>',
  };

  const sb = document.createElement('aside');
  sb.className = 'vsc-statusbar';
  sb.setAttribute('role', 'contentinfo');
  sb.setAttribute('aria-label', 'Status bar');
  sb.innerHTML = `
    <div class="vsc-status-left">
      <a class="vsc-status-item vsc-status-remote" href="https://github.com/StephenCGravereaux/Personal-Website" target="_blank" rel="noopener" title="View source on GitHub">
        <span class="vsc-status-remote-dot">${ICONS.radio}</span><span>github</span>
      </a>
      <a class="vsc-status-item vsc-status-branch" href="https://github.com/StephenCGravereaux/Personal-Website" target="_blank" rel="noopener" title="On branch main · view source">
        ${ICONS.branch}<span>main</span>
      </a>
      <button type="button" class="vsc-status-item vsc-status-issues" data-vsc-action="palette" title="No problems detected — click to open the command palette">
        ${ICONS.err}<span>0</span>${ICONS.warn}<span>0</span>
      </button>
    </div>
    <div class="vsc-status-right">
      <button type="button" class="vsc-status-item vsc-status-cursor" data-vsc-action="top" title="Scroll to top">Ln 1, Col 1</button>
      <span class="vsc-status-item vsc-hide-sm" title="Indentation">Spaces: 2</span>
      <span class="vsc-status-item vsc-hide-sm" title="File encoding">UTF-8</span>
      <span class="vsc-status-item vsc-hide-sm" title="Line endings">LF</span>
      <span class="vsc-status-item vsc-status-lang" title="Language mode">HTML</span>
      <button type="button" class="vsc-status-item vsc-status-cmd" data-vsc-action="palette" title="Show all commands (Ctrl+K)">${ICONS.cmd}<span>K</span></button>
    </div>
  `;
  document.body.appendChild(sb);

  sb.querySelectorAll('[data-vsc-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = el.getAttribute('data-vsc-action');
      if (action === 'palette') { e.preventDefault(); openPalette(); }
      else if (action === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
  });

  const cursorEl = sb.querySelector('.vsc-status-cursor');
  const updateCursor = () => {
    const ln = Math.max(1, Math.round(window.scrollY / 24) + 1);
    const col = Math.max(1, (window.scrollX || 0) + 1);
    cursorEl.textContent = `Ln ${ln}, Col ${col}`;
  };
  updateCursor();
  let scrollTick = 0;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = requestAnimationFrame(() => { updateCursor(); scrollTick = 0; });
  }, { passive: true });

  // ----- command palette -----
  const palette = document.createElement('div');
  palette.className = 'vsc-palette';
  palette.setAttribute('role', 'dialog');
  palette.setAttribute('aria-modal', 'true');
  palette.setAttribute('aria-label', 'Command palette');
  palette.hidden = true;
  palette.innerHTML = `
    <div class="vsc-palette-backdrop" data-vsc-close></div>
    <div class="vsc-palette-modal" role="document">
      <div class="vsc-palette-input-row">
        <span class="vsc-palette-prompt" aria-hidden="true">›</span>
        <input type="text" class="vsc-palette-input" placeholder="Type the name of a page, section, or action…" aria-label="Command palette search" autocomplete="off" spellcheck="false">
      </div>
      <ul class="vsc-palette-list" role="listbox" aria-label="Results"></ul>
      <div class="vsc-palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> select</span>
        <span><kbd>esc</kbd> dismiss</span>
      </div>
    </div>
  `;
  document.body.appendChild(palette);
  const input = palette.querySelector('.vsc-palette-input');
  const list = palette.querySelector('.vsc-palette-list');

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const collectSections = () => {
    const cur = currentFile();
    return Array.from(document.querySelectorAll('main section[id], section[id]')).map((s) => {
      const h = s.querySelector('h2, h3');
      const label = h ? h.textContent.trim() : s.id;
      return {
        kind: 'section',
        label,
        hint: `Section · ${cur}#${s.id}`,
        run: () => {
          closePalette();
          history.replaceState(null, '', `#${s.id}`);
          const tgt = document.getElementById(s.id);
          if (tgt) tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      };
    });
  };

  const buildItems = () => {
    const cur = currentFile();
    const pageItems = PAGES.map((p) => ({
      kind: 'page',
      label: p.file,
      hint: p.file === cur ? 'Current page' : `Open · ${p.title}`,
      isCurrent: p.file === cur,
      run: () => { closePalette(); if (p.file !== cur) window.location.href = p.file; },
    }));
    const actionItems = ACTIONS.map((a) => ({
      kind: 'action',
      label: a.label,
      hint: a.hint || 'Action',
      run: () => { closePalette(); a.run(); },
    }));
    return [...pageItems, ...collectSections(), ...actionItems];
  };

  const score = (s, q) => {
    if (!q) return 1;
    s = String(s).toLowerCase(); q = q.toLowerCase();
    if (s === q) return 1000;
    if (s.startsWith(q)) return 500 - s.length;
    const idx = s.indexOf(q);
    if (idx >= 0) return 200 - idx - s.length / 10;
    let qi = 0;
    for (let i = 0; i < s.length && qi < q.length; i++) if (s[i] === q[qi]) qi++;
    return qi === q.length ? 50 - s.length / 10 : 0;
  };

  let allItems = [];
  let visibleItems = [];
  let activeIndex = 0;

  const iconHtml = (kind) => {
    if (kind === 'page')    return '<span class="vsc-pi-icon vsc-pi-html" aria-hidden="true">&lt;/&gt;</span>';
    if (kind === 'section') return '<span class="vsc-pi-icon vsc-pi-anchor" aria-hidden="true">#</span>';
    return                         '<span class="vsc-pi-icon vsc-pi-action" aria-hidden="true">›_</span>';
  };

  const render = () => {
    list.innerHTML = '';
    if (!visibleItems.length) {
      const li = document.createElement('li');
      li.className = 'vsc-pi-empty';
      li.textContent = 'No matching commands';
      list.appendChild(li);
      return;
    }
    visibleItems.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'vsc-pi' + (i === activeIndex ? ' is-active' : '') + (it.isCurrent ? ' is-current' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      li.innerHTML = `${iconHtml(it.kind)}<span class="vsc-pi-label">${escapeHtml(it.label)}</span><span class="vsc-pi-hint">${escapeHtml(it.hint || '')}</span>`;
      li.addEventListener('click', () => it.run());
      li.addEventListener('mouseenter', () => { activeIndex = i; updateActive(); });
      list.appendChild(li);
    });
  };

  const updateActive = () => {
    Array.from(list.children).forEach((el, i) => {
      if (el.classList.contains('vsc-pi-empty')) return;
      el.classList.toggle('is-active', i === activeIndex);
      el.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
    });
    const active = list.children[activeIndex];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  };

  let lastFocus = null;
  const openPalette = () => {
    if (!palette.hidden) return;
    lastFocus = document.activeElement;
    allItems = buildItems();
    visibleItems = allItems.slice();
    activeIndex = 0;
    palette.hidden = false;
    document.body.classList.add('vsc-palette-open');
    input.value = '';
    render();
    setTimeout(() => input.focus(), 10);
  };

  const closePalette = () => {
    if (palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('vsc-palette-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) {
      visibleItems = allItems.slice();
    } else {
      visibleItems = allItems
        .map((it) => ({ it, sc: Math.max(score(it.label, q), score(it.hint || '', q) * 0.6) }))
        .filter((r) => r.sc > 0)
        .sort((a, b) => b.sc - a.sc)
        .map((r) => r.it);
    }
    activeIndex = 0;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, visibleItems.length - 1); updateActive(); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); updateActive(); return; }
    if (e.key === 'Enter')     { e.preventDefault(); if (visibleItems[activeIndex]) visibleItems[activeIndex].run(); return; }
  });

  palette.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-vsc-close]')) closePalette();
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (palette.hidden) openPalette(); else closePalette();
      return;
    }
    if (e.key === 'Escape' && !palette.hidden) {
      e.preventDefault();
      closePalette();
    }
  });
})();

// ---- Terminal-style chatbot in the bottom-right ----
(() => {
  if (window.__termBotMounted) return;
  window.__termBotMounted = true;

  // Cloudflare Worker that proxies to Workers AI (Llama 3.1 8B Instruct).
  // Source in /worker; redeploy via the Cloudflare dashboard or `wrangler deploy`.
  const WORKER_URL = 'https://websitehelper.exceptedtie.workers.dev';

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'termbot-launcher';
  launcher.setAttribute('aria-label', 'Open terminal chat');
  launcher.innerHTML = '<span class="termbot-launcher-icon" aria-hidden="true">$_</span><span class="termbot-launcher-pulse" aria-hidden="true"></span>';
  document.body.appendChild(launcher);

  const panel = document.createElement('section');
  panel.className = 'termbot-panel';
  panel.setAttribute('aria-label', 'Terminal chat');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="termbot-head">
      <span class="termbot-dots" aria-hidden="true">
        <span class="termbot-dot termbot-dot-r"></span>
        <span class="termbot-dot termbot-dot-y"></span>
        <span class="termbot-dot termbot-dot-g"></span>
      </span>
      <span class="termbot-title">stephen@portfolio: ~/ask</span>
      <span class="termbot-conn" data-termbot-conn="ready" title="Status"><span class="termbot-conn-dot"></span><span class="termbot-conn-text">ready</span></span>
      <button type="button" class="termbot-close" aria-label="Close terminal">×</button>
    </header>
    <ol class="termbot-scroll" data-termbot-scroll role="log" aria-live="polite"></ol>
    <form class="termbot-form" autocomplete="off">
      <span class="termbot-prompt" aria-hidden="true">$</span>
      <input class="termbot-input" type="text" name="q" placeholder="ask anything about stephen…" aria-label="Ask a question" autocomplete="off" spellcheck="false" maxlength="500"/>
      <span class="termbot-caret" aria-hidden="true"></span>
    </form>
  `;
  document.body.appendChild(panel);

  const scroll = panel.querySelector('[data-termbot-scroll]');
  const input  = panel.querySelector('.termbot-input');
  const form   = panel.querySelector('.termbot-form');
  const close  = panel.querySelector('.termbot-close');
  const conn   = panel.querySelector('[data-termbot-conn]');
  const connText = conn.querySelector('.termbot-conn-text');

  const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const setStatus = (kind, text) => {
    conn.dataset.termbotConn = kind;
    connText.textContent = text;
  };

  const print = (kind, text) => {
    const li = document.createElement('li');
    li.className = `termbot-line termbot-line-${kind}`;
    if (kind === 'user') {
      const p = document.createElement('span');
      p.className = 'termbot-line-prompt';
      p.textContent = '$ ';
      li.appendChild(p);
    } else if (kind === 'system' || kind === 'error') {
      const p = document.createElement('span');
      p.className = 'termbot-line-prompt';
      p.textContent = kind === 'error' ? '!' : '>';
      li.appendChild(p);
    }
    const body = document.createElement('span');
    body.className = 'termbot-line-text';
    body.textContent = text;
    li.appendChild(body);
    scroll.appendChild(li);
    scroll.scrollTop = scroll.scrollHeight;
    return body;
  };

  // Typewriter render: returns a Promise resolved when done.
  const typewriter = (textNode, text, speed = 14) => {
    if (reduceMotion) {
      textNode.textContent = text;
      scroll.scrollTop = scroll.scrollHeight;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let i = 0;
      textNode.textContent = '';
      const tick = () => {
        if (i >= text.length) { resolve(); return; }
        // emit a small batch so the typing isn't painfully slow on long answers
        const batch = Math.max(1, Math.min(4, Math.floor(text.length / 200)));
        textNode.textContent += text.slice(i, i + batch);
        i += batch;
        scroll.scrollTop = scroll.scrollHeight;
        setTimeout(tick, speed);
      };
      tick();
    });
  };

  const HELP = [
    'available commands:',
    "  help    show this message",
    "  clear   clear scrollback",
    "  exit    close terminal",
    '',
    'example questions:',
    "  what is the IEEE big data paper about?",
    "  what's stephen's marine background?",
    "  how do I contact him?",
    "  what are his certifications?",
  ];

  const greeted = { value: false };
  const greet = () => {
    if (greeted.value) return;
    greeted.value = true;
    print('system', 'connecting to stephen@portfolio…');
    print('system', 'connected. ask anything about stephen, his projects, or research.');
    print('system', "type 'help' for tips · 'clear' to reset · 'exit' to close");
    print('blank', '');
  };

  // ---- history ring ----
  const history = [];
  let historyIdx = -1;
  let draft = '';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      if (historyIdx === -1) draft = input.value;
      historyIdx = Math.min(historyIdx + 1, history.length - 1);
      input.value = history[history.length - 1 - historyIdx];
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    } else if (e.key === 'ArrowDown') {
      if (historyIdx === -1) return;
      e.preventDefault();
      historyIdx -= 1;
      input.value = historyIdx === -1 ? draft : history[history.length - 1 - historyIdx];
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    }
  });

  // ---- send a question ----
  const isWorkerConfigured = () => /^https:\/\/[^.]+\.[^.]+\.workers\.dev/i.test(WORKER_URL) && !/YOUR-CF-SUBDOMAIN/.test(WORKER_URL);

  const askWorker = async (question) => {
    setStatus('thinking', 'thinking…');
    const thinking = print('status', '…');
    let dotN = 0;
    const interval = reduceMotion ? null : setInterval(() => {
      dotN = (dotN + 1) % 4;
      thinking.textContent = '.'.repeat(dotN || 1).padEnd(3, ' ');
    }, 220);
    try {
      if (!isWorkerConfigured()) {
        await new Promise((r) => setTimeout(r, 600));
        thinking.parentElement.remove();
        const node = print('output', '');
        await typewriter(node, "the chatbot's backend isn't deployed yet. once the cloudflare worker is live and its url is wired into the site, real answers will land here. in the meantime: StephenGrav@outlook.com.");
        setStatus('idle', 'offline');
        return;
      }
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (interval) clearInterval(interval);
      thinking.parentElement.remove();
      if (!res.ok) {
        const node = print('error', '');
        await typewriter(node, `[${res.status}] ${data && data.error ? data.error : 'request failed'}`);
        setStatus('error', 'error');
        return;
      }
      const answer = (data && data.answer) ? String(data.answer).trim() : '';
      if (!answer) {
        const node = print('error', '');
        await typewriter(node, 'empty response from model');
        setStatus('error', 'error');
        return;
      }
      const node = print('output', '');
      await typewriter(node, answer);
      setStatus('ready', 'ready');
    } catch (e) {
      if (interval) clearInterval(interval);
      if (thinking.parentElement) thinking.parentElement.remove();
      const node = print('error', '');
      await typewriter(node, `network error · ${e && e.message ? e.message : 'unknown'}`);
      setStatus('error', 'error');
    }
  };

  const handleCommand = async (raw) => {
    const cmd = raw.trim();
    if (!cmd) return;
    history.push(cmd);
    historyIdx = -1;
    draft = '';
    print('user', cmd);
    if (cmd === 'help' || cmd === '/help' || cmd === '?') {
      HELP.forEach((line) => print('system', line));
      print('blank', '');
      return;
    }
    if (cmd === 'clear' || cmd === '/clear') {
      scroll.innerHTML = '';
      greeted.value = false;
      greet();
      return;
    }
    if (cmd === 'exit' || cmd === '/exit' || cmd === 'quit' || cmd === ':q') {
      closePanel();
      return;
    }
    await askWorker(cmd);
    print('blank', '');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    handleCommand(v);
  });

  // ---- panel open/close ----
  const openPanel = () => {
    if (!panel.hidden) return;
    panel.hidden = false;
    document.body.classList.add('termbot-open');
    launcher.setAttribute('aria-expanded', 'true');
    greet();
    setTimeout(() => input.focus(), 60);
  };
  const closePanel = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove('termbot-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  };

  launcher.addEventListener('click', () => {
    if (panel.hidden) openPanel(); else closePanel();
  });
  close.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      // Don't fight the command palette which has its own Esc handler running first
      if (document.body.classList.contains('vsc-palette-open')) return;
      closePanel();
    }
  });
})();
