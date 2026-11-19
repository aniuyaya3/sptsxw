// 详情页：定位 / 亮点 / 怎么用
import { esc, fmt } from './format.js';

const $ = s => document.querySelector(s);
const param = new URLSearchParams(location.search).get('r') || '';
const slug = r => r.replace(/\//g, '__');
const detailHref = r => `detail.html?r=${encodeURIComponent(r)}`;

function codeBlock(code) {
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  return `<div class="d-code"><pre id="${id}"><code>${esc(code)}</code></pre>
    <button class="d-copy" data-target="${id}">复制</button></div>`;
}

function bindCopy() {
  document.querySelectorAll('.d-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pre = document.getElementById(btn.dataset.target);
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.innerText);
        btn.textContent = '已复制';
        btn.classList.add('ok');
        setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('ok'); }, 1600);
      } catch { btn.textContent = '复制失败'; }
    });
  });
}

function renderMore(days, date, current) {
  const day = days.find(d => d.date === date);
  if (!day) return;
  const others = day.items.filter(it => it.repo !== current);
  if (!others.length) return;
  $('#dMore').innerHTML = `<div class="section-head"><h2>同期其他作品</h2><span class="date">${esc(date)}</span></div>
    <div class="d-more-list">${others.map(it => `
      <a class="d-more-item" href="${detailHref(it.repo)}">
        <b>${esc(it.repo)}</b>
        <span>${esc(it.summary)}</span>
      </a>`).join('')}</div>`;
}

async function main() {
  if (!param) {
    $('#dTitle').textContent = '缺少参数';
    $('#dSummary').textContent = '请从首页点击任意作品进入。';
    return;
  }

  const [detail, picks] = await Promise.all([
    fetch(`data/details/${encodeURIComponent(slug(param))}.json`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('data/picks.json').then(r => r.json())
  ]);

  let item = null, date = '';
  for (const d of picks.days || []) {
    const hit = (d.items || []).find(i => i.repo.toLowerCase() === param.toLowerCase());
    if (hit) { item = hit; date = d.date; break; }
  }
  if (!item && !detail) {
    $('#dTitle').textContent = param;
    $('#dSummary').textContent = '没找到这个仓库的记录。';
    return;
  }

  const repo = item?.repo || detail?.repo || param;
  const [owner, ...rest] = repo.split('/');
  const name = rest.join('/');

  document.title = `${repo} 怎么用 — VideoGen Daily`;
  $('#dDate').textContent = date ? `收录于 ${date}` : '历史作品';
  $('#dTitle').innerHTML = `<span class="d-owner">${esc(owner)}/</span>${esc(name)}`;
  $('#dSummary').textContent = item?.summary || detail?.intro || '';

  const chips = [];
  if (item?.stars) chips.push(`<span class="d-chip star">★ ${fmt(item.stars)}</span>`);
  if (item?.language) chips.push(`<span class="d-chip lang">${esc(item.language)}</span>`);
  (item?.tags || []).forEach(t => chips.push(`<span class="d-chip">${esc(t)}</span>`));
  $('#dMeta').innerHTML = chips.join('');

  $('#dHighlight').textContent = item?.highlight || '—';
  $('#dFit').textContent = item?.fit || '—';
  $('#dTags').innerHTML = (item?.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')
    || `<span class="tag">${esc(item?.language || '开源')}</span>`;

  const intro = detail?.intro && detail.intro.length > 40 ? detail.intro : '';
  if (intro) $('#dIntro').textContent = intro;
  else $('#dIntroBlock').hidden = true;

  const steps = detail?.steps || [];
  if (steps.length) {
    $('#dSteps').innerHTML = steps.map(s => `
      <li>
        <p class="d-step-title">${esc(s.title)}</p>
        ${codeBlock(s.code)}
      </li>`).join('');
    bindCopy();
  } else {
    $('#dSteps').innerHTML = `<li class="d-empty">README 里没找到可直接复制的命令，建议先看项目首页的 Getting Started。</li>`;
  }

  const reqs = (detail?.requirements || []).slice(0, 5);
  if (reqs.length) {
    $('#dReqs').innerHTML = reqs.map(r => `<li>${esc(r)}</li>`).join('');
    $('#dReqBlock').hidden = false;
  }

  const docs = detail?.docs || [];
  if (docs.length) {
    $('#dDocs').innerHTML = docs.map(d =>
      `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a></li>`).join('');
    $('#dDocsBlock').hidden = false;
  }

  $('#dGh').href = item?.url || detail?.url || `https://github.com/${repo}`;

  renderMore(picks.days || [], date, repo);
}

main().catch(err => {
  $('#dTitle').textContent = '加载失败';
  $('#dSummary').textContent = err.message;
});
