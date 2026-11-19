import { loadPicks, summarize } from './data.js';
import { cardHTML, archiveHTML } from './render.js';
import { fmt, esc } from './format.js';
import { countUp, observeReveals, attachSpotlight, initNav, setStarFormatter } from './motion.js';

const $ = s => document.querySelector(s);

setStarFormatter(fmt);
initNav($('#nav'));

async function main() {
  const { days } = await loadPicks();

  if (!days.length) {
    $('#cards').innerHTML = '<p style="color:var(--muted)">暂无数据</p>';
    return;
  }

  const [latest, ...rest] = days;

  $('#cards').innerHTML = latest.items.map(cardHTML).join('');
  $('#latestDate').textContent = latest.date.replace(/-/g, ' · ');
  $('#navDate').textContent = latest.date;

  const s = summarize(days);
  countUp($('#statRepos'), s.repos, { format: n => String(Math.round(n)) });
  countUp($('#statIssues'), s.issues, { format: n => String(Math.round(n)) });
  countUp($('#statStars'), s.stars, { format: fmt });

  if (rest.length) $('#archive').innerHTML = archiveHTML(rest);

  document.querySelector('#cards').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.card[data-href]');
    if (card) location.href = card.dataset.href;
  });

  observeReveals(document);
  attachSpotlight(document);
}

main().catch(err => {
  $('#cards').innerHTML = `<p style="color:var(--muted)">数据加载失败：${esc(err.message)}</p>`;
});
