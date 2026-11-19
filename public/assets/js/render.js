// 视图层：纯函数，返回 HTML 字符串
import { esc, fmt, STAR_ICON } from './format.js';

function splitRepo(full) {
  const parts = String(full || '').split('/');
  return parts.length > 1
    ? { owner: parts[0], name: parts.slice(1).join('/') }
    : { owner: '', name: full };
}

const detailHref = repo => `detail.html?r=${encodeURIComponent(repo)}`;

export function cardHTML(it, i, dateLabel) {
  const { owner, name } = splitRepo(it.repo);
  const href = detailHref(it.repo);
  const tags = [
    it.language ? `<span class="tag lang">${esc(it.language)}</span>` : '',
    ...(it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`)
  ].join('');

  return `<article class="card reveal" style="--i:${i}" data-href="${esc(href)}">
    <div class="card-top">
      <div class="repo"><a class="repo-link" href="${esc(href)}">${owner ? `<span class="owner">${esc(owner)}/</span>` : ''}<span class="name">${esc(name)}</span></a></div>
      <div class="star">${STAR_ICON}<span class="num" data-value="${Number(it.stars) || 0}">0</span></div>
    </div>
    ${it.stars_today ? `<span class="today">今日 +${fmt(it.stars_today)}</span>` : ''}
    ${dateLabel ? `<span class="card-date">${esc(dateLabel)}</span>` : ''}
    <p class="summary">${esc(it.summary)}</p>
    <dl class="facts">
      <div class="row"><dt>亮点</dt><dd>${esc(it.highlight)}</dd></div>
      <div class="row"><dt>适合</dt><dd>${esc(it.fit)}</dd></div>
    </dl>
    <div class="card-foot">
      <div class="tags">${tags}</div>
    </div>
    <span class="card-arrow" aria-hidden="true">→</span>
  </article>`;
}

export function archiveHTML(days) {
  if (!days.length) return '';
  return `<div class="section-head"><h2>往期</h2><span class="date">共 ${days.length} 期</span></div>
    ${days.map((d, di) => `
      <section class="arc-day reveal" style="--i:${di}">
        <div class="arc-day-head">
          <span class="arc-date">${esc(d.date)}</span>
          <span class="arc-count">${d.items.length} 个仓库</span>
        </div>
        <div class="cards arc">${d.items.map((it, i) => cardHTML(it, i)).join('')}</div>
      </section>`).join('')}`;
}
