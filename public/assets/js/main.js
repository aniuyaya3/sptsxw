import { loadPicks, summarize } from './data.js';
import { cardHTML, archiveHTML } from './render.js';
import { fmt, esc } from './format.js';
import { countUp, observeReveals, attachSpotlight, initNav, setStarFormatter } from './motion.js';
import { DIMS, classify, tagMeta, itemsByTag } from './taxonomy.js';
import { renderCalendar, shiftMonth } from './calendar.js';

const $ = s => document.querySelector(s);
setStarFormatter(fmt);
initNav($('#nav'));

let DAYS = [];
let DATES = new Set();
let cal = { year: 0, month: 0 };
let selectedDate = '';

const todayISO = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------------- 视图 ---------------- */

function afterRender(scroll) {
  observeReveals(document);
  attachSpotlight($('#cards'));
  if (scroll) $('.latest').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showLatest(scroll = false) {
  const [latest, ...rest] = DAYS;
  $('#sectionTitle').textContent = '最新一期';
  $('#latestDate').textContent = latest.date.replace(/-/g, ' · ');
  $('#navDateText').textContent = latest.date;
  $('#viewBar').hidden = true;
  selectedDate = latest.date;

  $('#cards').innerHTML = latest.items.map((it, i) => cardHTML(it, i)).join('');
  const arch = $('#archive');
  arch.style.display = '';
  arch.innerHTML = rest.length ? archiveHTML(rest) : '';
  afterRender(scroll);
}

function showDay(date) {
  const day = DAYS.find(d => d.date === date);
  if (!day) return;
  selectedDate = date;
  $('#sectionTitle').textContent = '当日作品';
  $('#latestDate').textContent = date.replace(/-/g, ' · ');
  $('#navDateText').textContent = date;
  $('#cards').innerHTML = day.items.map((it, i) => cardHTML(it, i)).join('');
  $('#archive').style.display = 'none';
  $('#viewBar').hidden = false;
  $('#viewText').textContent = `正在查看 ${date} 的作品（${day.items.length} 个）`;
  afterRender(true);
}

function showTag(tagId) {
  const meta = tagMeta(tagId);
  const items = itemsByTag(DAYS, tagId);
  selectedDate = '';
  $('#sectionTitle').textContent = meta.label;
  $('#latestDate').textContent = `${items.length} 个作品`;
  $('#navDateText').textContent = '全部日期';
  $('#cards').innerHTML = items.length
    ? items.map((it, i) => cardHTML(it, i, it.date)).join('')
    : '<p class="empty-hint">这个分类下暂时没有作品。</p>';
  $('#archive').style.display = 'none';
  $('#viewBar').hidden = false;
  $('#viewText').textContent = `分类：${meta.label} · ${meta.dim}`;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.tag === tagId));
  afterRender(true);
}

/* ---------------- 分类标签 ---------------- */

function buildTags() {
  const host = $('#heroTags');
  const total = DAYS.reduce((n, d) => n + d.items.length, 0);
  const parts = DIMS.map(dim => {
    const chips = dim.tags
      .map(t => ({ t, n: itemsByTag(DAYS, t.id).length }))
      .filter(x => x.n > 0)
      .map(x => `<button class="chip" data-tag="${x.t.id}">
        <span>${esc(x.t.label)}</span><i>${x.n}</i>
      </button>`).join('');
    if (!chips) return '';
    return `<div class="dim">
      <span class="dim-label">${esc(dim.label)}</span>
      <div class="chips">${chips}</div>
    </div>`;
  }).join('');

  host.innerHTML = `<div class="tags-head">
      <span>按分类浏览</span>
      <em>${DAYS.length} 期 · ${total} 个作品</em>
    </div>${parts}`;

  host.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) showTag(chip.dataset.tag);
  });
}

/* ---------------- 日历 ---------------- */

function paintCalendar() {
  renderCalendar($('#calPop'), {
    year: cal.year,
    month: cal.month,
    dates: DATES,
    selected: selectedDate,
    today: todayISO(),
  });
}

function openCalendar(open) {
  const pop = $('#calPop');
  const btn = $('#navDate');
  pop.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) paintCalendar();
}

function initCalendarUI() {
  const btn = $('#navDate');
  const pop = $('#calPop');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    openCalendar(pop.hidden);
  });

  pop.addEventListener('click', e => {
    e.stopPropagation();
    const nav = e.target.closest('.cal-nav');
    if (nav) {
      const [y, m] = shiftMonth(cal.year, cal.month, Number(nav.dataset.step));
      cal.year = y; cal.month = m;
      paintCalendar();
      return;
    }
    const day = e.target.closest('.cal-day.has');
    if (day) {
      openCalendar(false);
      showDay(day.dataset.date);
    }
  });

  document.addEventListener('click', () => openCalendar(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') openCalendar(false);
  });

  $('#viewClear').addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    showLatest(true);
  });
}

/* ---------------- 启动 ---------------- */

async function main() {
  const { days } = await loadPicks();
  DAYS = days || [];
  if (!DAYS.length) {
    $('#cards').innerHTML = '<p class="empty-hint">暂无数据</p>';
    return;
  }
  DATES = new Set(DAYS.map(d => d.date));
  const [y, m] = DAYS[0].date.split('-').map(Number);
  cal.year = y; cal.month = m - 1;

  buildTags();
  initCalendarUI();
  showLatest();

  const s = summarize(DAYS);
  countUp($('#statRepos'), s.repos, { format: n => String(Math.round(n)) });
  countUp($('#statIssues'), s.issues, { format: n => String(Math.round(n)) });
  countUp($('#statStars'), s.stars, { format: fmt });

  $('#cards').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.card[data-href]');
    if (card) location.href = card.dataset.href;
  });
}

main().catch(err => {
  $('#cards').innerHTML = `<p class="empty-hint">数据加载失败：${esc(err.message)}</p>`;
});
