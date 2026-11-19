// 日历：有内容的日期底部绿点，点击回调日期
import { esc } from './format.js';

const DOW = ['一', '二', '三', '四', '五', '六', '日'];

export function monthLabel(y, m) { return `${y} 年 ${m + 1} 月`; }

export function shiftMonth(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return [d.getFullYear(), d.getMonth()];
}

export function renderCalendar(el, opts) {
  const { year, month, dates, selected, today } = opts;
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // 周一开头
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span class="cal-day is-empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    const cls = ['cal-day'];
    if (dates.has(iso)) cls.push('has');
    if (iso === selected) cls.push('sel');
    if (iso === today) cls.push('today');
    cells += `<button class="${cls.join(' ')}" data-date="${iso}" ${dates.has(iso) ? '' : 'aria-disabled="true"'}>
      <span class="cal-num">${d}</span>${dates.has(iso) ? '<i class="cal-dot"></i>' : ''}
    </button>`;
  }

  el.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" data-step="-1" aria-label="上个月">‹</button>
      <span class="cal-title">${esc(monthLabel(year, month))}</span>
      <button class="cal-nav" data-step="1" aria-label="下个月">›</button>
    </div>
    <div class="cal-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <p class="cal-tip">绿点是有内容的日期 · 共 ${dates.size} 期</p>`;
}
