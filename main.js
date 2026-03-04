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
