// 视图层：纯函数，返回 HTML 字符串
import { esc, fmt, STAR_ICON } from './format.js';

function splitRepo(full) {
  const parts = String(full || '').split('/');
  return parts.length > 1
    ? { owner: parts[0], name: parts.slice(1).join('/') }
    : { owner: '', name: full };
}

export function cardHTML(it, i) {
  const { owner, name } = splitRepo(it.repo);
  const tags = [
    it.language ? `<span class="tag lang">${esc(it.language)}</span>` : '',
    ...(it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`)
  ].join('');

  return `<article class="card reveal" style="--i:${i}">
    <div class="card-top">
      <div class="repo">${owner ? `<span class="owner">${esc(owner)}/</span>` : ''}<span class="name">${esc(name)}</span></div>
      <div class="star">${STAR_ICON}<span class="num" data-value="${Number(it.stars) || 0}">0</span></div>
    </div>
    ${it.stars_today ? `<span class="today">今日 +${fmt(it.stars_today)}</span>` : ''}
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

export function archiveHTML(days) {
  if (!days.length) return '';
  return `<div class="section-head"><h2>往期</h2></div>
    <div class="arc-list">${days.map((d, i) => `
      <div class="arc-row reveal" style="--i:${i}">
        <span class="arc-date">${esc(d.date)}</span>
        <span class="arc-names">${d.items.map(it =>
          `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.repo)}</a>`).join('')}</span>
      </div>`).join('')}</div>`;
}
