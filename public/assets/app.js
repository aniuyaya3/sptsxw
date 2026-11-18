const fmt = n => n >= 1000 ? (n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'') + 'k' : String(n);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function card(it){
  const delta = it.stars_today ? `<span class="delta">今日 +${fmt(it.stars_today)}</span>` : '';
  const tags = [
    it.language ? `<span class="tag lang">${esc(it.language)}</span>` : '',
    ...(it.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`)
  ].join('');
  return `<article class="card">
    <div class="top">
      <h3><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.repo)}</a></h3>
      <span class="stars">★ ${fmt(it.stars)}</span>
    </div>
    ${it.stars_today ? `<div>${delta}</div>` : ''}
    <p class="desc">${esc(it.summary)}</p>
    <p class="hl"><b>亮点</b> · ${esc(it.highlight)}</p>
    <p class="hl"><b>适合</b> · ${esc(it.fit)}</p>
    <div class="tags">${tags}</div>
  </article>`;
}

function dayBlock(day, isToday){
  const head = `<div class="day-head">
    <span class="date">${esc(day.date)}</span>
    ${isToday ? '<span class="badge">今日</span>' : ''}
    <span class="count">${day.items.length} 个仓库</span>
  </div>`;
  return `${head}<div class="cards">${day.items.map(card).join('')}</div>`;
}

async function main(){
  const res = await fetch('data/picks.json', {cache:'no-store'});
  const data = await res.json();
  const days = (data.days||[]).slice().sort((a,b)=> b.date.localeCompare(a.date));
  if(!days.length){ document.getElementById('today').innerHTML = '<p class="empty">暂无数据</p>'; return; }

  document.getElementById('today').innerHTML = dayBlock(days[0], true);
  const iso = String(data.updated||'');
  document.getElementById('updated').textContent = iso ? '更新于 ' + iso.slice(0,16).replace('T',' ') : '';
  const total = days.reduce((n,d)=>n+d.items.length,0);
  document.getElementById('total').textContent = `累计 ${total} 个仓库 · ${days.length} 期`;

  const rest = days.slice(1);
  if(rest.length){
    document.getElementById('archive').innerHTML = `<div class="archive">
      <h2>往期</h2>
      ${rest.map(d=>`<div class="row">
        <span class="d">${esc(d.date)}</span>
        <span class="names">${d.items.map(i=>`<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.repo)}</a>`).join('')}</span>
      </div>`).join('')}
    </div>`;
  }
}
main().catch(e=>{ document.getElementById('today').innerHTML = '<p class="empty">数据加载失败：'+esc(e.message)+'</p>'; });
