// ====== state ======
let mode = 'feed';             // 'feed' | 'stock'
let currentPeriod = 'today';
let currentData = [];          // feed: [{date,label,cards:[...]}]
const cache = {};              // period -> data (กันยิงซ้ำตอนสลับแท็บ)

const PAGE = 50;               // feed: แสดงทีละ 50 การ์ด
let flat = [];                 // ลำดับ render feed
let renderPtr = 0;
let currentSection = null;
let feedFilter = 'all';        // 'all' | 'out' | 'in' | 'b2b'

// stock mode
const STOCK_LIMIT = 100;       // เช็คสต็อก: ดึงทีละ 100 จาก server
let stockQuery = '', stockOffset = 0, stockTotal = 0;
let stockBody = null, stockTimer = null, stockReqId = 0;

const $ = (s) => document.querySelector(s);
const feedEl = $('#feed');
const overlay = $('#overlay');

// ====== loading progress (ตัวเลขวิ่ง ให้รู้สึกไม่ค้าง) ======
let progTimer = null;
function startProgress() {
  const el = $('#progNum');
  let n = 0;
  if (el) el.textContent = '0';
  overlay.classList.remove('hidden');
  clearInterval(progTimer);
  progTimer = setInterval(() => {
    const step = n < 60 ? 4 : n < 85 ? 1.5 : 0.4;   // เร็วช่วงแรก ช้าลงใกล้จบ
    n = Math.min(95, n + step);
    if (el) el.textContent = Math.floor(n);
  }, 70);
}
function stopProgress() {
  clearInterval(progTimer);
  const el = $('#progNum');
  if (el) el.textContent = '100';
  overlay.classList.add('hidden');
}

// ====== init ======
document.addEventListener('DOMContentLoaded', () => {
  $('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    $('#search').value = '';                 // เคลียร์คำค้นเมื่อสลับแท็บ
    $('#rangebar').classList.add('hidden');  // ซ่อนแถบวันที่เป็น default
    if (btn.dataset.mode === 'stock') {
      $('#filterbar').classList.add('hidden');   // เช็คสต็อกไม่ใช้ตัวกรองนี้
      enterStock();
    } else if (btn.dataset.mode === 'range') {
      $('#filterbar').classList.remove('hidden');
      enterRange();
    } else {
      mode = 'feed';
      currentPeriod = btn.dataset.period;
      $('#filterbar').classList.remove('hidden');
      $('#search').placeholder = '🔍 ค้นหา รหัส / ชื่อสินค้า / หมายเหตุ';
      load();
    }
  });
  $('#filterbar').addEventListener('click', (e) => {
    const fb = e.target.closest('.fb');
    if (!fb) return;
    document.querySelectorAll('.fb').forEach(b => b.classList.toggle('active', b === fb));
    feedFilter = fb.dataset.filter;
    render();
  });
  $('#refreshBtn').addEventListener('click', () => {
    if (mode === 'stock') runStock(true);
    else if (mode === 'range') { delete cache['year']; loadRange(); }   // refresh = ดึงปีใหม่
    else load(true);
  });
  $('#search').addEventListener('input', () => {
    if (mode === 'feed' || mode === 'range') { render(); return; }
    clearTimeout(stockTimer);
    stockTimer = setTimeout(() => runStock(true), 550);   // debounce รอพิมพ์จบ
  });
  $('#rangeGo').addEventListener('click', loadRange);
  $('#fromDate').addEventListener('change', loadRange);
  $('#toDate').addEventListener('change', loadRange);
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));
  feedEl.addEventListener('click', (e) => {
    const t = e.target.closest('.thumb img');
    if (t) {
      $('#lightboxImg').src = t.dataset.full || t.src;
      $('#lightbox').classList.remove('hidden');
    }
  });
  load();
});

