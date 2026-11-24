// 実データ（日本株・米国株・暗号資産・ニュース）の表示
// 株価・ニュース: GitHub Actions が market-data ブランチに保存する JSON
// 暗号資産: CoinGecko API からブラウザで直接取得（1分ごと）
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const qs = new URLSearchParams(location.search);
const REPO = qs.get('repo') || (/\.github\.io$/.test(location.hostname)
  ? location.hostname.split('.')[0] + '/' + (location.pathname.split('/').filter(Boolean)[0] || '')
  : 'ru540044-ops/creprin');
const DATA_URL = qs.get('data') || `https://raw.githubusercontent.com/${REPO}/market-data/market.json`;
const CG = 'https://api.coingecko.com/api/v3';
const WKEY = 'market-watch-v1', VKEY = 'market-view-v1';

const S = {
  data:null, dataErr:null, ai:null, aiErr:null, dataAt:0, cg:null, cgErr:null, cgAt:0, trend:[],
  view:'mkt', mk:'jp', mode:'heat', per:'c1', sort:'score', q:'', pickMk:'all', newsCat:'all',
  watch: load(WKEY, []),
};
Object.assign(S, load(VKEY, {}));
function load(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const saveView = () => save(VKEY, { view:S.view, mk:S.mk, mode:S.mode, per:S.per, sort:S.sort, pickMk:S.pickMk, newsCat:S.newsCat });

// ---------------------------------------------------------------- 書式
const MK_NAME = { jp:'日本株', us:'米国株', crypto:'暗号資産' };
const CUR = { jp:'¥', us:'$', crypto:'¥', idx:'' };
const mkOf = tk => tk.startsWith('cg:') || tk.endsWith('-JPY') ? 'crypto' : tk.endsWith('.T') ? 'jp' : /[\^=]/.test(tk) ? 'idx' : 'us';
function fp(v, mk){
  if (v == null || !isFinite(v)) return '-';
  const a = Math.abs(v), d = a >= 1000 ? 0 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 8;
  return (CUR[mk] ?? '') + v.toLocaleString('ja-JP', { minimumFractionDigits: a >= 1000 ? 0 : Math.min(d, 2), maximumFractionDigits:d });
}
const pc = v => v == null || !isFinite(v) ? '-' : (v >= 0 ? '+' : '') + (v*100).toFixed(2) + '%';
const cl = v => v == null ? 'muted' : v > 0 ? 'up' : v < 0 ? 'down' : 'muted';
const big = v => v == null ? '-' : v >= 1e12 ? (v/1e12).toFixed(2) + '兆' : v >= 1e8 ? (v/1e8).toFixed(1) + '億' : v >= 1e4 ? (v/1e4).toFixed(0) + '万' : String(Math.round(v));
function ago(t){
  if (!t) return '';
  const s = (Date.now() - new Date(t).getTime())/1000;
  if (!isFinite(s)) return '';
  return s < 60 ? 'たった今' : s < 3600 ? `${Math.floor(s/60)}分前` : s < 86400 ? `${Math.floor(s/3600)}時間前` : `${Math.floor(s/86400)}日前`;
}
const scoreCls = s => s >= 70 ? 'hi' : s >= 55 ? 'mid' : 'lo';
function spark(arr, w=90, h=26){
  const a = (arr || []).filter(v => v != null); if (a.length < 2) return '';
  const mn = Math.min(...a), mx = Math.max(...a), r = mx - mn || 1;
  const pts = a.map((v,i) => `${(i/(a.length-1)*w).toFixed(1)},${(h - 2 - (v-mn)/r*(h-4)).toFixed(1)}`).join(' ');
  const col = a[a.length-1] >= a[0] ? '#00e5a0' : '#ff3b6b';
  return `<svg class="spk" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.5" points="${pts}"/></svg>`;
}
function toast(t, cls=''){
  const box = $('toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = t;
  box.appendChild(el); setTimeout(() => el.remove(), 5000);
}

// ---------------------------------------------------------------- データ取得
async function loadData(){
  try {
    const r = await fetch(DATA_URL + '?t=' + Math.floor(Date.now()/60000), { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    S.data = await r.json(); S.dataErr = null; S.dataAt = Date.now();
  } catch (e) { S.dataErr = String(e.message || e); }
  afterUpdate();
}
async function loadCG(){
  if (document.hidden && S.cg) return;
  try {
    const r = await fetch(`${CG}/coins/markets?vs_currency=jpy&order=market_cap_desc&per_page=60&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d`);
    if (!r.ok) throw new Error(r.status === 429 ? '利用制限中（しばらく待って再取得）' : 'HTTP ' + r.status);
    const j = await r.json(); if (!Array.isArray(j)) throw new Error('unexpected');
    S.cg = j; S.cgErr = null; S.cgAt = Date.now();
  } catch (e) { S.cgErr = String(e.message || e); }
  afterUpdate();
}
async function loadTrending(){
  try {
    const r = await fetch(`${CG}/search/trending`); if (!r.ok) return;
    const j = await r.json();
    S.trend = (j.coins || []).slice(0, 10).map(x => x.item).map(it => ({ id:it.id, sym:it.symbol, name:it.name, img:it.thumb, c1: it.data?.price_change_percentage_24h?.jpy ?? it.data?.price_change_percentage_24h?.usd }));
    if (S.view === 'mkt' && S.mk === 'crypto') render();
  } catch {}
}

// ---------------------------------------------------------------- 行データ
const n100 = v => v == null ? null : v/100;
function cgScore(c){
  const a = n100(c.price_change_percentage_24h_in_currency) ?? 0, b = n100(c.price_change_percentage_7d_in_currency) ?? 0, d = n100(c.price_change_percentage_30d_in_currency) ?? 0;
  return Math.max(0, Math.min(100, Math.round(50 + a*250 + b*120 + d*50)));
}
function cgWhy(c){
  const w = [], a = n100(c.price_change_percentage_24h_in_currency), b = n100(c.price_change_percentage_7d_in_currency);
  if (a != null && a > 0.05) w.push(`24時間で${pc(a)}`);
  if (b != null && b > 0.1) w.push(`7日で${pc(b)}`);
  if (c.ath && c.current_price >= c.ath*0.9) w.push('過去最高値圏');
  return w;
}
function cryptoRows(){
  const yfRows = S.data?.markets?.crypto || [];
  if (!S.cg) return yfRows.map(r => ({ ...r, mk:'crypto' }));
  const bySym = Object.fromEntries(yfRows.map(r => [r.tk.split('-')[0].replace(/\d+$/, ''), r]));
  return S.cg.map(c => {
    const y = bySym[c.symbol.toUpperCase()], sp = c.sparkline_in_7d?.price || [];
    return {
      tk:'cg:' + c.id, cg:c.id, yf:y?.tk, sym:c.symbol.toUpperCase(), name: y?.name || c.name, img:c.image, mk:'crypto', live:true,
      price:c.current_price, c1h:n100(c.price_change_percentage_1h_in_currency), c1:n100(c.price_change_percentage_24h_in_currency),
      c5:n100(c.price_change_percentage_7d_in_currency), c21:n100(c.price_change_percentage_30d_in_currency), c63:y?.c63,
      mcap:c.market_cap, vol:c.total_volume, rank:c.market_cap_rank,
      rsi:y?.rsi, volr:y?.volr, sig:y?.sig || [], score: y ? Math.round(y.score*0.6 + cgScore(c)*0.4) : cgScore(c),
      why: (y?.why || []).concat(cgWhy(c)).slice(0, 4),
      px0: y?.price, hi52: y?.hi52, lo52: y?.lo52, fromHi: y?.fromHi ?? (c.ath ? c.current_price/c.ath - 1 : null), atrp: y?.atrp, sma25: y?.sma25, sma75: y?.sma75,
      spark: sp.filter((_, i) => i % 4 === 0),
    };
  });
}
const rowsOf = mk => mk === 'crypto' ? cryptoRows() : (S.data?.markets?.[mk] || []).map(r => ({ ...r, mk }));
function findRow(tk){
  for (const mk of ['jp','us','crypto']){ const r = rowsOf(mk).find(x => x.tk === tk || x.yf === tk); if (r) return r; }
  const i = (S.data?.indices || []).find(x => x.tk === tk);
  return i ? { ...i, mk:'idx' } : null;
}
const isWatched = tk => S.watch.some(w => w.tk === tk);
function toggleWatch(tk){
  const i = S.watch.findIndex(w => w.tk === tk);
  if (i >= 0){ S.watch.splice(i, 1); toast('ウォッチリストから削除しました'); }
  else { const r = findRow(tk); S.watch.push({ tk, name:r?.name || tk, base:r?.price ?? null, at:Date.now(), above:null, below:null, note:'' }); toast(`⭐ ${r?.name || tk} をウォッチリストに追加`); }
  save(WKEY, S.watch); render(); if (!$('detail').hidden) openDetail(curDetail, true);
}

// ---------------------------------------------------------------- 共通 UI
function setupCard(){
  return `<div class="setup"><h3>📡 株価・ニュースのデータがまだありません</h3>
  <p>日本株・米国株・ニュースは GitHub Actions が30分ごとに集めて保存します。最初の1回だけ次の手順が必要です。</p>
  <ol><li>この変更を含むブランチを <b>main（既定ブランチ）にマージ</b>する</li>
  <li><a href="https://github.com/${esc(REPO)}/actions/workflows/market-data.yml" target="_blank" rel="noopener">Actions の「Market data」</a> を開き、<b>Run workflow</b> を押す</li>
  <li>2〜3分後にこのページを再読み込み</li></ol>
  <p class="muted">取得先: <code>${esc(DATA_URL)}</code>（${esc(S.dataErr || '')}）<br>暗号資産は CoinGecko から直接取得しているので、この手順なしでも表示されます。</p></div>`;
}
function renderBar(){
  const d = S.data, parts = [];
  if (d){
    const stale = Date.now() - new Date(d.updated).getTime() > 2*3600e3;
    parts.push(`<span><i class="dot ${stale ? 'warn' : 'live'}"></i>株価・ニュース: ${new Date(d.updated).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })} 更新（${ago(d.updated)}）</span>`);
    if (d.synthetic) parts.push('<span class="warn">⚠ サンプルデータ表示中</span>');
  } else parts.push(`<span><i class="dot err"></i>株価・ニュース: 未取得</span>`);
  parts.push(S.cg ? `<span><i class="dot live"></i>暗号資産: ライブ（${ago(S.cgAt)}）</span>` : `<span><i class="dot ${S.cgErr ? 'err' : ''}"></i>暗号資産: ${S.cgErr ? 'CoinGecko 取得失敗 ' + esc(S.cgErr) : '取得中…'}</span>`);
  parts.push('<span class="muted">※ 情報提供のみ。投資判断はご自身で。</span>');
  $('dataBar').innerHTML = parts.join('');
}

// ---------------------------------------------------------------- マーケット
const SORTS = {
  score:['スコア順', r => -(r.score ?? -1)], up1:['値上がり率（1日）', r => -(r.c1 ?? -9)], dn1:['値下がり率（1日）', r => (r.c1 ?? 9)],
  up5:['上昇率（1週）', r => -(r.c5 ?? -9)], up21:['上昇率（1ヶ月）', r => -(r.c21 ?? -9)], vol:['出来高急増', r => -(r.volr ?? -1)],
  rsi:['RSI 高い順', r => -(r.rsi ?? -1)], cap:['時価総額（暗号資産）', r => -(r.mcap ?? 0)],
};
function filtered(mk){
  const q = S.q.trim().toLowerCase();
  let rows = rowsOf(mk);
  if (q) rows = rows.filter(r => (r.name + ' ' + r.tk + ' ' + (r.sym || '')).toLowerCase().includes(q));
  const f = SORTS[S.sort]?.[1] || SORTS.score[1];
  return rows.slice().sort((a,b) => f(a) - f(b));
}
function heatColor(v){
  if (v == null) return '#1b1f3a';
  const k = Math.max(-1, Math.min(1, v/0.05)), a = Math.abs(k);
  return k >= 0 ? `rgba(0,${150 + 79*a | 0},${110 + 50*a | 0},${0.18 + 0.72*a})` : `rgba(${200 + 55*a | 0},40,${80 + 27*a | 0},${0.18 + 0.72*a})`;
}
function renderMkt(){
  const box = $('vMkt');
  const idx = (S.data?.indices || []).map(i => `<div class="icard" data-tk="${esc(i.tk)}"><small>${esc(i.name)}</small><b class="num">${fp(i.price, 'idx')}</b> <span class="num ${cl(i.c1)}">${pc(i.c1)}</span>${spark(i.spark, 120, 22)}</div>`).join('');
  const mk = S.mk, rows = filtered(mk), per = mk === 'crypto' && S.per === 'c5' ? 'c5' : S.per;
  const perLbl = { c1: mk === 'crypto' ? '24時間' : '1日', c5: mk === 'crypto' ? '7日' : '1週', c21:'1ヶ月' };
  const noData = mk !== 'crypto' && !S.data;
  let body = '';
  if (noData) body = setupCard();
  else if (!rows.length) body = `<div class="empty">${S.q ? '該当する銘柄がありません' : '読み込み中…'}</div>`;
  else if (S.mode === 'heat'){
    body = `<div class="heat">${rows.map(r => `<div class="tile" data-tk="${esc(r.tk)}" style="background:${heatColor(r[per])}">
      <b>${esc(r.name)}</b><small>${esc(r.sym || r.tk.replace('.T',''))}</small><span class="num">${pc(r[per])}</span><small class="num">${fp(r.price, mk)}</small></div>`).join('')}</div>`;
  } else {
    const cr = mk === 'crypto';
    const head = cr ? ['#','銘柄','価格','1時間','24時間','7日','30日','時価総額','RSI','スコア','7日推移','']
                    : ['銘柄','価格','1日','1週','1ヶ月','3ヶ月','出来高比','RSI','スコア','30日推移',''];
    body = `<div class="tbl-wrap mt"><table class="mtbl"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr data-tk="${esc(r.tk)}">
      ${cr ? `<td class="muted">${r.rank ?? ''}</td>` : ''}
      <td><div class="nm">${r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : ''}<span><b>${esc(r.name)}</b><small>${esc(r.sym || r.tk)}</small></span></div></td>
      <td class="num">${fp(r.price, mk)}</td>
      ${cr ? `<td class="num ${cl(r.c1h)}">${pc(r.c1h)}</td>` : ''}
      <td class="num ${cl(r.c1)}">${pc(r.c1)}</td><td class="num ${cl(r.c5)}">${pc(r.c5)}</td><td class="num ${cl(r.c21)}">${pc(r.c21)}</td>
      ${cr ? `<td class="num">${big(r.mcap)}</td>` : `<td class="num ${cl(r.c63)}">${pc(r.c63)}</td><td class="num ${r.volr >= 1.8 ? 'warn' : ''}">${r.volr != null ? r.volr.toFixed(2) + '倍' : '-'}</td>`}
      <td class="num ${r.rsi >= 70 ? 'down' : r.rsi <= 30 ? 'up' : ''}">${r.rsi != null ? r.rsi.toFixed(0) : '-'}</td>
      <td><span class="score ${scoreCls(r.score)}">${r.score ?? '-'}</span></td>
      <td>${spark(r.spark)}</td>
      <td><button class="star ${isWatched(r.tk) ? 'on' : ''}" data-star="${esc(r.tk)}" title="ウォッチ">★</button></td></tr>`).join('')}</table></div>`;
  }
  const trend = mk === 'crypto' && S.trend.length ? `<div class="trend"><span class="muted">🔥 検索急上昇:</span>${S.trend.map(t => `<span class="chip" data-tk="cg:${esc(t.id)}">${t.img ? `<img src="${esc(t.img)}" alt="">` : ''}${esc(t.sym)} <b class="${cl(n100(t.c1))}">${t.c1 != null ? pc(t.c1/100) : ''}</b></span>`).join('')}</div>` : '';
  box.innerHTML = `${idx ? `<div class="idx">${idx}</div>` : ''}
    <div class="ctrl">
      <div class="seg" data-k="mk">${['jp','us','crypto'].map(k => `<button data-v="${k}" class="${S.mk===k?'on':''}">${MK_NAME[k]}</button>`).join('')}</div>
      <div class="seg" data-k="mode"><button data-v="heat" class="${S.mode==='heat'?'on':''}">ヒートマップ</button><button data-v="list" class="${S.mode==='list'?'on':''}">一覧</button></div>
      ${S.mode === 'heat' ? `<div class="seg" data-k="per">${['c1','c5','c21'].map(k => `<button data-v="${k}" class="${S.per===k?'on':''}">${perLbl[k]}</button>`).join('')}</div>` : ''}
      <select data-k="sort">${Object.entries(SORTS).map(([k,[l]]) => `<option value="${k}" ${S.sort===k?'selected':''}>${l}</option>`).join('')}</select>
      <input type="search" id="mq" placeholder="銘柄名・コードで検索" value="${esc(S.q)}">
    </div>${trend}${body}`;
}

// ---------------------------------------------------------------- 上昇候補
function renderPick(){
  const box = $('vPick');
  const mks = S.pickMk === 'all' ? ['jp','us','crypto'] : [S.pickMk];
  const newsCount = tk => (S.data?.news || []).filter(n => (n.tk || []).includes(tk)).length;
  const sect = mk => {
    if (mk !== 'crypto' && !S.data) return `<h3>${MK_NAME[mk]}</h3>` + setupCard();
    const rows = rowsOf(mk); if (!rows.length) return `<h3>${MK_NAME[mk]}</h3><div class="empty">読み込み中…</div>`;
    const top = rows.slice().sort((a,b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8);
    const list = (title, arr, f) => `<div class="mini-list"><h4>${title}</h4>${arr.map((r,i) => `<div class="ml-row" data-tk="${esc(r.tk)}"><span class="muted">${i+1}</span><span class="ml-n">${esc(r.name)}</span>${f(r)}</div>`).join('')}</div>`;
    const gain = rows.slice().sort((a,b) => (b.c1 ?? -9) - (a.c1 ?? -9)).slice(0,5);
    const volu = rows.filter(r => r.volr != null).sort((a,b) => b.volr - a.volr).slice(0,5);
    const wk = rows.slice().sort((a,b) => (b.c5 ?? -9) - (a.c5 ?? -9)).slice(0,5);
    return `<h3>${MK_NAME[mk]}<small class="muted"> 上昇シグナルが多い順</small></h3>
      <div class="picks">${top.map((r,i) => {
        const nc = newsCount(r.yf || r.tk), col = r.score >= 70 ? '#00e5a0' : r.score >= 55 ? '#9b5cff' : '#8389b3';
        return `<div class="pcard" data-tk="${esc(r.tk)}">
          <div class="pc-top"><span class="rank">#${i+1}</span><div class="pc-name"><b>${esc(r.name)}</b><small>${esc(r.sym || r.tk)}</small></div>
            <div class="ring" style="--p:${r.score ?? 0};--c:${col}"><span>${r.score ?? '-'}</span></div></div>
          <div class="pc-mid"><b class="num">${fp(r.price, mk)}</b><span class="num ${cl(r.c1)}">${pc(r.c1)}</span><span class="muted num">${mk==='crypto'?'7日':'1週'} <span class="${cl(r.c5)}">${pc(r.c5)}</span></span></div>
          ${spark(r.spark, 260, 40)}
          <div class="chips2">${(r.why || []).map(w => `<span class="chip ${/注意|売られ/.test(w) ? 'r' : 'g'}">${esc(w)}</span>`).join('') || '<span class="muted">目立ったシグナルなし</span>'}</div>
          <div class="pc-foot muted">1ヶ月 <span class="${cl(r.c21)}">${pc(r.c21)}</span> · RSI ${r.rsi != null ? r.rsi.toFixed(0) : '-'} · 出来高 ${r.volr != null ? r.volr.toFixed(1)+'倍' : '-'}${nc ? ` · 📰 ${nc}件` : ''}</div>
        </div>`; }).join('')}</div>
      <div class="lists">${list(`値上がり率 TOP5（${mk==='crypto'?'24時間':'1日'}）`, gain, r => `<span class="num ${cl(r.c1)}">${pc(r.c1)}</span>`)}
        ${list(`上昇率 TOP5（${mk==='crypto'?'7日':'1週'}）`, wk, r => `<span class="num ${cl(r.c5)}">${pc(r.c5)}</span>`)}
        ${volu.length ? list('出来高急増 TOP5', volu, r => `<span class="num warn">${r.volr.toFixed(1)}倍</span>`) : ''}</div>`;
  };
  box.innerHTML = `<div class="ctrl"><div class="seg" data-k="pickMk">${[['all','すべて'],['jp','日本株'],['us','米国株'],['crypto','暗号資産']].map(([k,l]) => `<button data-v="${k}" class="${S.pickMk===k?'on':''}">${l}</button>`).join('')}</div></div>
    <p class="disc">⚠ スコアは過去の値動き（トレンド、モメンタム、出来高、RSI、MACD、高値更新など）を機械的に点数化したものです。将来の値上がりを予測・保証するものではなく、投資の推奨でもありません。</p>
    ${mks.map(sect).join('')}`;
}

// ---------------------------------------------------------------- ウォッチリスト
function renderWatch(){
  const box = $('vWatch');
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // 入力中は再描画しない
  if (!S.watch.length){ box.innerHTML = `<div class="empty">ウォッチリストは空です。銘柄の ★ を押すと追加され、価格アラートを設定できます。</div>`; return; }
  box.innerHTML = `<p class="muted" style="margin-bottom:8px">価格が「上限」以上・「下限」以下になると、画面とブラウザの通知でお知らせします（このページを開いている間）。</p>
  <div class="tbl-wrap mt"><table class="mtbl"><tr><th>銘柄</th><th>価格</th><th>1日</th><th>登録時から</th><th>スコア</th><th>上限アラート</th><th>下限アラート</th><th>メモ</th><th></th></tr>
  ${S.watch.map((w,i) => {
    const r = findRow(w.tk), mk = r?.mk || mkOf(w.tk), since = r && w.base ? r.price/w.base - 1 : null;
    return `<tr data-tk="${esc(w.tk)}"><td><b>${esc(r?.name || w.name)}</b><small class="muted" style="display:block">${esc(r?.sym || w.tk)}</small></td>
      <td class="num">${fp(r?.price, mk)}</td><td class="num ${cl(r?.c1)}">${pc(r?.c1)}</td><td class="num ${cl(since)}">${pc(since)}</td>
      <td><span class="score ${scoreCls(r?.score ?? 0)}">${r?.score ?? '-'}</span></td>
      <td><input class="winp" data-i="${i}" data-f="above" type="number" step="any" value="${w.above ?? ''}" placeholder="例 ${r ? fp(r.price*1.05, 'idx') : ''}"></td>
      <td><input class="winp" data-i="${i}" data-f="below" type="number" step="any" value="${w.below ?? ''}" placeholder="例 ${r ? fp(r.price*0.95, 'idx') : ''}"></td>
      <td><input class="winp note" data-i="${i}" data-f="note" type="text" value="${esc(w.note)}" placeholder="メモ"></td>
      <td><button class="x" data-unwatch="${esc(w.tk)}">削除</button></td></tr>`; }).join('')}</table></div>`;
}
function checkAlerts(){
  let changed = false;
  for (const w of S.watch){
    const r = findRow(w.tk); if (!r || r.price == null) continue;
    const mk = r.mk;
    if (w.above != null && r.price >= w.above && !w.firedA){ w.firedA = true; changed = true; notify(`📈 ${r.name} が ${fp(w.above, mk)} 以上に（現在 ${fp(r.price, mk)}）`); }
    else if (w.above != null && r.price < w.above && w.firedA){ w.firedA = false; changed = true; }
    if (w.below != null && r.price <= w.below && !w.firedB){ w.firedB = true; changed = true; notify(`📉 ${r.name} が ${fp(w.below, mk)} 以下に（現在 ${fp(r.price, mk)}）`); }
    else if (w.below != null && r.price > w.below && w.firedB){ w.firedB = false; changed = true; }
  }
  if (changed) save(WKEY, S.watch);
}
function notify(t){
  toast(t, 'liq');
  try { if (window.Notification && Notification.permission === 'granted') new Notification('価格アラート', { body:t }); } catch {}
}

// ---------------------------------------------------------------- ニュース
function newsList(items, limit=80){
  if (!items.length) return '<div class="empty">ニュースはありません</div>';
  const catLbl = { jp:'日本', us:'米国', crypto:'暗号資産' };
  return `<div class="news">${items.slice(0, limit).map(n => `<div class="nitem">
    <div class="nmeta"><span class="src ${n.cat}">${catLbl[n.cat] || ''}</span><small class="muted">${esc(n.src)}<br>${ago(n.t)}</small></div>
    <div><a href="${esc(/^https?:/.test(n.url) ? n.url : '#')}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a>
    ${(n.tk || []).length ? `<div class="chips2" style="margin-top:4px">${n.tk.map(t => { const r = findRow(t); return `<span class="chip tkc" data-tk="${esc(r?.tk || t)}">${esc(r?.name || t)}${r?.c1 != null ? ` <b class="${cl(r.c1)}">${pc(r.c1)}</b>` : ''}</span>`; }).join('')}</div>` : ''}</div></div>`).join('')}</div>`;
}
function renderNews(){
  const box = $('vNews');
  if (!S.data){ box.innerHTML = setupCard(); return; }
  const wt = new Set(S.watch.map(w => findRow(w.tk)?.yf || w.tk));
  let items = S.data.news || [];
  if (S.newsCat === 'watch') items = items.filter(n => (n.tk || []).some(t => wt.has(t)));
  else if (S.newsCat !== 'all') items = items.filter(n => n.cat === S.newsCat);
  box.innerHTML = `<div class="ctrl"><div class="seg" data-k="newsCat">${[['all','すべて'],['jp','日本'],['us','米国'],['crypto','暗号資産'],['watch','⭐ ウォッチ銘柄']].map(([k,l]) => `<button data-v="${k}" class="${S.newsCat===k?'on':''}">${l}</button>`).join('')}</div>
    <span class="muted" style="font-size:12px">${items.length}件 · 見出しをクリックすると配信元のページを開きます</span></div>${newsList(items, 150)}`;
}

// ---------------------------------------------------------------- 詳細
let curDetail = null;
async function openDetail(tk, keep){
  const r = findRow(tk); if (!r) return;
  curDetail = tk;
  const mk = r.mk, box = $('dBody');
  const ext = mk === 'jp' ? `https://finance.yahoo.co.jp/quote/${r.tk}` : mk === 'us' ? `https://finance.yahoo.com/quote/${r.tk}`
            : r.cg ? `https://www.coingecko.com/ja/coins/${r.cg}` : `https://finance.yahoo.com/quote/${r.tk}`;
  const related = (S.data?.news || []).filter(n => (n.tk || []).includes(r.yf || r.tk));
  const m = (k, v, c='') => `<div class="mt-i"><small>${k}</small><b class="num ${c}">${v}</b></div>`;
  const dev = r.sma25 ? (r.px0 ?? r.price)/r.sma25 - 1 : null;
  box.innerHTML = `<div class="d-head">
      <div>${r.img ? `<img src="${esc(r.img)}" alt="" class="d-img">` : ''}<h2>${esc(r.name)}</h2><span class="muted">${esc(r.sym || r.tk)} · ${MK_NAME[mk] || '指数'}</span></div>
      <div class="d-price"><b class="num">${fp(r.price, mk)}</b><span class="num ${cl(r.c1)}">${pc(r.c1)}</span></div>
      <div class="d-act">${mk !== 'idx' ? `<button class="btn ${isWatched(r.tk) ? 'on' : ''}" data-star="${esc(r.tk)}">${isWatched(r.tk) ? '★ ウォッチ中' : '☆ ウォッチ'}</button>` : ''}
        <a class="btn" href="${esc(ext)}" target="_blank" rel="noopener">外部サイトで見る ↗</a></div></div>
    <div class="d-chart"><canvas id="dCv"></canvas><div id="dLeg" class="muted num"></div></div>
    <div class="mt-grid">
      ${m(mk === 'crypto' ? '7日' : '1週', pc(r.c5), cl(r.c5))}${m('1ヶ月', pc(r.c21), cl(r.c21))}${m('3ヶ月', pc(r.c63), cl(r.c63))}
      ${m('RSI(14)', r.rsi != null ? r.rsi.toFixed(1) : '-', r.rsi >= 70 ? 'down' : r.rsi <= 30 ? 'up' : '')}
      ${m('出来高（平常比）', r.volr != null ? r.volr.toFixed(2) + '倍' : '-')}${m('25日線乖離', pc(dev), cl(dev))}
      ${m('52週高値', fp(r.hi52, mk))}${m('52週安値', fp(r.lo52, mk))}${m('高値から', pc(r.fromHi), cl(r.fromHi))}
      ${m('値幅（ATR）', r.atrp != null ? (r.atrp*100).toFixed(2) + '%' : '-')}${r.mcap ? m('時価総額', big(r.mcap) + '円') : ''}${r.score != null ? m('上昇スコア', r.score, r.score >= 70 ? 'up' : '') : ''}
    </div>
    ${(r.why || []).length ? `<div class="chips2" style="margin:10px 0">${r.why.map(w => `<span class="chip ${/注意|売られ/.test(w) ? 'r' : 'g'}">${esc(w)}</span>`).join('')}</div>` : ''}
    <h4 class="d-h4">関連ニュース</h4>${newsList(related, 15)}`;
  $('detail').hidden = false;
  if (!keep) $('detail').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  // チャートデータ
  let H = S.data?.hist?.[r.yf || r.tk];
  let bars = H ? H.t.map((t,i) => ({ t:t*864e5, o:H.o[i], h:H.h[i], l:H.l[i], c:H.c[i], v:H.v[i] })) : null;
  if (!bars && r.cg){
    try {
      const j = await (await fetch(`${CG}/coins/${r.cg}/ohlc?vs_currency=jpy&days=90`)).json();
      if (Array.isArray(j)) bars = j.map(([t,o,h,l,c]) => ({ t, o, h, l, c, v:0 }));
    } catch {}
  }
  if (curDetail !== tk) return;
  drawDetail(bars, mk, !!H);
}
$('detail').addEventListener('click', e => {
  if (e.target.id === 'detail' || e.target.closest('#dClose')){ $('detail').hidden = true; document.body.style.overflow = ''; curDetail = null; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('detail').hidden){ $('detail').hidden = true; document.body.style.overflow = ''; } });

function smaArr(c, n){ const o = []; let s = 0; for (let i=0;i<c.length;i++){ s += c[i]; if (i >= n) s -= c[i-n]; o.push(i >= n-1 ? s/n : null); } return o; }
function rsiArr(c, n=14){
  const o = Array(c.length).fill(null); if (c.length <= n) return o;
  let g = 0, l = 0; for (let i=1;i<=n;i++){ const d = c[i]-c[i-1]; d > 0 ? g += d : l -= d; } g /= n; l /= n;
  o[n] = l ? 100 - 100/(1+g/l) : 100;
  for (let i=n+1;i<c.length;i++){ const d = c[i]-c[i-1]; g = (g*(n-1)+Math.max(d,0))/n; l = (l*(n-1)+Math.max(-d,0))/n; o[i] = l ? 100 - 100/(1+g/l) : 100; }
  return o;
}
function drawDetail(bars, mk, daily){
  const cv = $('dCv'); if (!cv) return;
  const wrap = cv.parentElement, W = wrap.clientWidth, Hh = Math.min(380, Math.max(260, W*0.45));
  const dpr = window.devicePixelRatio || 1;
  cv.width = W*dpr; cv.height = Hh*dpr; cv.style.height = Hh + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  if (!bars || bars.length < 2){ ctx.fillStyle = '#8389b3'; ctx.font = '13px system-ui'; ctx.fillText('チャートデータがありません', 16, 30); return; }
  const C = bars.map(b => b.c), s25 = smaArr(C, 25), s75 = smaArr(C, 75), rs = rsiArr(C);
  const AX = 74, pw = W - AX, mainH = Hh*0.72, rsT = mainH + 8, rsH = Hh - rsT - 18;
  const n = bars.length, cw = pw/n;
  let hi = -Infinity, lo = Infinity; for (const b of bars){ hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); }
  for (const a of [s25, s75]) for (const v of a) if (v != null){ hi = Math.max(hi, v); lo = Math.min(lo, v); }
  const pad = (hi-lo)*0.06 || hi*0.01; hi += pad; lo -= pad;
  const y = v => 18 + (hi - v)/(hi - lo)*(mainH - 18 - 6), x = i => i*cw + cw/2;
  const ry = v => rsT + (100 - v)/100*rsH;
  let mv = 0; for (const b of bars) mv = Math.max(mv, b.v || 0);
  const draw = (hov) => {
    ctx.clearRect(0,0,W,Hh); ctx.font = '11px system-ui,sans-serif'; ctx.textBaseline = 'middle';
    // grid
    const raw = (hi-lo)/5, mag = 10**Math.floor(Math.log10(raw)), st = [1,2,2.5,5,10].map(k => k*mag).find(k => k >= raw);
    ctx.strokeStyle = 'rgba(80,90,160,.18)'; ctx.fillStyle = '#8389b3';
    for (let v = Math.ceil(lo/st)*st; v <= hi; v += st){ const yy = Math.round(y(v))+.5; ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(pw,yy); ctx.stroke(); ctx.fillText(fp(v, 'idx'), pw+6, yy); }
    // volume
    if (mv) for (let i=0;i<n;i++){ const b = bars[i], h = (b.v||0)/mv*mainH*0.18; ctx.fillStyle = b.c >= b.o ? 'rgba(0,229,160,.22)' : 'rgba(255,59,107,.22)'; ctx.fillRect(x(i)-cw*0.35, mainH - h, Math.max(1, cw*0.7), h); }
    // candles
    const bw = Math.max(1, cw*0.66);
    for (let i=0;i<n;i++){ const b = bars[i], col = b.c >= b.o ? '#00e5a0' : '#ff3b6b'; ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(Math.round(x(i))+.5, y(b.h)); ctx.lineTo(Math.round(x(i))+.5, y(b.l)); ctx.stroke();
      const yt = y(Math.max(b.o,b.c)), yb = y(Math.min(b.o,b.c)); ctx.fillRect(x(i)-bw/2, yt, bw, Math.max(1, yb-yt)); }
    const line = (a, col, yf) => { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); let on = false; a.forEach((v,i) => { if (v == null) return; on ? ctx.lineTo(x(i), yf(v)) : (ctx.moveTo(x(i), yf(v)), on = true); }); ctx.stroke(); ctx.lineWidth = 1; };
    if (daily){ line(s25, '#ffb020', y); line(s75, '#3ad6ff', y); }
    // last price
    const lp = C[n-1], ly = Math.round(y(lp))+.5, lc = lp >= bars[n-1].o ? '#00e5a0' : '#ff3b6b';
    ctx.setLineDash([2,3]); ctx.strokeStyle = lc; ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(pw,ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = lc; ctx.fillRect(pw, ly-9, AX, 18); ctx.fillStyle = '#05060c'; ctx.fillText(fp(lp, 'idx'), pw+6, ly);
    // RSI
    ctx.strokeStyle = '#22274a'; ctx.beginPath(); ctx.moveTo(0, rsT-4); ctx.lineTo(W, rsT-4); ctx.stroke();
    ctx.fillStyle = 'rgba(155,92,255,.07)'; ctx.fillRect(0, ry(70), pw, ry(30)-ry(70));
    for (const g of [30,70]){ ctx.strokeStyle = 'rgba(131,137,179,.35)'; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(0, ry(g)); ctx.lineTo(pw, ry(g)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#8389b3'; ctx.fillText(g, pw+6, ry(g)); }
    line(rs, '#c38bff', ry);
    // dates
    ctx.fillStyle = '#8389b3'; ctx.textAlign = 'center';
    const stp = Math.ceil(n/6);
    for (let i=n-1;i>=0;i-=stp){ const d = new Date(bars[i].t); ctx.fillText(daily ? `${d.getMonth()+1}/${d.getDate()}` : `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}時`, x(i), Hh-8); }
    ctx.textAlign = 'left';
    const i = hov ?? n-1, b = bars[i];
    if (hov != null){ ctx.strokeStyle = 'rgba(200,205,255,.4)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), Hh-16); ctx.stroke(); ctx.setLineDash([]); }
    const d = new Date(b.t);
    $('dLeg').innerHTML = `${d.toLocaleDateString('ja-JP')}${daily ? '' : ' ' + d.getHours() + '時'}　始 ${fp(b.o,'idx')}　高 ${fp(b.h,'idx')}　安 ${fp(b.l,'idx')}　終 <b class="${b.c>=b.o?'up':'down'}">${fp(b.c,'idx')}</b>${daily ? `　<span style="color:#ffb020">25日線 ${fp(s25[i],'idx')}</span>　<span style="color:#3ad6ff">75日線 ${fp(s75[i],'idx')}</span>` : ''}　<span style="color:#c38bff">RSI ${rs[i] != null ? rs[i].toFixed(1) : '-'}</span>`;
  };
  draw(null);
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(), i = Math.floor((e.clientX - r.left)/cw); draw(i >= 0 && i < n ? i : null); };
  cv.onpointerleave = () => draw(null);
}


// ---------------------------------------------------------------- AI運用（Claude）
const AI_URL = DATA_URL.replace(/market\.json$/, 'ai.json');
const CAP_KEY = 'ai-real-capital-v1';
async function loadAI(){
  try {
    const r = await fetch(AI_URL + '?t=' + Math.floor(Date.now()/60000), { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    S.ai = await r.json(); S.aiErr = null;
  } catch (e) { S.aiErr = String(e.message || e); }
  if (S.view === 'ai') render();
}
const yen = v => v == null || !isFinite(v) ? '-' : (v < 0 ? '-' : '') + '¥' + Math.round(Math.abs(v)).toLocaleString('ja-JP');
const RISK = { low:['低め','up'], medium:['中程度','warn'], high:['高め','down'] };
const CONF = { low:'低', medium:'中', high:'高' };
function aiSetup(){
  return `<div class="setup"><h3>🤖 Claude の運用を始めるには</h3>
  <p>Claude（Opus 5.5）が GitHub Actions 上で6時間ごとに相場データとニュースを読み、仮想資金 1,000万円で売買します。実際のお金は動きません。</p>
  <ol><li>先に「株価・ニュース」のデータ取得を有効にする（マーケット画面の案内どおり main にマージ）</li>
  <li><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a> で API キーを作成する（従量課金。1回の判断で約20〜40円、6時間ごとなら月 3,000〜5,000円程度が目安）</li>
  <li>GitHub の <a href="https://github.com/${esc(REPO)}/settings/secrets/actions" target="_blank" rel="noopener">Settings → Secrets and variables → Actions</a> で、名前 <code>ANTHROPIC_API_KEY</code> のシークレットとして登録する</li>
  <li><a href="https://github.com/${esc(REPO)}/actions/workflows/market-data.yml" target="_blank" rel="noopener">Actions の「Market data」</a> で <b>Run workflow</b> を押し、「今すぐ Claude に売買判断させる」にチェックして実行</li></ol>
  <p class="muted">判断の間隔は Actions の変数 <code>AI_INTERVAL_HOURS</code>（既定 6）で変えられます。取得先: <code>${esc(AI_URL)}</code>（${esc(S.aiErr || '')}）</p></div>`;
}
function eqChart(hist, start){
  if (!hist || hist.length < 2) return '<div class="empty" style="padding:30px">記録が2点以上たまるとグラフが表示されます</div>';
  const W = 900, H = 220, P = 8, xs = hist.map(h => new Date(h.t).getTime()), ys = hist.map(h => h.eq);
  let lo = Math.min(...ys, start), hi = Math.max(...ys, start); const pd = (hi-lo)*0.1 || hi*0.01; lo -= pd; hi += pd;
  const x = t => P + (t - xs[0])/((xs[xs.length-1] - xs[0]) || 1)*(W - 2*P), y = v => P + (hi - v)/(hi - lo)*(H - 2*P);
  const pts = hist.map((h,i) => `${x(xs[i]).toFixed(1)},${y(h.eq).toFixed(1)}`).join(' ');
  const up = ys[ys.length-1] >= start, col = up ? '#00e5a0' : '#ff3b6b';
  return `<svg viewBox="0 0 ${W} ${H}" class="eqsvg" preserveAspectRatio="none">
    <defs><linearGradient id="eqg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${y(start)}" y2="${y(start)}" stroke="#8389b3" stroke-dasharray="4 4" stroke-width="1"/>
    <polygon fill="url(#eqg)" points="${x(xs[0])},${H} ${pts} ${x(xs[xs.length-1])},${H}"/>
    <polyline fill="none" stroke="${col}" stroke-width="2" points="${pts}"/></svg>
    <div class="eqlbl muted"><span>${new Date(xs[0]).toLocaleDateString('ja-JP')}</span><span>点線 = 元本 ${yen(start)}</span><span>${new Date(xs[xs.length-1]).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span></div>`;
}
function realQty(tk, jpy){
  const r = findRow(tk); if (!r || !r.price) return null;
  const mk = mkOf(tk), fx = mk === 'us' ? (S.ai?.usdjpy || 150) : 1, unit = r.price*fx;
  if (mk === 'jp'){ const q = Math.floor(jpy/unit/100)*100; return { q, txt: q ? `${q.toLocaleString()}株` : `100株＝${yen(unit*100)}が必要`, px:r.price, mk }; }
  if (mk === 'us'){ const q = Math.floor(jpy/unit); return { q, txt: q ? `${q}株` : `1株＝${yen(unit)}が必要`, px:r.price, mk }; }
  const q = Math.floor(jpy/unit*1e4)/1e4; return { q, txt: `${q}`, px:r.price, mk };
}
function renderAI(){
  const box = $('vAi'), A = S.ai;
  if (!A){ box.innerHTML = aiSetup(); return; }
  const eq = A.equity, start = A.start, target = A.target, ret = eq/start - 1;
  const prog = Math.max(0, Math.min(100, Math.log(Math.max(eq, 1)/start)/Math.log(target/start)*100));
  const days = Math.max(1, (Date.now() - new Date(A.startedAt).getTime())/864e5);
  const D = A.decisions?.[0];
  const cap = +(load(CAP_KEY, 10_000_000)) || 10_000_000;
  const posRows = Object.entries(A.positions || {}).map(([tk,p]) => {
    const mk = mkOf(tk), fx = mk === 'us' ? A.usdjpy : 1, val = (p.last || p.avg)*p.qty*fx, pnl = (p.last || p.avg)/p.avg - 1;
    return { tk, p, mk, val, pnl, w: val/eq };
  });
  const err = A.lastError ? `<div class="setup" style="border-color:var(--down)">⚠ 直近の Claude 実行でエラー（${ago(A.lastError.t)}）: ${esc(A.lastError.msg)}</div>` : '';
  const orders = (D?.orders || []).map(o => {
    const r = findRow(o.ticker), buy = o.action === 'buy';
    return `<div class="ord"><span class="src ${buy ? 'us' : 'jp'}">${buy ? '買い' : '売り'}</span>
      <div><b class="tkc" data-tk="${esc(r?.tk || o.ticker)}">${esc(r?.name || o.ticker)}</b> <small class="muted">${esc(o.ticker)}</small>
      <span class="muted"> · ${buy ? `目標比率 ${o.target_weight_pct}% · 損切り -${o.stop_loss_pct}% · 利確 +${o.take_profit_pct}%` : `保有の${Math.round(o.sell_fraction*100)}%を売却`} · 確信度 ${CONF[o.confidence] || '-'}</span>
      <p>${esc(o.reason)}</p></div></div>`;
  }).join('') || '<p class="muted">今回は売買なし（様子見）</p>';
  const realBuys = (D?.orders || []).filter(o => o.action === 'buy').map(o => {
    const jpy = cap*o.target_weight_pct/100, rq = realQty(o.ticker, jpy), r = findRow(o.ticker);
    return `<tr><td><b>${esc(r?.name || o.ticker)}</b><small class="muted" style="display:block">${esc(o.ticker)}</small></td><td class="num">${o.target_weight_pct}%</td><td class="num">${yen(jpy)}</td>
      <td class="num">${rq ? rq.txt : '-'}</td><td class="num">${rq ? fp(rq.px, rq.mk) : '-'}</td>
      <td class="num down">${rq ? fp(rq.px*(1 - o.stop_loss_pct/100), rq.mk) : '-'}</td><td class="num up">${rq ? fp(rq.px*(1 + o.take_profit_pct/100), rq.mk) : '-'}</td></tr>`;
  }).join('');
  const realSells = (D?.orders || []).filter(o => o.action === 'sell').map(o => `<li>${esc(findRow(o.ticker)?.name || o.ticker)}：保有している場合は ${Math.round(o.sell_fraction*100)}% を売却</li>`).join('');
  const mirror = posRows.map(({tk,p,mk,w}) => { const rq = realQty(tk, cap*w); return `<tr><td>${esc(p.name || tk)}</td><td class="num">${(w*100).toFixed(1)}%</td><td class="num">${yen(cap*w)}</td><td class="num">${rq ? rq.txt : '-'}</td><td class="num down">${fp(p.sl, mk)}</td><td class="num up">${fp(p.tp, mk)}</td></tr>`; }).join('');
  box.innerHTML = `${err}
  <div class="ai-top">
    <div class="card ai-eq"><h4>Claude の仮想ポートフォリオ（元本 ${yen(start)}）</h4>
      <div class="big num ${cl(ret)}">${yen(eq)}</div><div class="num ${cl(ret)}">${pc(ret)}（${yen(eq - start)}）</div>
      <div class="goal"><div class="goal-bar"><i style="width:${prog.toFixed(1)}%"></i></div>
        <div class="gl"><span>1,000万</span><span>目標 1億円まで あと ${(target/eq).toFixed(2)}倍</span><span>1億</span></div></div>
      <div class="muted" style="font-size:12px;margin-top:6px">運用 ${Math.floor(days)}日目 · 現金 ${yen(A.cash)} · 確定損益 <span class="${cl(A.realized)}">${yen(A.realized)}</span> · 手数料 ${yen(A.fees)} · 更新 ${ago(A.updated)}</div></div>
    <div class="card ai-chart"><h4>資産推移</h4>${eqChart(A.history, start)}</div>
  </div>
  <p class="disc">⚠ これは Claude による仮想運用の記録です。AI は相場を予測できず、過去の成績は将来を保証しません。1,000万円を1億円にする目標は大きな損失リスクを伴います。実資金での取引は、必ずご自身の判断と責任で、余裕資金の範囲で行ってください。</p>
  <div class="ai-grid">
    <div class="card"><h4>最新の判断 ${D ? `<span class="muted">· ${new Date(D.t).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}（${ago(D.t)}）· ${esc(D.usage?.model || '')}</span>` : ''}</h4>
      ${D ? `<p><b>相場観</b> <span class="${RISK[D.risk_level]?.[1] || ''}">リスク${RISK[D.risk_level]?.[0] || ''}</span></p><p class="mv">${esc(D.market_view)}</p>
        <h5>注文（執行 ${D.executed}件 · 取引時間待ち ${D.pending}件）</h5>${orders}
        ${(D.notes || []).length ? `<p class="muted" style="font-size:12px">リスク制限による調整: ${D.notes.map(esc).join(' / ')}</p>` : ''}
        ${(D.watchlist || []).length ? `<h5>注目銘柄</h5><div class="chips2">${D.watchlist.map(w => `<span class="chip tkc" data-tk="${esc(findRow(w.ticker)?.tk || w.ticker)}" title="${esc(w.note)}">${esc(findRow(w.ticker)?.name || w.ticker)}：${esc(w.note)}</span>`).join('')}</div>` : ''}
        ${D.lessons ? `<h5>振り返り</h5><p class="mv">${esc(D.lessons)}</p>` : ''}` : '<p class="muted">まだ判断がありません。次の実行をお待ちください。</p>'}
      ${(A.pending || []).length ? `<h5>取引時間待ちの注文</h5><ul class="pl">${A.pending.map(o => `<li>${o.action === 'buy' ? '買い' : '売り'} ${esc(findRow(o.ticker)?.name || o.ticker)}（${ago(o.at)}に発注）</li>`).join('')}</ul>` : ''}
    </div>
    <div class="card"><h4>💴 実資金で使う場合の目安</h4>
      <label class="capl">あなたの運用資金 <input type="number" id="realCap" min="0" step="100000" value="${cap}"> 円</label>
      <h5>最新の買い提案をこの資金に当てはめると</h5>
      ${realBuys ? `<div class="tbl-wrap mt"><table class="mtbl"><tr><th>銘柄</th><th>比率</th><th>金額</th><th>数量</th><th>現在値</th><th>損切り</th><th>利確</th></tr>${realBuys}</table></div>` : '<p class="muted">今回の買い提案はありません</p>'}
      ${realSells ? `<ul class="pl">${realSells}</ul>` : ''}
      <h5>AI ポートフォリオ全体を同じ比率で持つ場合</h5>
      ${mirror ? `<div class="tbl-wrap mt"><table class="mtbl"><tr><th>銘柄</th><th>比率</th><th>金額</th><th>数量</th><th>損切り</th><th>利確</th></tr>${mirror}</table></div>` : '<p class="muted">現在ポジションなし</p>'}
      <p class="muted" style="font-size:11px;margin-top:8px">数量は日本株100株・米国株1株単位に切り捨て、ドル円 ${A.usdjpy} で換算。価格は取得時点のもので、注文はご自身の証券口座で行ってください。このアプリが自動で発注することはありません。</p>
    </div>
  </div>
  <h3>保有銘柄</h3>
  ${posRows.length ? `<div class="tbl-wrap mt"><table class="mtbl"><tr><th>銘柄</th><th>数量</th><th>取得単価</th><th>現在値</th><th>評価額</th><th>比率</th><th>損益</th><th>損切り</th><th>利確</th><th>理由</th></tr>
    ${posRows.map(({tk,p,mk,val,pnl,w}) => `<tr data-tk="${esc(findRow(tk)?.tk || tk)}"><td><b>${esc(p.name || tk)}</b><small class="muted" style="display:block">${esc(tk)}</small></td><td class="num">${p.qty.toLocaleString()}</td>
      <td class="num">${fp(p.avg, mk)}</td><td class="num">${fp(p.last, mk)}</td><td class="num">${yen(val)}</td><td class="num">${(w*100).toFixed(1)}%</td>
      <td class="num ${cl(pnl)}">${pc(pnl)}</td><td class="num down">${fp(p.sl, mk)}</td><td class="num up">${fp(p.tp, mk)}</td><td class="wrap">${esc(p.thesis || '')}</td></tr>`).join('')}</table></div>` : '<div class="empty">ポジションなし（全額現金）</div>'}
  <h3>売買履歴</h3>
  ${(A.trades || []).length ? `<div class="tbl-wrap mt"><table class="mtbl"><tr><th>日時</th><th>銘柄</th><th>売買</th><th>数量</th><th>価格</th><th>金額</th><th>確定損益</th><th>きっかけ</th><th>理由</th></tr>
    ${A.trades.slice(0,100).map(t => `<tr><td class="muted">${new Date(t.t).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td><td>${esc(findRow(t.tk)?.name || t.tk)}</td>
      <td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? '買い' : '売り'}</td><td class="num">${t.qty.toLocaleString()}</td><td class="num">${fp(t.px, mkOf(t.tk))}</td><td class="num">${yen(t.jpy)}</td>
      <td class="num ${cl(t.realized)}">${t.side === 'sell' ? yen(t.realized) : '-'}</td><td>${t.src === 'rule' ? '自動（損切り/利確）' : 'Claude'}</td><td class="wrap">${esc(t.reason)}</td></tr>`).join('')}</table></div>` : '<div class="empty">まだ売買はありません</div>'}
  ${(A.decisions || []).length > 1 ? `<h3>過去の判断</h3>${A.decisions.slice(1, 20).map(d => `<details class="card past"><summary>${new Date(d.t).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })} · 注文${(d.orders || []).length}件 · 総資産 ${yen(d.equity)}</summary><p class="mv">${esc(d.market_view)}</p>${(d.orders || []).map(o => `<p>・${o.action === 'buy' ? '買い' : '売り'} ${esc(findRow(o.ticker)?.name || o.ticker)}：${esc(o.reason)}</p>`).join('')}</details>`).join('')}` : ''}`;
}
$('realView').addEventListener('change', e => {
  if (e.target.id === 'realCap'){ save(CAP_KEY, Math.max(0, +e.target.value || 0)); renderAI(); }
});

// ---------------------------------------------------------------- ナビゲーション・イベント
function setView(v){
  S.view = v; saveView();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const demo = v === 'demo';
  document.body.classList.toggle('real', !demo);
  $('realView').hidden = demo; $('demoMain').hidden = !demo;
  for (const k of ['mkt','pick','watch','news','ai']) $('v' + k[0].toUpperCase() + k.slice(1)).hidden = v !== k;
  if (demo) window.dispatchEvent(new Event('resize'));
  render();
}
function render(){
  renderBar();
  if (S.view === 'mkt') renderMkt();
  else if (S.view === 'pick') renderPick();
  else if (S.view === 'watch') renderWatch();
  else if (S.view === 'news') renderNews();
  else if (S.view === 'ai') renderAI();
}
function afterUpdate(){ checkAlerts(); render(); }

$('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
$('realView').addEventListener('click', e => {
  const st = e.target.closest('[data-star]'); if (st){ e.stopPropagation(); toggleWatch(st.dataset.star); return; }
  const un = e.target.closest('[data-unwatch]'); if (un){ toggleWatch(un.dataset.unwatch); return; }
  const sb = e.target.closest('.seg[data-k] button'); if (sb){ S[sb.parentElement.dataset.k] = sb.dataset.v; saveView(); render(); return; }
  if (e.target.closest('input,select,a')) return;
  const t = e.target.closest('[data-tk]'); if (t) openDetail(t.dataset.tk);
});
$('detail').addEventListener('click', e => {
  const st = e.target.closest('[data-star]'); if (st){ toggleWatch(st.dataset.star); return; }
  const t = e.target.closest('.tkc[data-tk]'); if (t) openDetail(t.dataset.tk);
});
$('realView').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.k === 'sort'){ S.sort = t.value; saveView(); render(); }
  if (t.classList.contains('winp')){
    const w = S.watch[+t.dataset.i]; if (!w) return;
    if (t.dataset.f === 'note') w.note = t.value;
    else { w[t.dataset.f] = t.value === '' ? null : +t.value; w.firedA = w.firedB = false;
      if (t.value !== '' && window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); }
    save(WKEY, S.watch); checkAlerts();
  }
});
$('realView').addEventListener('input', e => {
  if (e.target.id === 'mq'){ S.q = e.target.value; const pos = e.target.selectionStart; renderMkt(); const q = $('mq'); q.focus(); q.setSelectionRange(pos, pos); }
});
addEventListener('resize', () => { if (!$('detail').hidden && curDetail) openDetail(curDetail, true); });

setView(S.view || 'mkt');
loadData(); loadCG(); loadTrending(); loadAI();
setInterval(loadData, 5*60e3);
setInterval(loadAI, 5*60e3);
setInterval(loadCG, 60e3);
setInterval(loadTrending, 10*60e3);
setInterval(renderBar, 30e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - S.cgAt > 60e3) loadCG(); });
})();
