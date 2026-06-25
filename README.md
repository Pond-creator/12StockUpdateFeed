# Stock Update Feed — Folio

Dashboard ดูการเคลื่อนไหวสต็อกรายวัน (จ่าย / รับ / จอง) แบบ feed แจ้งเตือน
ดึงข้อมูลจาก Google Sheet ที่ทีมอัพเดทอยู่แล้ว — **อ่านอย่างเดียว ไม่แก้ข้อมูลต้นทาง**

## Stack
- **Frontend:** HTML/CSS/JS static → GitHub Pages
- **Backend:** Google Apps Script Web App (`gas/Code.gs`)
- **Database:** Google Sheet (4 ชีท: Stock all / check in / check out / Check shop b2b)
- **รูปสินค้า:** Google Drive (ตั้งชื่อไฟล์ด้วย QR code `F0...`) → thumbnail URL

## หน้าจอ
แท็บ: **วันนี้ / เมื่อวาน / สัปดาห์ (7 วันรวมวันนี้) / เดือน (ตั้งแต่วันที่ 1) / ปี (ตั้งแต่ 1 ม.ค.)**
- เรียงวันล่าสุดบนสุด · ในแต่ละวันเรียงตามจำนวนเคลื่อนไหวมากสุดก่อน
- 1 การ์ด = 1 SKU ที่มีความเคลื่อนไหวในวันนั้น แสดง: รูป · รหัส · ชื่อ · คงเหลือ + badge
  - 🔴 **จ่าย** (check out) — จำนวน + หมายเหตุ
  - 🟢 **รับ** (check in) — จำนวน + หมายเหตุ
  - 🔵 **จอง** (b2b) — จำนวน + สาขา (ผู้เบิก)
- ค้นหา รหัส/ชื่อ/หมายเหตุ · กดรูปดูใหญ่ · ปุ่ม ↻ โหลดใหม่ (ข้าม cache)

## โครงสร้าง Sheet (mapping)
| ชีท | คอลัมน์ที่ใช้ |
|---|---|
| Stock all | A=QR code · B=Qty · C=Name |
| check in / check out | A=date · C=QR code · D=qty · E=remark · F=remark other · J=description |
| Check shop b2b | A=date · B=ผู้เบิก · C=สาขา · E=QR code · F=ชื่อ · H=จำนวน |

## ติดตั้ง (Setup)
1. **GAS:** เปิด Apps Script ที่ผูกกับ Sheet → วางโค้ด `gas/Code.gs`
   - ตั้ง `SHEET_ID`, `IMG_FOLDER_ID` (ใส่ทีหลังได้)
   - Deploy > New deployment > **Web app** (Execute as: Me · Access: Anyone)
2. **Frontend:** เอา URL ที่ได้มาวางใน `js/api.js` → `GAS_URL`
3. **Drive รูป:** แชร์โฟลเดอร์ "Anyone with link – อ่านได้" · อยู่ใน "ไดร์ฟของฉัน"
4. Push ขึ้น GitHub → เปิด GitHub Pages

## ⚠️ ความปลอดภัย
- `gas/` อยู่ใน `.gitignore` — Sheet ID / Folder ID ไม่ขึ้น GitHub
- `GAS_URL` ใน `js/api.js` จะเห็นได้ (static site) — endpoint อ่านอย่างเดียว ไม่มีข้อมูลลับ
- ตรวจ checklist ความปลอดภัยก่อน push ทุกครั้ง