// ====== FEED MODE ======
async function load(force = false) {
  if (GAS_URL.includes('PASTE_YOUR')) {
    feedEl.innerHTML = '<div class="errbox">ยังไม่ได้ตั้งค่า GAS_URL ใน <b>js/api.js</b></div>';
    return;
  }
  if (!force && cache[currentPeriod]) {
    currentData = cache[currentPeriod];
    render();
    return;
  }
  startProgress();
  try {
    const j = await fetchFeed(currentPeriod, force);
    $('#serverDate').textContent = 'ข้อมูล ณ ' + (j.serverDate || '');
    currentData = j.data || [];
    cache[currentPeriod] = currentData;
    render();
  } catch (err) {
    feedEl.innerHTML = '<div class="errbox">โหลดข้อมูลไม่สำเร็จ: ' + esc(err.message) + '</div>';
  } finally {
    stopProgress();
  }
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const f = feedFilter;
  let days = currentData;
  if (q || f !== 'all') {
    days = currentData.map(d => ({
      ...d, cards: d.cards.filter(c =>
        (f === 'all' || (c[f] && c[f].qty > 0)) && (!q || matchCard(c, q))
      )
    })).filter(d => d.cards.length);
  }
  flat = [];
  days.forEach(d => {
    flat.push({ t: 'day', date: d.date, label: d.label, count: d.cards.length });
    d.cards.forEach(c => flat.push({ t: 'card', card: c }));
  });
  renderPtr = 0;
  currentSection = null;
  feedEl.innerHTML = '';
  const totalCards = flat.filter(x => x.t === 'card').length;
  if (!totalCards) {
    feedEl.innerHTML = emptyHtml(q ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีการอัพเดทในช่วงนี้');
    return;
  }
  renderNextPage();
}

function renderNextPage() {
  removeLoadMore();
  let added = 0;
  while (renderPtr < flat.length && added < PAGE) {
    const item = flat[renderPtr++];
    if (item.t === 'day') {
      const sec = document.createElement('section');
      sec.className = 'day-group';
      sec.innerHTML = `<div class="day-head"><span class="dot"></span><h2>${esc(item.label)}</h2>
        <span class="count">${item.count} รายการ</span></div><div class="day-body"></div>`;
      feedEl.appendChild(sec);
      currentSection = sec.querySelector('.day-body');
    } else {
      if (!currentSection) {
        const sec = document.createElement('section');
        sec.className = 'day-group';
        feedEl.appendChild(sec);
        currentSection = sec;
      }
      currentSection.insertAdjacentHTML('beforeend', renderCard(item.card));
      added++;
    }
  }
  const remaining = flat.slice(renderPtr).filter(x => x.t === 'card').length;
  if (remaining > 0) addLoadMore(remaining, renderNextPage, PAGE);
}

// ====== RANGE MODE (เลือกช่วงวันที่เอง) ======
function enterRange() {
  mode = 'range';
  $('#rangebar').classList.remove('hidden');
  $('#search').placeholder = '🔍 ค้นหาในผลช่วงวันที่นี้';
  if (!$('#fromDate').value || !$('#toDate').value) {   // default: ย้อน 7 วัน–วันนี้
    const today = new Date(), wk = new Date();
    wk.setDate(wk.getDate() - 6);
    $('#fromDate').value = ymd(wk);
    $('#toDate').value = ymd(today);
  }
  loadRange();
}

async function loadRange() {
  const from = $('#fromDate').value, to = $('#toDate').value;
  if (!from || !to) return;
  mode = 'range';
  const yearStart = new Date().getFullYear() + '-01-01';

  // ช่วงอยู่ในปีนี้ → หั่นจากข้อมูล "ปี" ในเครื่อง (เร็วทันที ไม่ยิง server ซ้ำ)
  if (from >= yearStart) {
    if (!cache['year']) {
      startProgress();
      try {
        const j = await fetchFeed('year');
        cache['year'] = j.data || [];
      } catch (err) {
        feedEl.innerHTML = '<div class="errbox">โหลดข้อมูลไม่สำเร็จ: ' + esc(err.message) + '</div>';
        stopProgress();
        return;
      }
      stopProgress();
    }
    currentData = cache['year'].filter(d => d.date >= from && d.date <= to);
    $('#serverDate').textContent = 'ช่วง ' + from + ' ถึง ' + to;
    render();
    return;
  }

  // ช่วงข้ามปีก่อน → ดึงจาก server
  startProgress();
  try {
    const j = await fetchRange(from, to);
    $('#serverDate').textContent = 'ช่วง ' + from + ' ถึง ' + to;
    currentData = j.data || [];
    render();
  } catch (err) {
    feedEl.innerHTML = '<div class="errbox">โหลดข้อมูลไม่สำเร็จ: ' + esc(err.message) + '</div>';
  } finally {
    stopProgress();
  }
}

function ymd(d) {
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

// ====== STOCK MODE ======
function enterStock() {
  mode = 'stock';
  $('#serverDate').textContent = 'เช็คสต็อกทั้งหมด';
  $('#search').placeholder = '🔎 พิมพ์รหัส/ชื่อ (เว้นว่าง = ดูทั้งหมด)';
  runStock(true);
}

async function runStock(reset) {
  if (GAS_URL.includes('PASTE_YOUR')) {
    feedEl.innerHTML = '<div class="errbox">ยังไม่ได้ตั้งค่า GAS_URL ใน <b>js/api.js</b></div>';
    return;
  }
  const myId = ++stockReqId;          // โทเคนกัน race
  const btn = $('#loadMore');
  if (reset) {
    stockQuery = $('#search').value.trim();
    stockOffset = 0;
    stockBody = null;
    feedEl.innerHTML = '<div class="stock-head">⏳ กำลังค้นหา…</div>';   // โหลดเบาๆ ไม่เด้งทั้งจอ
  } else if (btn) {
    btn.textContent = 'กำลังโหลด…';
  }
  try {
    const r = await fetchStock(stockQuery, stockOffset, STOCK_LIMIT);
    if (myId !== stockReqId) return;   // มีคำค้นใหม่กว่าแล้ว ทิ้งผลนี้
    stockTotal = r.total;
    if (reset) {
      if (!r.items.length) { feedEl.innerHTML = emptyHtml('ไม่พบสินค้า'); return; }
      feedEl.innerHTML = `<div class="stock-head">พบ <b>${fmt(stockTotal)}</b> รายการ</div><div class="stock-body"></div>`;
      stockBody = feedEl.querySelector('.stock-body');
    }
    r.items.forEach(c => stockBody.insertAdjacentHTML('beforeend', renderStockCard(c)));
    stockOffset += r.items.length;
    removeLoadMore();
    const remaining = stockTotal - stockOffset;
    if (remaining > 0) addLoadMore(remaining, () => runStock(false), STOCK_LIMIT);
  } catch (err) {
    if (myId !== stockReqId) return;
    feedEl.innerHTML = '<div class="errbox">ค้นหาไม่สำเร็จ: ' + esc(err.message) + '</div>';
  }
}

// ====== load more (ใช้ร่วมทั้ง 2 โหมด) ======
function addLoadMore(remaining, handler, size) {
  const step = size || PAGE;
  const btn = document.createElement('button');
  btn.id = 'loadMore';
  btn.className = 'load-more';
  btn.textContent = `โหลดเพิ่ม ${Math.min(step, remaining)} รายการ (เหลือ ${fmt(remaining)})`;
  btn.addEventListener('click', handler);
  feedEl.appendChild(btn);
}
function removeLoadMore() {
  const b = $('#loadMore');
  if (b) b.remove();
}

// ====== card renderers ======
function renderCard(c) {
  const stockTxt = c.stockQty === null
    ? '<span style="color:var(--muted)">ไม่พบใน Stock all</span>'
    : `<b class="${c.stockQty <= 0 ? 'zero' : ''}">${fmt(c.stockQty)}</b> ชิ้น`;
  const asOf = c.stockLabel ? ` <span class="as-of">(${esc(c.stockLabel)})</span>` : '';
  const f = (mode === 'feed' || mode === 'range') ? feedFilter : 'all';
  const L = { out: '🔴 จ่าย', in: '🟢 รับ', b2b: '🔵 จอง' };
  const badges = (f === 'all')
    ? badge('out', L.out, c.out) + badge('in', L.in, c.in) + badge('b2b', L.b2b, c.b2b)
    : badge(f, L[f], c[f]);
  return `<article class="card">
    <div class="thumb">${thumbHtml(c.img)}</div>
    <div class="body">
      <div class="sku">${esc(c.qr)}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="stock">คงเหลือ ${stockTxt}${asOf}</div>
      <div class="badges">${badges}</div>
    </div>
  </article>`;
}

function renderStockCard(c) {
  const zero = c.stockQty <= 0 ? 'zero' : '';
  return `<article class="card">
    <div class="thumb">${thumbHtml(c.img)}</div>
    <div class="body">
      <div class="sku">${esc(c.qr)}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="stock">คงเหลือ <b class="${zero}">${fmt(c.stockQty)}</b> ชิ้น${
        c.price ? ` · ราคา <b class="price">${fmt(c.price)}</b> บาท` : ''}</div>
      <div class="totrow">
        <span class="tot in">รับรวม <b>${fmt(c.totIn)}</b></span>
        <span class="tot out">จ่ายรวม <b>${fmt(c.totOut)}</b></span>
        <span class="tot b2b">จองรวม <b>${fmt(c.totB2b)}</b></span>
      </div>
    </div>
  </article>`;
}

function thumbHtml(img) {
  return img
    ? `<img src="${esc(img.replace(/sz=w\d+/, 'sz=w200'))}" data-full="${esc(img.replace(/sz=w\d+/, 'sz=w1000'))}" loading="lazy" alt="">`
    : `<span class="ph">📦</span>`;
}

function badge(cls, label, m) {
  if (!m.qty) return '';
  const items = m.items || [];
  // ครั้งเดียว → แสดงบรรทัดเดียว (รวมจำนวน + หมายเหตุ)
  if (items.length <= 1) {
    const note = (items[0] && items[0].note) ? `<span class="b-note">${esc(items[0].note)}</span>` : '';
    return `<div class="badge ${cls}"><span class="b-qty">${label} ${fmt(m.qty)}</span>${note}</div>`;
  }
  // หลายครั้ง → ยอดรวมด้านบน + แตกบรรทัดต่อครั้ง (จำนวน · หมายเหตุ)
  const lines = items.map(it =>
    `<div class="b-line"><b>${fmt(it.qty)}</b>${it.note ? `<span class="b-note">${esc(it.note)}</span>` : ''}</div>`
  ).join('');
  return `<div class="badge ${cls} multi">
    <div class="b-qty">${label} ${fmt(m.qty)} <span class="b-cnt">(${items.length} ครั้ง)</span></div>
    ${lines}
  </div>`;
}

function matchCard(c, q) {
  if (c.qr.toLowerCase().includes(q)) return true;
  if ((c.name || '').toLowerCase().includes(q)) return true;
  if ((c.groups || []).join(' ').toLowerCase().includes(q)) return true;   // กลุ่ม/แบรนด์ (คอลัมน์ I)
  const notes = [...c.out.items, ...c.in.items, ...c.b2b.items]
    .map(i => i.note).join(' ').toLowerCase();
  return notes.includes(q);
}

// ====== util ======
function emptyHtml(msg){ return '<div class="empty"><div class="em">🗒️</div><p>' + esc(msg) + '</p></div>'; }
function uniq(a){ return [...new Set(a)]; }
function fmt(n){ return Number(n).toLocaleString('en-US'); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
