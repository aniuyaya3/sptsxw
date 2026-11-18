// 数据层：拉取 + 归一化 + 排序，不碰 DOM
export async function loadPicks(url = 'data/picks.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const days = (raw.days || [])
    .filter(d => d && d.date && Array.isArray(d.items))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { days, updated: raw.updated || '' };
}

export function summarize(days) {
  const repos = days.reduce((n, d) => n + d.items.length, 0);
  const stars = days.reduce((n, d) => n + d.items.reduce((m, i) => m + (Number(i.stars) || 0), 0), 0);
  return { repos, issues: days.length, stars };
}
