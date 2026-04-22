(() => {
  const container = document.getElementById('net-topology');
  if (!container) return;
  const tooltip = container.querySelector('.net-tooltip');
  const nodes = container.querySelectorAll('[data-net-title]');

  const show = (e, node) => {
    if (!tooltip) return;
    const rect = container.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${node.getAttribute('data-net-title')}</strong><span>${node.getAttribute('data-net-info') || ''}</span>`;
    tooltip.style.display = 'block';
    const x = e.clientX - rect.left + 16;
    const y = e.clientY - rect.top + 16;
    tooltip.style.left = Math.min(x, rect.width - 220) + 'px';
    tooltip.style.top = Math.min(y, rect.height - 60) + 'px';
  };

  const hide = () => {
    if (tooltip) tooltip.style.display = 'none';
    nodes.forEach((n) => n.classList.remove('is-active'));
  };

  nodes.forEach((node) => {
    node.addEventListener('pointerenter', (e) => {
      node.classList.add('is-active');
      show(e, node);
    });
    node.addEventListener('pointermove', (e) => show(e, node));
    node.addEventListener('pointerleave', hide);
    node.addEventListener('focus', (e) => {
      node.classList.add('is-active');
      const rect = node.getBoundingClientRect();
      show({ clientX: rect.left + rect.width / 2, clientY: rect.top }, node);
    });
    node.addEventListener('blur', hide);
  });

  container.addEventListener('pointerleave', hide);
})();
