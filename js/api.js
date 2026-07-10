// ====== API config ======
// เอา URL จาก GAS (Deploy > Web app) มาวางตรงนี้หลัง deploy
// ⚠️ static site เห็น URL นี้ได้ — GAS ตั้ง "อ่านอย่างเดียว ไม่มีข้อมูลลับ"
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxmcnwYmvoKCP8953grylNZZOg-0tpq8cPSzsX7nP682Fb0qO14KCwxl-JfikdCSgz_/exec';

// URL ของ SnapshotWriter (deploy เป็น Web app: Only myself) — สำหรับปุ่มแมปรูป
// เฉพาะเจ้าของ (ล็อกอิน Google) กดได้ คนนอกกดจะโดน Google ปฏิเสธ
const MAP_IMAGES_URL = 'https://script.google.com/macros/s/AKfycbz10elr45QI39-cpOG-C7FSGYNwds1sEEhC-x7z0pxDRZJmRtF4yjLBPqRd-uSSq5c/exec';

async function fetchFeed(period, nocache = false) {
  const url = GAS_URL + '?period=' + encodeURIComponent(period) + (nocache ? '&nocache=1' : '');
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'unknown error');
  return j;
}

async function fetchRange(from, to) {
  const url = GAS_URL + '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'unknown error');
  return j;
}

async function fetchStock(q, offset, limit) {
  const url = GAS_URL + '?mode=stock&q=' + encodeURIComponent(q) +
    '&offset=' + offset + '&limit=' + limit;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'unknown error');
  return j.result;   // {items, total, offset, limit}
}
