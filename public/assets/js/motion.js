// 动效层：数字滚动 / 滚动渐显 / 光标聚光 / 导航状态
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function countUp(el, to, { dur = 900, format = String } = {}) {
  if (!el) return;
  if (reduce) { el.textContent = format(to); return; }
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = format(to * e);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = format(to);
  };
  requestAnimationFrame(tick);
}

let io;
export function observeReveals(root = document, onReveal) {
  io = io || new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
      const num = en.target.querySelector('.star .num');
      if (num && num.dataset.value) countUp(num, Number(num.dataset.value), { format: n => formatStars(n) });
      onReveal && onReveal(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  root.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

let formatStars = String;
export function setStarFormatter(fn) { formatStars = fn; }

export function attachSpotlight(root = document) {
  if (reduce) return;
  root.querySelectorAll('.card:not(.skeleton)').forEach(cardEl => {
    if (cardEl.dataset.spot) return;
    cardEl.dataset.spot = '1';
    cardEl.addEventListener('pointermove', e => {
      const r = cardEl.getBoundingClientRect();
      cardEl.style.setProperty('--mx', `${e.clientX - r.left}px`);
      cardEl.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

export function initNav(navEl) {
  if (!navEl) return;
  const onScroll = () => navEl.classList.toggle('scrolled', window.scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
