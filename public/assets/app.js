const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'k' : String(Math.round(n));

const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.4 9.6l6.7-.9L12 2.6z"/></svg>';

/* ---------- count-up ---------- */
function countUp(el, to, {dur = 900, fmtFn = fmt} = {}) {
  if (reduce) { el.textContent = fmtFn(to); return; }
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtFn(to * e);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = fmtFn(to);
  };
  requestAnimationFrame(tick);
}

/* ---------- reveal ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
    const num = en.target.querySelector('.star .num');
    if (num && num.dataset.value) countUp(num, Number(num.dataset.value));
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

/* ---------- card ---------- */
function card(it, i) {
  const parts = String(it.repo || '').split('/');
  const owner = parts.length > 1 ? parts[0] : '';
  const name = parts.length > 1 ? parts.slice(1).join('/') : it.repo;

  const today = it.stars_today
    ? `<span class="today">今日 +${fmt(it.stars_today)}</span>` : '';

  const tags = [
    it.language ? `<span class="tag lang">${esc(it.language)}</span>` : '',
    ...(it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`)
  ].join('');

  return `<article class="card reveal" style="--i:${i}">
    <div class="card-top">
      <div class="repo">${owner ? `<span class="owner">${esc(owner)}/</span>` : ''}<span class="name">${esc(name)}</span></div>
      <div class="star">${STAR}<span class="num" data-value="${Number(it.stars) || 0}">0</span></div>
    </div>
    ${today}
    <p class="summary">${esc(it.summary)}</p>
    <dl class="facts">
      <div class="row"><dt>亮点</dt><dd>${esc(it.highlight)}</dd></div>
      <div class="row"><dt>适合</dt><dd>${esc(it.fit)}</dd></div>
    </dl>
    <div class="card-foot">
      <div class="tags">${tags}</div>
      <a class="go" href="${esc(it.url)}" target="_blank" rel="noopener">GitHub <span>↗</span></a>
    </div>
  </article>`;
}

/* ---------- spotlight ---------- */
function attachSpotlight(root) {
  root.querySelectorAll('.card:not(.skeleton)').forEach(cardEl => {
    cardEl.addEventListener('pointermove', e => {
      const r = cardEl.getBoundingClientRect();
      cardEl.style.setProperty('--mx', `${e.clientX - r.left}px`);
      cardEl.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ---------- render ---------- */
async function main() {
  const res = await fetch('data/picks.json', { cache: 'no-store' });
  const data = await res.json();
  const days = (data.days || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  if (!days.length) {
    $('#cards').innerHTML = '<p style="color:var(--muted)">暂无数据</p>';
    return;
  }

  const latest = days[0];
  $('#cards').innerHTML = latest.items.map(card).join('');
  $('#latestDate').textContent = latest.date.replace(/-/g, ' · ');
  $('#navDate').textContent = latest.date;

  const totalRepos = days.reduce((n, d) => n + d.items.length, 0);
  const totalStars = days.reduce((n, d) => n + d.items.reduce((m, i) => m + (Number(i.stars) || 0), 0), 0);
  countUp($('#statRepos'), totalRepos, { fmtFn: n => String(Math.round(n)) });
  countUp($('#statIssues'), days.length, { fmtFn: n => String(Math.round(n)) });
  countUp($('#statStars'), totalStars);

  const rest = days.slice(1);
  if (rest.length) {
    $('#archive').innerHTML = `<div class="section-head"><h2>往期</h2></div>
      <div class="arc-list">${rest.map((d, i) => `
        <div class="arc-row reveal" style="--i:${i}">
          <span class="arc-date">${esc(d.date)}</span>
          <span class="arc-names">${d.items.map(it => `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.repo)}</a>`).join('')}</span>
        </div>`).join('')}</div>`;
  }

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  attachSpotlight(document);
}

/* ---------- nav state ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

main().catch(err => {
  $('#cards').innerHTML = `<p style="color:var(--muted)">数据加载失败：${esc(err.message)}</p>`;
});
