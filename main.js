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
